import pool from './db';
import { restoreForOrder } from './inventory';
import { notify } from './notify';
import { audit } from './audit';
export const STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
// Staff-driven moves only. PAID is set by verified payment, REFUNDED by a completed full refund: neither can be set by hand.
const NEXT = { PAID: ['PROCESSING', 'CANCELLED'], PROCESSING: ['PACKED', 'CANCELLED'], PACKED: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'], PENDING: ['CANCELLED'], DELIVERED: [], CANCELLED: [], REFUNDED: [] };
export const allowedNext = (s) => NEXT[s] || [];
export class OrderError extends Error { userFacing = true; }

export async function changeStatus(orderId, to, { user, ip, note = '', tracking, courier, estDelivery } = {}) {
  const client = await pool.connect();
  let o, row;
  try {
    await client.query('begin');
    o = (await client.query('select * from orders where id=$1 for update', [orderId])).rows[0];
    if (!o) throw new OrderError('Order not found.');
    if (to && to !== o.status) {
      if (!allowedNext(o.status).includes(to)) throw new OrderError(`An order that is ${o.status} cannot be changed to ${to}.`);
      if (to === 'SHIPPED' && !(tracking || o.tracking_number)) throw new OrderError('Add a tracking number before marking an order as shipped.');
    }
    const t = tracking !== undefined && tracking !== '' ? String(tracking).slice(0, 80) : o.tracking_number;
    const c = courier !== undefined && courier !== '' ? String(courier).slice(0, 80) : o.courier;
    const e = estDelivery && /^\d{4}-\d{2}-\d{2}$/.test(estDelivery) ? estDelivery : o.est_delivery;
    const status = to || o.status;
    await client.query(`update orders set status=$1, tracking_number=$2, courier=$3, est_delivery=$4, updated_at=now(),
      shipped_at=case when $1='SHIPPED' and shipped_at is null then now() else shipped_at end,
      delivered_at=case when $1='DELIVERED' and delivered_at is null then now() else delivered_at end where id=$5`, [status, t, c, e, orderId]);
    if (to && to !== o.status) {
      await client.query('insert into order_status_history(order_id,status,note,user_id) values($1,$2,$3,$4)', [orderId, to, note || null, user?.id || null]);
      if (to === 'CANCELLED') {
        await restoreForOrder(client, o, 'CANCELLATION', user?.id);
        if (o.payment_status === 'PAID') {
          const has = (await client.query("select 1 from refunds where order_id=$1 and status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED')", [orderId])).rowCount;
          if (!has) {
            const p = (await client.query("select id from payments where order_id=$1 and status='PAID' limit 1", [orderId])).rows[0];
            await client.query("insert into refunds(order_id,payment_id,amount_cents,reason,status,restock,requested_by) values($1,$2,$3,'Order cancelled','REQUESTED',false,$4)", [orderId, p?.id, o.total_cents, user?.id || null]);
          }
        }
      }
    }
    await client.query('commit');
    row = (await pool.query('select * from orders where id=$1', [orderId])).rows[0];
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
  if (to && to !== o.status) {
    await audit('ORDER_STATUS_CHANGED', { accountId: user?.id, role: user?.role, ip, record: o.ref, entity: 'order', entityId: o.id, oldValue: { status: o.status }, newValue: { status: to, tracking_number: row.tracking_number } });
    const msg = {
      PROCESSING: ['order_processing', `We are preparing order ${o.ref}.`], PACKED: ['order_packed', `Order ${o.ref} is packed and ready to ship.`],
      SHIPPED: ['order_shipped', `Order ${o.ref} has shipped${row.courier ? ' with ' + row.courier : ''}.${row.tracking_number ? ' Tracking number: ' + row.tracking_number + '.' : ''}`],
      DELIVERED: ['order_delivered', `Order ${o.ref} has been delivered. You can now review your items in your account.`],
      CANCELLED: ['order_cancelled', `Order ${o.ref} has been cancelled.${o.payment_status === 'PAID' ? ' A refund will be arranged.' : ''}`],
    }[to];
    if (msg) await notify({ type: msg[0], userId: o.user_id, to: o.email, subject: `Order ${o.ref}: ${to.toLowerCase()}`, body: `Hi ${o.name},\n${msg[1]}` });
  } else if (tracking !== undefined || courier !== undefined || estDelivery) {
    await audit('ORDER_SHIPPING_UPDATED', { accountId: user?.id, role: user?.role, ip, record: o.ref, entity: 'order', entityId: o.id, newValue: { tracking_number: row.tracking_number, courier: row.courier, est_delivery: row.est_delivery } });
  }
  return row;
}

// Completes a refund: records it, updates payment/order state, restores stock only when asked. Idempotent per refund.
export async function completeRefund(refundId, { user, ip }) {
  const client = await pool.connect();
  let r, o;
  try {
    await client.query('begin');
    r = (await client.query('select * from refunds where id=$1 for update', [refundId])).rows[0];
    if (!r) throw new OrderError('Refund not found.');
    if (r.status === 'COMPLETED') { await client.query('rollback'); return r; }
    if (!['APPROVED', 'PROCESSING'].includes(r.status)) throw new OrderError('Refund must be approved first.');
    o = (await client.query('select * from orders where id=$1 for update', [r.order_id])).rows[0];
    const done = (await client.query("select coalesce(sum(amount_cents),0)::int s from refunds where order_id=$1 and status='COMPLETED'", [o.id])).rows[0].s;
    if (done + r.amount_cents > o.total_cents) throw new OrderError('Refunds cannot exceed the amount paid.');
    await client.query("update refunds set status='COMPLETED', completed_at=now(), decided_by=coalesce(decided_by,$2), updated_at=now() where id=$1", [refundId, user?.id || null]);
    const full = done + r.amount_cents === o.total_cents;
    await client.query("update payments set status=$2, updated_at=now() where id=$1", [r.payment_id, full ? 'REFUNDED' : 'PARTIALLY_REFUNDED']);
    if (full) {
      await client.query("update orders set status='REFUNDED', payment_status='REFUNDED', updated_at=now() where id=$1", [o.id]);
      await client.query("insert into order_status_history(order_id,status,note,user_id) values($1,'REFUNDED','Full refund completed',$2)", [o.id, user?.id || null]);
    } else {
      await client.query("update orders set payment_status='PARTIALLY_REFUNDED', updated_at=now() where id=$1", [o.id]);
    }
    if (r.restock) await restoreForOrder(client, o, 'REFUND', user?.id);
    await client.query('commit');
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
  await audit('REFUND_COMPLETED', { accountId: user?.id, role: user?.role, ip, record: o.ref, entity: 'refund', entityId: refundId, newValue: { amount_cents: r.amount_cents } });
  await notify({ type: 'refund', userId: o.user_id, to: o.email, subject: `Refund for order ${o.ref}`, body: `Hi ${o.name},\nA refund of R ${(r.amount_cents / 100).toFixed(2)} for order ${o.ref} has been completed. It can take a few days to reach your account.` });
  return r;
}
