import pool from '../../../../../../lib/db';
import { notFound } from 'next/navigation';
import { aiPagePerm, AiTabs } from '../../../../../../lib/aipage';
import { Flash } from '../../../../../../components/ui';
export const dynamic = 'force-dynamic';
const fmt = (d) => new Date(d).toLocaleString('en-ZA');
export default async function ConversationDetail({ params, searchParams: sp }) {
  const { perms, user } = await aiPagePerm('ai.conversations');
  const c = (await pool.query('select c.*,u.email,u.name customer_name,s.name staff_name from ai_conversations c left join users u on u.id=c.user_id left join users s on s.id=c.assigned_staff_id where c.public_id=$1', [params.id])).rows[0];
  if (!c) notFound();
  const msgs = (await pool.query('select * from ai_messages where conversation_id=$1 order by id', [c.id])).rows;
  const ticket = (await pool.query('select ref,status,priority from support_tickets where conversation_id=$1 order by id desc limit 1', [c.id])).rows[0];
  const canTicket = perms.has('ai.tickets');
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/conversations" />
    <h3>{c.title}</h3>
    <p className="low">{c.email || 'Guest'} · {c.category} · priority {c.priority} · status {c.status}{c.staff_name ? ` · handled by ${c.staff_name}` : ''}{c.summary ? <><br />AI summary: {c.summary}</> : null}</p>
    {ticket && <p className="low">Ticket: {canTicket ? <a href={`/admin/dashboard/ai/tickets/${ticket.ref}`}>{ticket.ref}</a> : ticket.ref} ({ticket.status}, {ticket.priority})</p>}
    <div className="office-table-scroll"><table>
      <thead><tr><th>When</th><th>From</th><th>Message</th><th>Intent</th><th>Feedback</th></tr></thead>
      <tbody>{msgs.map((m) => <tr key={m.id}>
        <td style={{ whiteSpace: 'nowrap' }}>{fmt(m.created_at)}</td>
        <td>{m.role === 'customer' ? (c.email || 'Customer') : m.role === 'assistant' ? 'Assistant' : m.role === 'staff' ? 'Staff' : 'System'}</td>
        <td style={{ whiteSpace: 'pre-wrap', maxWidth: 480 }}>{m.content}{m.mode === 'fallback' && m.role === 'assistant' ? <span className="low"> (fixed answer)</span> : null}</td>
        <td>{m.intent || ''}</td>
        <td>{m.feedback === 1 ? '👍' : m.feedback === -1 ? <>👎{m.feedback_note ? <span className="low"> {m.feedback_note}</span> : null}</> : ''}</td></tr>)}</tbody>
    </table></div>
    <div className="chips">
      {c.status !== 'HUMAN' && <form method="post" action="/api/admin/ai/conversations"><input type="hidden" name="conversation_id" value={c.public_id} /><input type="hidden" name="action" value="takeover" /><button className="btn">Take over (human)</button></form>}
      {c.status === 'HUMAN' && <form method="post" action="/api/admin/ai/conversations"><input type="hidden" name="conversation_id" value={c.public_id} /><input type="hidden" name="action" value="return_to_ai" /><button className="btn">Return to assistant</button></form>}
    </div>
    {c.status === 'HUMAN' && (
      <form method="post" action="/api/admin/ai/conversations" className="office-form" style={{ maxWidth: 620 }}>
        <input type="hidden" name="conversation_id" value={c.public_id} /><input type="hidden" name="action" value="reply" />
        <label className="label">Reply as {user.name || user.email}<textarea name="body" rows="3" required maxLength="2000" /></label>
        <button className="btn">Send reply to customer</button>
      </form>)}
  </>);
}
