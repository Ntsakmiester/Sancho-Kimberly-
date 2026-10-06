import pool from '../../../lib/db';
import { price } from '../../../lib/format';
import { getServiceState } from '../../../lib/service';
export const dynamic = 'force-dynamic';
const card = { border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 160 };
export default async function Overview() {
  const [rev, orders, customers, products, admins, staff, state] = await Promise.all([
    pool.query("select coalesce(sum(total_cents),0)::int t, count(*)::int c from orders where status<>'cancelled'"),
    pool.query('select count(*)::int c from orders'),
    pool.query("select count(distinct email)::int c from orders"),
    pool.query('select count(*)::int c from products where active'),
    pool.query("select count(*)::int c from users where role='admin'"),
    pool.query("select count(*)::int c from users where role='staff'"),
    getServiceState(),
  ]);
  const cells = [
    ['Total revenue', price(rev.rows[0].t)],
    ['Orders', orders.rows[0].c],
    ['Customers', customers.rows[0].c],
    ['Active products', products.rows[0].c],
    ['Administrators', admins.rows[0].c],
    ['Staff', staff.rows[0].c],
    ['Site status', state.status],
    ['Payment status', state.payment_status],
    ['Next payment date', state.next_payment_date ? String(state.next_payment_date).slice(0, 10) : '-'],
  ];
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{cells.map(([k, v]) => <div key={k} style={card}><div className="low">{k}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div></div>)}</div>;
}
