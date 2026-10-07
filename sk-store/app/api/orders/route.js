import crypto from 'crypto';
import pool from '../../../lib/db';
import { PROVINCES, normalisePhone, isSaPostal } from '../../../lib/config';
import { storefrontGate } from '../../../lib/gate';
import { quote, UserError } from '../../../lib/pricing';
import { flag, setting } from '../../../lib/flags';
import { getUser, ipOf } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate';
import { initiatePayment, provider } from '../../../lib/payments';
import { notify, notifyAdmins } from '../../../lib/notify';
import { audit } from '../../../lib/audit';
export const dynamic = 'force-dynamic';
const fail = (m, s = 400) => Response.json({ error: m }, { status: s });
// Creates a PENDING order and starts a payment. Stock is NOT deducted here: it is deducted only after the gateway confirms payment server-side.
export async function POST(req) {
  const gateMsg = await storefrontGate();
  if (gateMsg) return fail(gateMsg, 503);
  if (!(await flag('new_orders'))) return fail('We are not taking new orders right now. Please check back soon.', 503);
  if (!(await flag('payments')) || !provider()) return fail('Online payment is not available yet. Please check back soon.', 503);
  let b;
  try { b = await req.json(); } catch { return fail('Invalid request.'); }
  const user = await getUser(req);
  const customerUser = user && user.role === 'customer' ? user : null;
  if (!customerUser && !(await flag('guest_checkout'))) return fail('Please log in to check out.', 401);
  if (!(await rateLimit('order:' + ipOf(req), 10, 600))) return fail('Too many attempts. Please wait a few minutes.', 429);
  const c = b.customer || {};
  for (const k of ['name', 'email', 'phone', 'address', 'suburb', 'city', 'province', 'postal']) {
    if (!String(c[k] || '').trim()) return fail('Please fill in all the delivery details.');
  }
  if (!/^\S+@\S+\.\S+$/.test(String(c.email))) return fail('Please enter a valid email address.');
  if (!PROVINCES.includes(c.province)) return fail('Please choose a province.');
  const phone = normalisePhone(c.phone);
  if (!phone) return fail('Please enter a valid South African phone number, e.g. 082 123 4567.');
  if (!isSaPostal(c.postal)) return fail('Please enter a 4-digit postal code.');
  const items = Array.isArray(b.items) ? b.items : [];
  const client = await pool.connect();
  let order;
  try {
    await client.query('begin');
    const q = await quote(client, { items, province: c.province, couponCode: flagCoupon(b.coupon), userId: customerUser?.id, email: c.email });
    if (q.coupon && !(await flag('coupons'))) throw new UserError('Coupons are not available right now.');
    const prefix = (await setting('order_prefix', 'SK')).replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'SK';
    const ref = prefix + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const s = (k) => String(c[k]).trim().slice(0, 200);
    const o = await client.query(
      `insert into orders(ref,name,email,phone,address,suburb,city,province,postal,subtotal_cents,shipping_cents,total_cents,discount_cents,vat_cents,coupon_code,shipping_method,courier,user_id,status,payment_status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'PENDING','UNPAID') returning *`,
      [ref, s('name'), s('email').toLowerCase(), phone, s('address'), s('suburb'), s('city'), s('province'), s('postal'), q.subtotal, q.shippingCents, q.total, q.discount, q.vat, q.coupon?.code || null, q.shipping.method, q.shipping.courier || null, customerUser?.id || null]);
    order = o.rows[0];
    for (const l of q.lines) await client.query('insert into order_items(order_id,product_id,variant_id,name,size,colour,sku,qty,price_cents) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [order.id, l.productId, l.variantId, l.name, l.size, l.colour, l.sku, l.qty, l.unit]);
    if (q.coupon) await client.query('insert into coupon_redemptions(coupon_id,order_id,user_id,email,amount_cents) values($1,$2,$3,$4,$5)', [q.coupon.id, order.id, customerUser?.id || null, order.email, q.discount]);
    await client.query("insert into order_status_history(order_id,status,note) values($1,'PENDING','Order placed, awaiting payment')", [order.id]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => {});
    if (e instanceof UserError) return fail(e.message);
    console.error(e);
    return fail('Something went wrong placing your order. Please try again.', 500);
  } finally { client.release(); }
  try {
    const payment = await initiatePayment(order, req);
    await audit('ORDER_CREATED', { accountId: customerUser?.id, role: customerUser?.role || 'guest', ip: ipOf(req), record: order.ref, entity: 'order', entityId: order.id, newValue: { total_cents: order.total_cents } });
    await notify({ type: 'order_confirmation', userId: order.user_id, to: order.email, subject: `We received your order ${order.ref}`, body: `Hi ${order.name},\nThanks for your order ${order.ref}. It will be processed as soon as your payment is confirmed.` });
    return Response.json({ ref: order.ref, payment });
  } catch (e) {
    console.error('payment init failed', e.message);
    await pool.query("update orders set status='CANCELLED', updated_at=now() where id=$1", [order.id]);
    await pool.query("update coupon_redemptions set amount_cents=amount_cents where order_id=$1", [order.id]);
    return fail('We could not start the payment. Please try again.', 502);
  }
}
const flagCoupon = (v) => (v ? String(v).slice(0, 40) : '');
