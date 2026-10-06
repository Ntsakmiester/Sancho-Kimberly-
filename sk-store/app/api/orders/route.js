import crypto from 'crypto';
import pool from '../../../lib/db';
import { shippingFor, PROVINCES } from '../../../lib/config';
export const dynamic = 'force-dynamic';
class UserError extends Error {}
const fail = (m, s = 400) => Response.json({ error: m }, { status: s });
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return fail('Invalid request.'); }
  const c = b.customer || {};
  const items = Array.isArray(b.items) ? b.items : [];
  for (const k of ['name', 'email', 'phone', 'address', 'suburb', 'city', 'province', 'postal']) {
    if (!String(c[k] || '').trim()) return fail('Please fill in all the delivery details.');
  }
  if (!/^\S+@\S+\.\S+$/.test(String(c.email))) return fail('Please enter a valid email address.');
  if (!PROVINCES.includes(c.province)) return fail('Please choose a province.');
  if (!items.length || items.length > 20) return fail('Your cart is empty.');
  const client = await pool.connect();
  try {
    await client.query('begin');
    let subtotal = 0; const lines = [];
    for (const it of items) {
      const qty = Math.floor(Number(it.qty));
      if (!(qty >= 1 && qty <= 10)) throw new UserError('Invalid quantity.');
      const r = await client.query('select id,name,price_cents from products where slug=$1 and active', [String(it.slug)]);
      const p = r.rows[0];
      if (!p) throw new UserError('A product in your cart is no longer available.');
      const u = await client.query('update variants set qty=qty-$1 where product_id=$2 and size=$3 and qty>=$1 returning id', [qty, p.id, String(it.size)]);
      if (!u.rowCount) throw new UserError(`${p.name} (${it.size}) is sold out or doesn't have enough stock.`);
      subtotal += p.price_cents * qty; lines.push({ p, size: String(it.size), qty });
    }
    const shipping = shippingFor(subtotal), total = subtotal + shipping;
    const ref = 'SK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const s = (k) => String(c[k]).trim().slice(0, 200);
    const o = await client.query(
      'insert into orders(ref,name,email,phone,address,suburb,city,province,postal,subtotal_cents,shipping_cents,total_cents) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id',
      [ref, s('name'), s('email'), s('phone'), s('address'), s('suburb'), s('city'), s('province'), s('postal'), subtotal, shipping, total]);
    for (const l of lines) await client.query('insert into order_items(order_id,product_id,name,size,qty,price_cents) values($1,$2,$3,$4,$5,$6)', [o.rows[0].id, l.p.id, l.p.name, l.size, l.qty, l.p.price_cents]);
    await client.query('commit');
    return Response.json({ ref });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    if (e instanceof UserError) return fail(e.message);
    console.error(e);
    return fail('Something went wrong placing your order. Please try again.', 500);
  } finally { client.release(); }
}
