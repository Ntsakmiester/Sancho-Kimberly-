import { requirePageRole } from '../../../../lib/pageguard';
import pool from '../../../../lib/db';
import { price } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Orders() {
  await requirePageRole('owner', '/owner/login');
  const r = await pool.query('select ref,status,name,email,total_cents,created_at from orders order by id desc limit 100');
  return (<>
    <h3>Orders &amp; payment activity</h3>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Ref</th><th>Status</th><th>Customer</th><th>Total</th><th>Placed</th></tr></thead>
      <tbody>{r.rows.map((o) => <tr key={o.ref} style={{ borderTop: '1px solid #eee' }}><td>{o.ref}</td><td>{o.status}</td><td>{o.name}<br /><span className="low">{o.email}</span></td><td>{price(o.total_cents)}</td><td>{new Date(o.created_at).toLocaleString('en-ZA')}</td></tr>)}</tbody></table></div>
  </>);
}
