import { requirePageRole } from '../../../../lib/pageguard';
import pool from '../../../../lib/db';
import { getServiceState, SERVICE_STATES, PAYMENT_STATES } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export default async function Service({ searchParams }) {
  await requirePageRole('owner', '/owner/login');
  const s = await getServiceState();
  const hist = await pool.query('select h.*,u.email from service_history h left join users u on u.id=h.changed_by order by h.id desc limit 50');
  return (<>
    <h3>Licence &amp; service control</h3>
    {searchParams.saved && <p style={{ color: '#146c2e' }}>Saved.</p>}
    <p>Current state: <b>{s.status}</b> &nbsp; Payment: <b>{s.payment_status}</b> &nbsp; Next payment date: <b>{s.next_payment_date ? String(s.next_payment_date).slice(0, 10) : '-'}</b></p>
    <p className="low">SUSPENDED or MAINTENANCE closes the storefront to customers (no new orders, no checkout). Administrators cannot override this. Your owner access always keeps working.</p>
    <form method="post" action="/api/owner/service" style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <label>Service state<select name="status" defaultValue={s.status}>{SERVICE_STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Payment status<select name="payment_status" defaultValue={s.payment_status}>{PAYMENT_STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Next payment date<input type="date" name="next_payment_date" defaultValue={s.next_payment_date ? String(s.next_payment_date).slice(0, 10) : ''} /></label>
      <label>Internal note<input name="note" placeholder="Reason / note (kept in service history)" /></label>
      <button className="btn">Save changes</button>
    </form>
    <h3 style={{ marginTop: 24 }}>Service history</h3>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>When</th><th>State</th><th>Payment</th><th>Note</th><th>By</th></tr></thead>
      <tbody>{hist.rows.map((h) => <tr key={h.id} style={{ borderTop: '1px solid #eee' }}><td>{new Date(h.created_at).toLocaleString('en-ZA')}</td><td>{h.status}</td><td>{h.payment_status}</td><td>{h.note}</td><td>{h.email || '-'}</td></tr>)}</tbody></table></div>
  </>);
}
