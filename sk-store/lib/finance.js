import pool from './db';
// South Africa has no daylight saving: SAST is always UTC+2, so day boundaries are computed with a fixed offset.
const TZ = '+02:00';
const ymd = (d) => d.toISOString().slice(0, 10);
const sastNow = () => new Date(Date.now() + 2 * 3600e3);
export function rangeOf(sp = {}) {
  const k = sp.range || '30d'; const n = sastNow(); const today = ymd(n);
  const add = (s, d) => ymd(new Date(new Date(s + 'T00:00:00Z').getTime() + d * 86400e3));
  let from, to; // inclusive dates
  if (k === 'today') { from = to = today; }
  else if (k === '7d') { from = add(today, -6); to = today; }
  else if (k === 'month') { from = today.slice(0, 8) + '01'; to = today; }
  else if (k === 'prev') { const first = today.slice(0, 8) + '01'; to = add(first, -1); from = to.slice(0, 8) + '01'; }
  else if (k === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(sp.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(sp.to || '') && sp.from <= sp.to) { from = sp.from; to = sp.to; }
  else { from = add(today, -29); to = today; }
  return { key: ['today', '7d', '30d', 'month', 'prev', 'custom'].includes(k) ? k : '30d', from, to, start: `${from}T00:00:00${TZ}`, end: `${add(to, 1)}T00:00:00${TZ}` };
}
// Revenue is built ONLY from verified payments (payments.status paid / refunded) by paid_at, minus completed refunds by completed_at. Orders alone never count.
export async function summary(r) {
  const q = async (sql) => (await pool.query(sql, [r.start, r.end])).rows[0];
  const paid = await q(`select coalesce(sum(amount_cents),0)::bigint gross, count(*)::int n, coalesce(sum(fee_cents),0)::bigint fees from payments where status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and paid_at >= $1 and paid_at < $2`);
  const ref = await q(`select coalesce(sum(amount_cents),0)::bigint amt, count(*)::int n from refunds where status='COMPLETED' and completed_at >= $1 and completed_at < $2`);
  const pend = await q(`select coalesce(sum(amount_cents),0)::bigint amt, count(*)::int n from payments where status='INITIATED' and created_at >= $1 and created_at < $2`);
  const failed = await q(`select count(*)::int n, coalesce(sum(amount_cents),0)::bigint amt from payments where status in ('FAILED','CANCELLED') and created_at >= $1 and created_at < $2`);
  const canc = await q(`select count(*)::int n from orders where status='CANCELLED' and created_at >= $1 and created_at < $2`);
  const attempts = await q(`select count(*)::int n from payments where status<>'INITIATED' and created_at >= $1 and created_at < $2`);
  const gross = Number(paid.gross), refunds = Number(ref.amt), fees = Number(paid.fees);
  return { gross, successful: paid.n, pending: Number(pend.amt), pendingN: pend.n, failed: failed.n, refunds, refundsN: ref.n, cancelled: canc.n, fees, net: gross - refunds - fees, aov: paid.n ? Math.round(gross / paid.n) : 0, transactions: paid.n + failed.n,
    successRate: attempts.n ? Math.round((paid.n / attempts.n) * 1000) / 10 : null, refundRate: gross ? Math.round((refunds / gross) * 1000) / 10 : 0 };
}
export async function trend(r) {
  return (await pool.query(`select to_char((paid_at at time zone 'Africa/Johannesburg')::date,'YYYY-MM-DD') as day, count(*)::int orders, sum(amount_cents)::bigint revenue from payments
    where status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and paid_at >= $1 and paid_at < $2 group by 1 order by 1`, [r.start, r.end])).rows;
}
export async function bestSellers(r, limit = 10) {
  return (await pool.query(`select i.name, sum(i.qty)::int units, sum(i.qty*i.price_cents)::bigint revenue from order_items i join orders o on o.id=i.order_id join payments p on p.order_id=o.id
    where p.status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and p.paid_at >= $1 and p.paid_at < $2 and o.status not in ('CANCELLED','REFUNDED') group by i.name order by units desc limit ${limit}`, [r.start, r.end])).rows;
}
export async function categorySales(r) {
  return (await pool.query(`select coalesce(pr.category,'Other') category, sum(i.qty)::int units, sum(i.qty*i.price_cents)::bigint revenue from order_items i join orders o on o.id=i.order_id join payments p on p.order_id=o.id left join products pr on pr.id=i.product_id
    where p.status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and p.paid_at >= $1 and p.paid_at < $2 and o.status not in ('CANCELLED','REFUNDED') group by 1 order by revenue desc`, [r.start, r.end])).rows;
}
export async function customerStats(r) {
  const x = (await pool.query(`select count(distinct lower(o.email))::int buyers, count(distinct lower(o.email)) filter (where (select count(*) from orders o2 where lower(o2.email)=lower(o.email) and o2.payment_status in ('PAID','REFUNDED','PARTIALLY_REFUNDED'))>1)::int as returning_buyers
    from orders o join payments p on p.order_id=o.id where p.status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and p.paid_at >= $1 and p.paid_at < $2`, [r.start, r.end])).rows[0];
  const ab = (await pool.query(`select count(*)::int total, count(*) filter (where payment_status in ('UNPAID','FAILED','CANCELLED') and created_at < now() - interval '1 hour')::int abandoned from orders where created_at >= $1 and created_at < $2`, [r.start, r.end])).rows[0];
  return { ...x, abandonmentRate: ab.total ? Math.round((ab.abandoned / ab.total) * 1000) / 10 : null, ordersStarted: ab.total };
}
export async function dashboardStats() {
  const day = (sql) => pool.query(sql).then((r) => r.rows[0]);
  const rev = (since) => `select coalesce(sum(amount_cents),0)::bigint v from payments where status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and paid_at >= ${since}`;
  const sast = "(date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')";
  const [today, week, month, orders, pending, paid, customers, products, low, out, failed, refunds] = await Promise.all([
    day(rev(sast)), day(rev(`${sast} - interval '6 days'`)), day(rev(`(date_trunc('month', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')`)),
    day('select count(*)::int v from orders'), day("select count(*)::int v from orders where status='PENDING'"), day("select count(*)::int v from orders where payment_status='PAID'"),
    day("select count(*)::int v from users where role='customer'"), day('select count(*)::int v from products where archived_at is null'),
    day("select count(*)::int v from variants v join products p on p.id=v.product_id where p.archived_at is null and v.active and v.qty>0 and v.qty <= coalesce(v.low_stock_threshold,p.low_stock_threshold)"),
    day("select count(*)::int v from variants v join products p on p.id=v.product_id where p.archived_at is null and v.active and v.qty=0"),
    day("select count(*)::int v from payments where status='FAILED'"), day("select count(*)::int v from refunds where status in ('REQUESTED','APPROVED','PROCESSING')"),
  ]);
  return { today: Number(today.v), week: Number(week.v), month: Number(month.v), orders: orders.v, pending: pending.v, paid: paid.v, customers: customers.v, products: products.v, low: low.v, out: out.v, failed: failed.v, refunds: refunds.v };
}
