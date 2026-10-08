import pool from '../../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../../lib/aipage';
import { Flash } from '../../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Analytics({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { perms } = await aiPagePerm('ai.analytics');
  const one = (sql) => pool.query(sql).then((r) => r.rows[0]).catch(() => ({}));
  const convs = await one(`select
    count(*) filter (where created_at > now() - interval '1 day')::int today,
    count(*) filter (where created_at > now() - interval '7 days')::int week,
    count(*) filter (where created_at > now() - interval '30 days')::int month from ai_conversations`);
  const msgs = await one(`select count(*)::int total,
    count(*) filter (where mode='ai')::int ai,
    avg(response_ms) filter (where role='assistant' and response_ms is not null)::int avg_ms from ai_messages where role='assistant'`);
  const esc = await one(`select count(*)::int total, count(*) filter (where status not in ('RESOLVED','CLOSED'))::int open from support_tickets`);
  const fb = await one(`select count(*) filter (where feedback=1)::int up, count(*) filter (where feedback=-1)::int down from ai_messages where feedback is not null`);
  const usage = await one(`select coalesce(sum(tokens_in),0)::bigint tin, coalesce(sum(tokens_out),0)::bigint tout, count(*)::int calls from ai_usage where ok`);
  const intents = (await pool.query(`select coalesce(last_intent,'OTHER') k, count(*)::int n from ai_conversations group by 1 order by n desc limit 8`).catch(() => ({ rows: [] }))).rows;
  const cats = (await pool.query(`select category k, count(*)::int n from support_tickets group by 1 order by n desc limit 8`).catch(() => ({ rows: [] }))).rows;
  const helpfulRate = fb.up + fb.down > 0 ? Math.round((100 * fb.up) / (fb.up + fb.down)) : null;
  const escRate = convs.month > 0 ? Math.round((100 * (esc.total || 0)) / convs.month) : null;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/analytics" /><h3>AI analytics</h3>
    <div className="stats-grid">
      <div className="stat-card stat-accent"><div className="stat-label">Conversations today / week / month</div><div className="stat-value">{convs.today || 0} / {convs.week || 0} / {convs.month || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Assistant messages answered</div><div className="stat-value">{msgs.total || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Answered by AI provider</div><div className="stat-value">{msgs.ai || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Avg response time</div><div className="stat-value">{msgs.avg_ms != null ? (msgs.avg_ms / 1000).toFixed(1) + 's' : '—'}</div></div>
      <div className="stat-card"><div className="stat-label">Escalation rate (30d)</div><div className="stat-value">{escRate == null ? '—' : escRate + '%'}</div></div>
      <div className="stat-card"><div className="stat-label">Helpful / not helpful</div><div className="stat-value">{fb.up || 0} / {fb.down || 0}{helpfulRate != null ? ` (${helpfulRate}%)` : ''}</div></div>
      <div className="stat-card"><div className="stat-label">AI calls / tokens in / out</div><div className="stat-value">{usage.calls || 0} / {usage.tin || 0} / {usage.tout || 0}</div></div>
      <div className="stat-card"><div className="stat-label">Open tickets</div><div className="stat-value">{esc.open || 0}</div></div>
    </div>
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
      <div><h3>Most common intents</h3>
        <div className="office-table-scroll"><table><thead><tr><th>Intent</th><th>Conversations</th></tr></thead>
          <tbody>{intents.map((i) => <tr key={i.k}><td>{i.k}</td><td>{i.n}</td></tr>)}{!intents.length && <tr><td colSpan="2">No data yet.</td></tr>}</tbody></table></div></div>
      <div><h3>Support categories</h3>
        <div className="office-table-scroll"><table><thead><tr><th>Category</th><th>Tickets</th></tr></thead>
          <tbody>{cats.map((c) => <tr key={c.k}><td>{c.k}</td><td>{c.n}</td></tr>)}{!cats.length && <tr><td colSpan="2">No data yet.</td></tr>}</tbody></table></div></div>
    </div>
  </>);
}
