import pool from '../../../lib/db';
import { requirePageRole } from '../../../lib/pageguard';
import { price } from '../../../lib/format';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin | Sancho Kimberly' };
export default async function AdminDashboard() {
  const u = await requirePageRole(['admin', 'staff'], '/admin/login');
  const r = await pool.query('select ref,status,name,total_cents,created_at from orders order by id desc limit 50');
  return (
    <section className="wrap shop">
      <h2>Administrator dashboard</h2>
      <p className="low">Signed in as {u.email} ({u.role})</p>
      <form method="post" action="/api/auth/logout"><button className="btn">Log out</button></form>
      <h3 style={{ marginTop: 20 }}>Recent orders</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Ref</th><th>Status</th><th>Customer</th><th>Total</th><th>Placed</th></tr></thead>
        <tbody>{r.rows.map((o) => <tr key={o.ref} style={{ borderTop: '1px solid #eee' }}><td>{o.ref}</td><td>{o.status}</td><td>{o.name}</td><td>{price(o.total_cents)}</td><td>{new Date(o.created_at).toLocaleString('en-ZA')}</td></tr>)}</tbody></table>
      <p className="low" style={{ marginTop: 16 }}>Owner controls (service status, licence, administrator management) are not available to administrators.</p>
    </section>
  );
}
