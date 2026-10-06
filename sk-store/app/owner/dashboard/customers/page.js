import pool from '../../../../lib/db';
import { price } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Customers() {
  const r = await pool.query("select email, max(name) name, count(*)::int orders, sum(total_cents)::int spent, max(created_at) last_order from orders group by email order by spent desc limit 200");
  const acc = await pool.query("select email,name,created_at from users where role='customer' order by id desc limit 200");
  return (<>
    <h3>Customers</h3>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Customer</th><th>Orders</th><th>Total spent</th><th>Last order</th></tr></thead>
      <tbody>{r.rows.map((c) => <tr key={c.email} style={{ borderTop: '1px solid #eee' }}><td>{c.name}<br /><span className="low">{c.email}</span></td><td>{c.orders}</td><td>{price(c.spent)}</td><td>{new Date(c.last_order).toLocaleDateString('en-ZA')}</td></tr>)}</tbody></table></div>
    <h3 style={{ marginTop: 24 }}>Registered accounts</h3>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{acc.rows.map((a) => <tr key={a.email} style={{ borderTop: '1px solid #eee' }}><td>{a.name}<br /><span className="low">{a.email}</span></td><td>{new Date(a.created_at).toLocaleDateString('en-ZA')}</td></tr>)}</tbody></table></div>
  </>);
}
