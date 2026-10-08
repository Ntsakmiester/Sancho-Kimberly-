import pool from '../../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../../lib/aipage';
import { Flash } from '../../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Conversations({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { perms } = await aiPagePerm('ai.conversations');
  const q = String(sp.q || '').trim().slice(0, 80);
  const status = ['OPEN', 'HUMAN', 'CLOSED'].includes(sp.status) ? sp.status : '';
  const args = []; let where = '1=1';
  if (q) { args.push('%' + q.replace(/[%_]/g, '') + '%'); where += ` and (c.title ilike $${args.length} or u.email ilike $${args.length})`; }
  if (status) { args.push(status); where += ` and c.status=$${args.length}`; }
  const rows = (await pool.query(
    `select c.public_id,c.title,c.status,c.category,c.priority,c.message_count,c.updated_at,u.email,s.name staff_name from ai_conversations c
     left join users u on u.id=c.user_id left join users s on s.id=c.assigned_staff_id where ${where} order by c.updated_at desc limit 100`, args)).rows;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/conversations" /><h3>Conversations</h3>
    <form className="chips" method="get" style={{ gap: 8 }}>
      <input name="q" defaultValue={q} placeholder="Search title or customer email" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)' }} />
      <select name="status" defaultValue={status}><option value="">All statuses</option><option>OPEN</option><option>HUMAN</option><option>CLOSED</option></select>
      <button className="btn">Search</button>
    </form>
    <div className="office-table-scroll"><table>
      <thead><tr><th>Conversation</th><th>Customer</th><th>Status</th><th>Category</th><th>Priority</th><th>Assigned</th><th>Last active</th></tr></thead>
      <tbody>{rows.map((c) => <tr key={c.public_id}>
        <td><a href={`/admin/dashboard/ai/conversations/${c.public_id}`}>{c.title}</a></td>
        <td>{c.email || 'Guest'}</td><td><span className="status-pill">{c.status}</span></td><td>{c.category}</td><td>{c.priority}</td>
        <td>{c.staff_name || '—'}</td><td>{new Date(c.updated_at).toLocaleString('en-ZA')}</td></tr>)}
        {!rows.length && <tr><td colSpan="7">No conversations found.</td></tr>}</tbody>
    </table></div>
  </>);
}
