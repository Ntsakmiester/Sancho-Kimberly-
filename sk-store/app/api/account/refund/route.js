import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
import { notifyAdmins } from '../../../../lib/notify';
import { audit } from '../../../../lib/audit';
import { rateLimit } from '../../../../lib/rate';
export const dynamic = 'force-dynamic';
// A customer can ASK for a refund on their own paid order. An administrator approves it.
export const POST = customerPost((b) => '/account/orders/' + (b.ref || ''), async ({ u, b, ip, ok, err }) => {
  if (!(await rateLimit('refundreq:' + u.id, 5, 3600))) return err('Too many requests.', 429);
  const o = (await pool.query('select * from orders where ref=$1 and user_id=$2', [String(b.ref || ''), u.id])).rows[0];
  if (!o) return err('Order not found.', 404);
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status) || ['CANCELLED', 'REFUNDED'].includes(o.status)) return err('This order cannot be refunded.');
  const pay = (await pool.query("select id from payments where order_id=$1 and status in ('PAID','PARTIALLY_REFUNDED') limit 1", [o.id])).rows[0];
  const open = (await pool.query("select coalesce(sum(amount_cents),0)::int s, count(*) filter (where status in ('REQUESTED','APPROVED','PROCESSING'))::int pending from refunds where order_id=$1 and status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED')", [o.id])).rows[0];
  if (open.pending) return err('You already have a refund request open for this order.');
  const left = o.total_cents - open.s;
  let amt = b.full === 'on' || !b.amount ? left : Math.round(parseFloat(String(b.amount).replace(/[ ,R]/g, '')) * 100);
  if (!(amt > 0) || amt > left) return err('Enter a valid refund amount.');
  const reason = String(b.reason || '').trim().slice(0, 300); if (!reason) return err('Tell us why you are asking for a refund.');
  const r = (await pool.query("insert into refunds(order_id,payment_id,amount_cents,reason,requested_by,restock) values($1,$2,$3,$4,$5,false) returning id", [o.id, pay?.id, amt, reason, u.id])).rows[0];
  await audit('REFUND_REQUESTED', { accountId: u.id, role: 'customer', ip, record: o.ref, entity: 'refund', entityId: r.id, newValue: { amount_cents: amt } });
  await notifyAdmins('refund_requested', `Refund requested for ${o.ref}`, reason);
  return ok('Refund request sent. We will get back to you.');
});
