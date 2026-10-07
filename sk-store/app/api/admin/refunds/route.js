import pool from '../../../../lib/db';
import { adminPost, int, cents } from '../../../../lib/adminapi';
import { completeRefund } from '../../../../lib/orders';
import { provider } from '../../../../lib/payments';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
// create (admin-initiated) / approve / reject / complete. Needs refunds.create.
export const POST = adminPost('refunds.create', (b) => '/admin/dashboard/orders/' + (b.ref || ''), async ({ g, b, ok, err }) => {
  const act = String(b.action || '');
  const log = (a, extra) => audit(a, { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'refund', ...extra });
  if (act === 'create') {
    const o = (await pool.query('select * from orders where ref=$1', [String(b.ref || '')])).rows[0];
    if (!o || o.payment_status === 'UNPAID') return err('Only paid orders can be refunded.');
    const pay = (await pool.query("select id from payments where order_id=$1 and status in ('PAID','PARTIALLY_REFUNDED') limit 1", [o.id])).rows[0];
    if (!pay) return err('No verified payment found for this order.');
    const open = (await pool.query("select coalesce(sum(amount_cents),0)::int s from refunds where order_id=$1 and status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED')", [o.id])).rows[0].s;
    const amt = b.full === 'on' ? o.total_cents - open : cents(b.amount);
    if (!amt || Number.isNaN(amt) || amt <= 0) return err('Enter a refund amount.');
    if (open + amt > o.total_cents) return err('Refunds cannot exceed the amount paid.');
    const r = (await pool.query("insert into refunds(order_id,payment_id,amount_cents,reason,restock,requested_by) values($1,$2,$3,$4,$5,$6) returning id", [o.id, pay.id, amt, String(b.reason || '').slice(0, 300), b.restock === 'on', g.user.id])).rows[0];
    await log('REFUND_REQUESTED', { record: o.ref, entityId: r.id, newValue: { amount_cents: amt } });
    return ok('Refund requested.');
  }
  const id = int(b.refund_id);
  const r = id ? (await pool.query('select r.*,o.ref from refunds r join orders o on o.id=r.order_id where r.id=$1', [id])).rows[0] : null;
  if (!r) return err('Refund not found.', 404);
  if (act === 'reject') {
    if (r.status !== 'REQUESTED') return err('Only requested refunds can be rejected.');
    await pool.query("update refunds set status='REJECTED', decided_by=$2, note=$3, updated_at=now() where id=$1", [id, g.user.id, String(b.note || '').slice(0, 300)]);
    await log('REFUND_REJECTED', { record: r.ref, entityId: id }); return ok('Refund rejected.');
  }
  if (act === 'approve') {
    if (r.status !== 'REQUESTED') return err('Only requested refunds can be approved.');
    await pool.query("update refunds set status='APPROVED', decided_by=$2, updated_at=now() where id=$1", [id, g.user.id]);
    await log('REFUND_APPROVED', { record: r.ref, entityId: id });
    // Gateway refund: the test gateway completes instantly. PayFast refunds are done in the PayFast dashboard (or its refund API with merchant credentials),
    // so the refund moves to PROCESSING and is marked complete here once the money has actually been returned.
    if (provider() === 'mock') { await completeRefund(id, { user: g.user, ip: g.ip }); return ok('Refund approved and completed.'); }
    await pool.query("update refunds set status='PROCESSING', updated_at=now() where id=$1", [id]);
    return ok('Refund approved. Return the money in your PayFast dashboard, then mark it completed.');
  }
  if (act === 'complete') { await completeRefund(id, { user: g.user, ip: g.ip }); return ok('Refund completed.'); }
  if (act === 'fail') {
    if (!['APPROVED', 'PROCESSING'].includes(r.status)) return err('That refund cannot be marked failed.');
    await pool.query("update refunds set status='FAILED', updated_at=now() where id=$1", [id]); await log('REFUND_FAILED', { record: r.ref, entityId: id }); return ok('Marked as failed.');
  }
  return err('Unknown action.');
});
