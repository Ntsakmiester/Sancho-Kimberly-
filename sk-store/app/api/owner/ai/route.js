import { requestUrl } from '../../../../lib/request-url';
import pool from '../../../../lib/db';
import { requireRole, audit, ipOf } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { AI_SETTING_KEYS, invalidateAiConfig, aiConfig } from '../../../../lib/ai/settings';
import { providerReady } from '../../../../lib/ai/provider';
export const dynamic = 'force-dynamic';
// OWNER-only AI settings. Only non-secret configuration is stored; API keys stay in env vars.
export async function GET(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: 'Forbidden.' }, { status: 403 });
  const cfg = await aiConfig();
  return Response.json({ enabled: cfg.enabled, provider: cfg.provider || null, keys_configured: cfg.keyCount, backup_provider: cfg.provider === 'nvidia' ? 'gemini' : null, backup_keys_configured: cfg.provider === 'nvidia' ? cfg.backupKeyCount : 0, model: cfg.model || null, provider_ready: providerReady(cfg) });
}
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: 'Forbidden.' }, { status: 403 });
  const b = await bodyOf(req);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const back = '/owner/dashboard/ai';
  const done = (q) => isForm ? Response.redirect(new URL(back + '?' + q, requestUrl(req)), 303) : Response.json({ ok: !q.startsWith('error') });
  const old = (await pool.query('select key,value from settings where key = any($1)', [AI_SETTING_KEYS])).rows;
  const oldMap = Object.fromEntries(old.map((x) => [x.key, x.value]));
  const changes = {};
  for (const key of AI_SETTING_KEYS) {
    if (b[key] === undefined) continue;
    let v = String(b[key]).trim().slice(0, 2000);
    if (key === 'ai_enabled' || key === 'ai_proactive') v = v === 'true' || v === 'on' ? 'true' : 'false';
    if (['ai_temperature'].includes(key)) { const n = parseFloat(v); v = String(Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.4); }
    if (['ai_max_tokens', 'ai_history_messages', 'ai_rate_per_min', 'ai_daily_max', 'ai_conversation_max'].includes(key)) { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1) continue; v = String(n); }
    await pool.query('insert into settings(key,value) values($1,$2) on conflict (key) do update set value=excluded.value', [key, v]);
    if (oldMap[key] !== v) changes[key] = v;
  }
  invalidateAiConfig();
  await audit('AI_SETTINGS_CHANGED', { accountId: g.user.id, role: 'owner', ip: ipOf(req), entity: 'settings', oldValue: oldMap, newValue: changes });
  return done('saved=' + encodeURIComponent('AI settings saved.'));
}
