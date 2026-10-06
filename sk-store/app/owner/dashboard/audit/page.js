import pool from '../../../../lib/db';
export const dynamic = 'force-dynamic';
export default async function Audit() {
  const r = await pool.query('select a.*,u.email from audit_log a left join users u on u.id=a.account_id order by a.id desc limit 200');
  return (<>
    <h3>Audit log</h3>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>When</th><th>Action</th><th>Account</th><th>Record</th><th>IP</th><th>Result</th></tr></thead>
      <tbody>{r.rows.map((a) => <tr key={a.id} style={{ borderTop: '1px solid #eee' }}><td>{new Date(a.created_at).toLocaleString('en-ZA')}</td><td>{a.action}</td><td>{a.email || '-'}</td><td>{a.record || '-'}</td><td>{a.ip || '-'}</td><td>{a.result}</td></tr>)}</tbody></table></div>
  </>);
}
