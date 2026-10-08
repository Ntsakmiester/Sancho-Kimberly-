import { requirePageRole } from '../../../../lib/pageguard';
import pool from '../../../../lib/db';
import { ALL_PERMS } from '../../../../lib/perms';
export const dynamic = 'force-dynamic';
const btn = { padding: '4px 10px' };
export default async function Admins({ searchParams }) {
  await requirePageRole('owner', '/owner/login');
  const gr = (await pool.query('select user_id,permission from user_permissions')).rows;
  const r = await pool.query("select id,email,name,role,active,created_at from users where role in ('admin','staff') order by id");
  return (<>
    <h3>Administrators &amp; staff</h3>
    {searchParams.error && <p className="err">{searchParams.error}</p>}
    {searchParams.created && <p style={{ color: '#146c2e' }}>Invitation sent to {searchParams.created}. They set their own password from the email link (valid for 30 minutes).</p>}
    {searchParams.resetfor && <p style={{ color: '#146c2e' }}>A password reset link was emailed to {searchParams.resetfor} and their sessions were ended.</p>}
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Account</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{r.rows.map((a) => <tr key={a.id} style={{ borderTop: '1px solid #eee' }}>
        <td>{a.name}<br /><span className="low">{a.email}</span></td>
        <td>{a.role}</td>
        <td>{a.active ? 'Active' : 'Disabled'}</td>
        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {a.active
            ? <form method="post" action="/api/owner/admins"><input type="hidden" name="action" value="disable" /><input type="hidden" name="id" value={a.id} /><button style={btn}>Disable</button></form>
            : <form method="post" action="/api/owner/admins"><input type="hidden" name="action" value="reactivate" /><input type="hidden" name="id" value={a.id} /><button style={btn}>Reactivate</button></form>}
          <form method="post" action="/api/owner/admins"><input type="hidden" name="action" value="role" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="role" value={a.role === 'admin' ? 'staff' : 'admin'} /><button style={btn}>Make {a.role === 'admin' ? 'staff' : 'admin'}</button></form>
          <form method="post" action="/api/owner/admins"><input type="hidden" name="action" value="reset" /><input type="hidden" name="id" value={a.id} /><button style={btn}>Reset access</button></form>
          <form method="post" action="/api/owner/admins"><input type="hidden" name="action" value="remove" /><input type="hidden" name="id" value={a.id} /><button style={btn}>Remove</button></form>
        </td></tr>)}</tbody></table></div>
    <h3 style={{ marginTop: 24 }}>Staff permissions</h3>
    {searchParams.saved && <p style={{ color: '#146c2e' }}>Saved.</p>}
    <p className="low">Staff can only do what you tick here. Administrators have full store access except owner controls.</p>
    {r.rows.filter((a) => a.role === 'staff').map((a) => <details key={a.id} style={{ marginBottom: 8 }}><summary>{a.name || a.email}</summary>
      <form method="post" action="/api/owner/staff"><input type="hidden" name="id" value={a.id} />
        {ALL_PERMS.map((p) => <label key={p} style={{ display: 'inline-block', marginRight: 12 }}><input type="checkbox" name="permissions" value={p} defaultChecked={gr.some((x) => x.user_id === a.id && x.permission === p)} /> {p}</label>)}
        <div><button className="btn">Save permissions</button></div></form></details>)}
    <h3 style={{ marginTop: 24 }}>Create an account</h3>
    <form method="post" action="/api/owner/admins" style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <input type="hidden" name="action" value="create" />
      <input name="name" placeholder="Full name" required />
      <input name="email" type="email" placeholder="Email address" required />
      <select name="role"><option value="admin">Administrator</option><option value="staff">Staff</option></select>
      <button className="btn">Create account</button>
    </form>
  </>);
}
