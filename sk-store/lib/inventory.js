// All stock changes go through here: row-locked, never negative, every change written to the movement ledger.
export class StockError extends Error { userFacing = true; }
export async function adjustVariant(client, { variantId, delta, reason, userId = null, orderId = null, note = null }) {
  const r = await client.query('select id,qty from variants where id=$1 for update', [variantId]);
  const v = r.rows[0];
  if (!v) throw new StockError('Variant not found.');
  const next = v.qty + delta;
  if (next < 0) throw new StockError('Not enough stock.');
  if (!Number.isInteger(delta) || delta === 0) throw new StockError('Invalid stock change.');
  if (orderId != null) {
    const dup = await client.query('select 1 from inventory_movements where variant_id=$1 and order_id=$2 and reason=$3', [variantId, orderId, reason]);
    if (dup.rowCount && ['SALE', 'CANCELLATION', 'REFUND', 'RETURN'].includes(reason)) return { skipped: true, qty: v.qty };
  }
  await client.query('update variants set qty=$1, updated_at=now() where id=$2', [next, variantId]);
  await client.query('insert into inventory_movements(variant_id,previous_qty,change,new_qty,reason,order_id,user_id,note) values($1,$2,$3,$4,$5,$6,$7,$8)',
    [variantId, v.qty, delta, next, reason, orderId, userId, note]);
  return { qty: next, previous: v.qty };
}
// Deduct stock for a verified-paid order exactly once. Returns 'DEDUCTED' or 'SHORT' (nothing deducted if any line is short).
export async function deductForOrder(client, order) {
  const o = (await client.query('select id,stock_status from orders where id=$1 for update', [order.id])).rows[0];
  if (o.stock_status !== 'NONE') return o.stock_status;
  const items = (await client.query('select variant_id,qty from order_items where order_id=$1 order by variant_id', [order.id])).rows;
  await client.query('savepoint deduct');
  try {
    for (const it of items) {
      if (!it.variant_id) throw new StockError('Missing variant.');
      await adjustVariant(client, { variantId: it.variant_id, delta: -it.qty, reason: 'SALE', orderId: order.id, note: 'Order ' + order.ref });
    }
  } catch (e) {
    if (!(e instanceof StockError)) throw e;
    await client.query('rollback to savepoint deduct');
    await client.query("update orders set stock_status='SHORT', updated_at=now() where id=$1", [order.id]);
    return 'SHORT';
  }
  await client.query("update orders set stock_status='DEDUCTED', updated_at=now() where id=$1", [order.id]);
  return 'DEDUCTED';
}
export async function restoreForOrder(client, order, reason, userId = null) {
  const o = (await client.query('select id,stock_status from orders where id=$1 for update', [order.id])).rows[0];
  if (o.stock_status !== 'DEDUCTED') return false;
  const items = (await client.query('select variant_id,qty from order_items where order_id=$1 order by variant_id', [order.id])).rows;
  for (const it of items) if (it.variant_id) await adjustVariant(client, { variantId: it.variant_id, delta: it.qty, reason, orderId: order.id, userId, note: 'Order ' + order.ref });
  await client.query("update orders set stock_status='RESTORED', updated_at=now() where id=$1", [order.id]);
  return true;
}
