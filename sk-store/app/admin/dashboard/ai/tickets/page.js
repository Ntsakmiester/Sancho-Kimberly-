import pool from '../../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../../lib/aipage';
import { Flash } from '../../../../../components/ui';
export const dynamic = 'force-dynamic';
const STATUSES = ['OPEN', 'AI_HANDLING', 'WAITING_FOR_CUSTOMER', 'ESCALATED', 'ASSIGNED', 'RESOLVED', 'CLOSED'];
export default async function Tickets({ searchParams: sp }) {
  const { perms } = await aiPagePerm('ai.tickets');
  const status = STATUSES.includes(sp.status) ? sp.status : '';
  const q = String(sp.q || '').trim().slice(0, 80);
  const args = []; let where = '1=1';
  if (status) { args.push(status); where += ` and t.status=$${args.length}`; }
  if (q) { args.push('%' + q.replace(/[%_]/g, '') + '%'); where += ` and (t.ref ilike $${args.length} or t.subject ilike $${args.length} or t.email ilike $${args.length})`; }
  const rows = (await pool.query(
    `select t.*,u.email customer_email,s.name staff_name from support_tickets t left join users u on u.id=t.user_id left join users s on s.id=t.assigned_staff_id where ${where} order by case t.priority when 'URGENT' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end, t.updated_at desc limit 100`, args)).rows;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/tickets" /><h3>Support tickets</h3>
    <form className="chips" method="get" style={{ gap: 8 }}>
      <input name="q" defaultValue={q} placeholder="Search ref, subject or email" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)' }} />
      <select name="status" defaultValue={status}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      <button className="btn">Search</button>
    </form>
    <div className="office-table-scroll"><table>
      <thead><tr><th>Ticket</th><th>Subject</th><th>Customer</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Updated</th></tr></thead>
      <tbody>{rows.map((t) => <tr key={t.ref}>
        <td><a href={`/admin/dashboard/ai/tickets/${t.ref}`}>{t.ref}</a></td>
        <td style={{ maxWidth: 260 }}>{t.subject}</td>
        <td>{t.customer_email || t.email || 'Guest'}</td><td>{t.category}</td><td>{t.priority}</td>
        <td><span className="status-pill">{t.status}</span></td><td>{t.staff_name || '—'}</td>
        <td>{new Date(t.updated_at).toLocaleString('en-ZA')}</td></tr>)}
        {!rows.length && <tr><td colSpan="8">No tickets found.</td></tr>}</tbody>
    </table></div>
  </>);
}
