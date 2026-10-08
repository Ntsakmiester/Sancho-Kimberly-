import pool from '../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../lib/aipage';
import { Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function AiOverview({ searchParams: sp }) {
  const { perms } = await aiPagePerm();
  const q = (sql) => pool.query(sql).then((r) => r.rows[0]).catch(() => ({}));
  const today = await q("select count(*)::int convs, coalesce(sum(message_count),0)::int msgs from ai_conversations where created_at > now() - interval '1 day'");
  const tickets = await q("select count(*) filter (where status not in ('RESOLVED','CLOSED'))::int open, count(*) filter (where status='ESCALATED')::int escalated from support_tickets");
  const fb = await q("select count(*) filter (where feedback=1)::int up, count(*) filter (where feedback=-1)::int down from ai_messages where feedback is not null");
  const mode = await q("select count(*) filter (where mode='ai')::int ai, count(*) filter (where mode='fallback')::int fixed from ai_messages where role='assistant'");
  const recent = (await pool.query("select public_id,title,status,category,priority,message_count,updated_at from ai_conversations order by updated_at desc limit 8").catch(() => ({ rows: [] }))).rows;
  const rate = fb.up + fb.down > 0 ? Math.round((100 * fb.up) / (fb.up + fb.down)) : null;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai" /><h3>AI assistant</h3>
    <div className="stats-grid">
      <div className="stat-card stat-accent"><div className="stat-label">Conversations (last 24h)</div><div className="stat-value">{today.convs || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Open support tickets</div><div className="stat-value">{tickets.open || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Escalations waiting</div><div className="stat-value">{tickets.escalated || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Helpful-answer rate</div><div className="stat-value">{rate == null ? '—' : rate + '%'}</div></div>
      <div className="stat-card"><div className="stat-label">AI answers</div><div className="stat-value">{mode.ai || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Fixed-answer mode</div><div className="stat-value">{mode.fixed || 0}</div></div>
    </div>
    <h3>Recent conversations</h3>
    <div className="office-table-scroll"><table>
      <thead><tr><th>Conversation</th><th>Status</th><th>Category</th><th>Priority</th><th>Messages</th><th>Last active</th></tr></thead>
      <tbody>{recent.map((c) => <tr key={c.public_id}>
        <td>{perms.has('ai.conversations') ? <a href={`/admin/dashboard/ai/conversations/${c.public_id}`}>{c.title}</a> : c.title}</td>
        <td><span className="status-pill">{c.status}</span></td><td>{c.category}</td><td>{c.priority}</td><td>{c.message_count}</td>
        <td>{new Date(c.updated_at).toLocaleString('en-ZA')}</td></tr>)}
        {!recent.length && <tr><td colSpan="6">No conversations yet.</td></tr>}</tbody>
    </table></div>
  </>);
}
