import crypto from 'node:crypto';
import pool from './db';
import { deductForOrder } from './inventory';
import { notify, notifyAdmins } from './notify';
import { audit } from './audit';
import { baseUrl } from './authflow';
import { flag } from './flags';

// Providers: 'payfast' (South African gateway; sandbox + live) or 'mock' (local/sandbox testing ONLY - refused in production).
export function provider() {
  const p = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  // The test gateway never runs in production unless someone deliberately sets ALLOW_TEST_PAYMENTS=yes_no_real_money (for a private demo).
  if (p === 'mock') return process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_PAYMENTS !== 'yes_no_real_money' ? null : 'mock';
  if (p === 'payfast') return process.env.PAYMENT_GATEWAY_KEY && process.env.PAYMENT_GATEWAY_SECRET ? 'payfast' : null;
  return null;
}
export const payfastHost = () => (process.env.PAYFAST_SANDBOX === 'true' ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za');
const enc = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');
// PayFast signature: fields in the order they are sent, url-encoded, passphrase appended, MD5.
export function pfSignature(fields, passphrase) {
  const parts = Object.entries(fields).filter(([k, v]) => k !== 'signature' && v !== '' && v != null).map(([k, v]) => `${k}=${enc(v)}`);
  if (passphrase) parts.push('passphrase=' + enc(passphrase));
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
}
const passphrase = () => process.env.PAYMENT_WEBHOOK_SECRET || '';
export const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Create the payment row + the signed data the browser needs to go to the gateway. Amounts always come from the stored order.
export async function initiatePayment(order, req) {
  const prov = provider();
  if (!prov) throw new Error('Payments are not configured.');
  const base = baseUrl(req);
  const pay = (await pool.query("insert into payments(order_id,provider,amount_cents) values($1,$2,$3) returning id", [order.id, prov, order.total_cents])).rows[0];
  const mpid = 'P' + pay.id + '-' + order.ref;
  await pool.query('update payments set provider_ref=$1 where id=$2', [mpid, pay.id]);
  if (prov === 'mock') return { provider: prov, redirect: `/pay/mock/${order.ref}?p=${pay.id}` };
  const fields = {
    merchant_id: process.env.PAYMENT_GATEWAY_KEY, merchant_key: process.env.PAYMENT_GATEWAY_SECRET,
    return_url: `${base}/order/${order.ref}?returned=1`, cancel_url: `${base}/order/${order.ref}?cancelled=1`, notify_url: `${base}/api/payments/webhook`,
    name_first: String(order.name).split(' ')[0].slice(0, 100), email_address: order.email, m_payment_id: mpid,
    amount: (order.total_cents / 100).toFixed(2), item_name: ('Order ' + order.ref).slice(0, 100),
  };
  fields.signature = pfSignature(fields, passphrase());
  return { provider: prov, action: payfastHost() + '/eng/process', fields };
}

// Verify an ITN/webhook. Signature is mandatory; for PayFast live we also confirm the notification with PayFast's server.
export async function verifyEvent(fields) {
  const sig = String(fields.signature || '');
  if (!sig) return 'missing signature';
  if (!safeEq(pfSignature(fields, passphrase()), sig)) return 'bad signature';
  if (provider() === 'payfast') {
    if (String(fields.merchant_id) !== String(process.env.PAYMENT_GATEWAY_KEY)) return 'merchant mismatch';
    if (process.env.PAYFAST_SKIP_POSTBACK !== 'true') {
      try {
        const body = Object.entries(fields).filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${enc(v)}`).join('&');
        const r = await fetch(payfastHost() + '/eng/query/validate', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if ((await r.text()).trim() !== 'VALID') return 'gateway did not confirm';
      } catch { return 'gateway unreachable'; }
    }
  }
  return null;
}

// Idempotent: the same event can arrive any number of times (or in parallel) and is processed once.
export async function processEvent(fields) {
  const prov = provider() || 'mock';
  const mpid = String(fields.m_payment_id || '');
  const status = String(fields.payment_status || '').toUpperCase();
  const eventId = String(fields.pf_payment_id || mpid) + ':' + status;
  const client = await pool.connect();
  let after = null;
  try {
    await client.query('begin');
    const pay = (await client.query('select * from payments where provider_ref=$1 for update', [mpid])).rows[0];
    const ev = await client.query('insert into payment_events(provider,event_id,payment_id,outcome,payload) values($1,$2,$3,$4,$5) on conflict(provider,event_id) do nothing returning id',
      [prov, eventId, pay ? pay.id : null, 'received', JSON.stringify({ m_payment_id: mpid, payment_status: status, amount_gross: fields.amount_gross })]);
    if (!ev.rowCount) { await client.query('rollback'); return { result: 'duplicate' }; }
    const setOutcome = (o, d) => client.query('update payment_events set outcome=$1, detail=$2 where id=$3', [o, d || null, ev.rows[0].id]);
    if (!pay) { await setOutcome('rejected', 'unknown payment'); await client.query('commit'); return { result: 'unknown' }; }
    const order = (await client.query('select * from orders where id=$1 for update', [pay.order_id])).rows[0];
    if (status === 'COMPLETE') {
      const gross = Math.round(parseFloat(fields.amount_gross) * 100);
      if (gross !== pay.amount_cents) {
        await setOutcome('rejected', `amount mismatch: paid ${gross}, expected ${pay.amount_cents}`);
        await client.query("insert into system_events(kind,severity,message) values('payment','error',$1)", [`Amount mismatch on order ${order.ref}`]);
        await client.query('commit'); return { result: 'amount_mismatch' };
      }
      if (pay.status === 'PAID' || order.payment_status === 'PAID') { await setOutcome('ignored', 'already paid'); await client.query('commit'); return { result: 'already_paid' }; }
      const fee = Math.round(pay.amount_cents * parseFloat((await client.query("select value from settings where key='gateway_fee_pct'")).rows[0]?.value || '0') / 100) + parseInt((await client.query("select value from settings where key='gateway_fee_fixed_cents'")).rows[0]?.value || '0', 10);
      await client.query("update payments set status='PAID', paid_at=now(), fee_cents=$2, updated_at=now() where id=$1", [pay.id, fee]);
      await client.query("update orders set payment_status='PAID', status=case when status='PENDING' then 'PAID' else status end, paid_at=now(), updated_at=now() where id=$1", [order.id]);
      await client.query("insert into order_status_history(order_id,status,note) values($1,'PAID','Payment verified')", [order.id]);
      const stock = await deductForOrder(client, order);
      if (stock === 'SHORT') {
        await client.query("insert into refunds(order_id,payment_id,amount_cents,reason,status,restock) values($1,$2,$3,'Out of stock after payment','REQUESTED',false)", [order.id, pay.id, pay.amount_cents]);
        await client.query("insert into order_status_history(order_id,status,note) values($1,'PAID','Stock ran out before payment cleared - full refund requested automatically')", [order.id]);
      }
      await setOutcome('paid', stock);
      after = { type: 'paid', order, stock };
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      if (pay.status === 'INITIATED') {
        await client.query('update payments set status=$2, updated_at=now() where id=$1', [pay.id, status]);
        await client.query("update orders set payment_status=$2, updated_at=now() where id=$1 and payment_status<>'PAID'", [order.id, status === 'FAILED' ? 'FAILED' : 'CANCELLED']);
        after = { type: 'failed', order };
      }
      await setOutcome(status.toLowerCase());
    } else await setOutcome('ignored', 'status ' + status);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => {});
    await pool.query("insert into system_events(kind,severity,message) values('webhook','error',$1)", ['Webhook processing error: ' + String(e.message).slice(0, 200)]).catch(() => {});
    throw e;
  } finally { client.release(); }
  if (after?.type === 'paid') {
    const o = after.order;
    await audit('PAYMENT_VERIFIED', { record: o.ref, entity: 'order', entityId: o.id, newValue: { amount_cents: o.total_cents, stock: after.stock } });
    await notify({ type: 'payment_confirmed', userId: o.user_id, to: o.email, subject: `Payment received for order ${o.ref}`, body: `Hi ${o.name},\nWe have received your payment for order ${o.ref}. We will let you know when it ships.` });
    await notifyAdmins('new_paid_order', `New paid order ${o.ref}`, `Order ${o.ref} has been paid.`);
    if (after.stock === 'SHORT') await notifyAdmins('stock_short', `Out of stock after payment: ${o.ref}`, 'A refund request was created automatically.');
    const low = (await pool.query(`select p.name,v.size,v.qty from variants v join products p on p.id=v.product_id join order_items i on i.variant_id=v.id where i.order_id=$1 and v.qty <= coalesce(v.low_stock_threshold,p.low_stock_threshold)`, [o.id])).rows;
    for (const l of low) await notifyAdmins('low_stock', `Low stock: ${l.name} (${l.size})`, `${l.qty} left.`);
  } else if (after?.type === 'failed') {
    const o = after.order;
    await audit('PAYMENT_FAILED', { record: o.ref, entity: 'order', entityId: o.id });
    await notify({ type: 'payment_failed', userId: o.user_id, to: o.email, subject: `Payment did not go through for order ${o.ref}`, body: `Hi ${o.name},\nYour payment for order ${o.ref} was not completed. You can place the order again from the shop.` });
  }
  return { result: after?.type || 'ok' };
}
export { flag };
