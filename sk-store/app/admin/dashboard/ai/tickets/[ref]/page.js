import pool from '../../../../../../lib/db';
import { notFound } from 'next/navigation';
import { aiPagePerm, AiTabs } from '../../../../../../lib/aipage';
import { Flash } from '../../../../../../components/ui';
export const dynamic = 'force-dynamic';
const STATUSES = ['OPEN', 'AI_HANDLING', 'WAITING_FOR_CUSTOMER', 'ESCALATED', 'ASSIGNED', 'RESOLVED', 'CLOSED'];
const CATS = ['PRODUCT', 'ORDER', 'PAYMENT', 'SHIPPING', 'RETURN', 'REFUND', 'ACCOUNT', 'TECHNICAL', 'GENERAL', 'COMPLAINT'];
export default async function TicketDetail({ params, searchParams: sp }) {
  const { perms, user } = await aiPagePerm('ai.tickets');
  const t = (await pool.query('select t.*,u.email customer_email,s.name staff_name from support_tickets t left join users u on u.id=t.user_id left join users s on s.id=t.assigned_staff_id where t.ref=$1', [params.ref])).rows[0];
  if (!t) notFound();
  const msgs = (await pool.query('select * from support_messages where ticket_id=$1 order by id', [t.id])).rows;
  const staff = (await pool.query("select id,name,email,role from users where role in ('owner','admin','staff') and active order by role, id")).rows;
  const conv = t.conversation_id ? (await pool.query('select public_id from ai_conversations where id=$1', [t.conversation_id])).rows[0] : null;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/tickets" />
    <h3>{t.ref}: {t.subject}</h3>
    <p className="low">{t.customer_email || t.email || 'Guest'} · opened {new Date(t.created_at).toLocaleString('en-ZA')}{conv && perms.has('ai.conversations') ? <> · <a href={`/admin/dashboard/ai/conversations/${conv.public_id}`}>View conversation</a></> : null}</p>
    {t.summary && <p className="low">AI summary: {t.summary}</p>}
    <form method="post" action="/api/admin/ai/tickets" className="office-form" style={{ maxWidth: 620 }}>
      <input type="hidden" name="ref" value={t.ref} />
      <label className="label">Status<select name="status" defaultValue={t.status}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="label">Priority<select name="priority" defaultValue={t.priority}>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}</select></label>
      <label className="label">Category<select name="category" defaultValue={t.category}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="label">Assigned to<select name="assign" defaultValue={t.assigned_staff_id || ''}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email} ({s.role})</option>)}</select></label>
      <button className="btn">Save ticket</button>
    </form>
    <h3 style={{ marginTop: 28 }}>Conversation</h3>
    <div className="office-table-scroll"><table>
      <thead><tr><th>When</th><th>From</th><th>Message</th></tr></thead>
      <tbody>{msgs.map((m) => <tr key={m.id}><td style={{ whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('en-ZA')}</td><td>{m.author_role === 'customer' ? 'Customer' : m.author_role === 'staff' ? 'Staff' : 'Assistant'}</td><td style={{ whiteSpace: 'pre-wrap', maxWidth: 520 }}>{m.body}</td></tr>)}</tbody>
    </table></div>
    <form method="post" action="/api/admin/ai/tickets" className="office-form" style={{ maxWidth: 620 }}>
      <input type="hidden" name="ref" value={t.ref} /><input type="hidden" name="action" value="reply" />
      <label className="label">Reply as {user.name || user.email}<textarea name="body" rows="3" required maxLength="2000" /></label>
      <button className="btn">Send reply to customer</button>
    </form>
  </>);
}
