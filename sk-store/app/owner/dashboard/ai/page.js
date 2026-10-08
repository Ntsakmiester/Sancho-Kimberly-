import AIKeys from '../../../../components/AIKeys';
import AITest from '../../../../components/AITest';
import pool from '../../../../lib/db';
import { requirePageRole } from '../../../../lib/pageguard';
import { getSettings } from '../../../../lib/service';
import { aiConfig } from '../../../../lib/ai/settings';
import { providerReady } from '../../../../lib/ai/provider';
import { Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function OwnerAi({ searchParams: spPromise }) {
  const sp = await spPromise;
  await requirePageRole('owner', '/owner/login');
  const s = await getSettings();
  const cfg = await aiConfig();
  const ready = providerReady(cfg);
  return (<>
    <Flash sp={sp} /><h3>AI assistant settings</h3>
    <p className="low">
      Provider: <strong>{cfg.provider || 'not set'}</strong> · API keys configured: <strong>{cfg.keyCount}</strong> · Mode right now: <strong>{ready ? 'AI answers' : 'fixed answers (no working provider)'}</strong>.
      {cfg.provider && cfg.keyCount === 0 && <> Add NVIDIA keys below, or set <code>AI_API_KEYS</code> on your host.</>}
      {!cfg.provider && <> Set <code>AI_PROVIDER</code> (openai, nvidia, gemini or anthropic) in your hosting environment, and add keys below or set <code>AI_API_KEYS</code> to turn on full AI answers. Until then the assistant uses its fixed store answers at no cost.</>}
      {cfg.provider === 'nvidia' && <> Gemini backup keys configured: <strong>{cfg.backupKeyCount}</strong>. Add Google keys below or to <code>GEMINI_API_KEYS</code> (comma-separated) on your host for automatic backup. NVIDIA stays primary; <code>GEMINI_MODEL</code> and <code>GEMINI_BASE_URL</code> control only the backup.</>}
    </p>
    <AIKeys />
    <AITest />
    <form method="post" action="/api/owner/ai" className="office-form" style={{ maxWidth: 620 }}>
      <label className="label"><input type="checkbox" name="ai_enabled" value="true" defaultChecked={(s.ai_enabled || 'true') !== 'false'} /> Assistant enabled</label>
      <label className="label"><input type="checkbox" name="ai_proactive" value="true" defaultChecked={(s.ai_proactive || 'true') !== 'false'} /> Proactive help (offers help after a customer views a product for a while)</label>
      <label className="label">Assistant name<input name="ai_name" maxLength="60" defaultValue={s.ai_name || 'Madala'} /></label>
      <label className="label">Greeting<textarea name="ai_greeting" rows="2" maxLength="300" defaultValue={s.ai_greeting || ''} placeholder="Hi! I can help you find products, track orders and answer questions about the store." /></label>
      <label className="label">Tone<input name="ai_tone" maxLength="120" defaultValue={s.ai_tone || 'professional, friendly and concise'} /></label>
      <label className="label">Personality notes<textarea name="ai_personality" rows="2" maxLength="500" defaultValue={s.ai_personality || ''} /></label>
      <label className="label">Escalation rules<textarea name="ai_escalation_rules" rows="2" maxLength="500" defaultValue={s.ai_escalation_rules || ''} placeholder="e.g. Always escalate refund disputes to a human" /></label>
      <p className="low">NVIDIA default: nvidia/nemotron-3-super-120b-a12b. If an old model is saved here or in AI_MODEL, update it too. Hosted model availability can change; use Test AI after saving.</p>
      <label className="label">Model (optional - provider default when blank; AI_MODEL in Vercel takes priority)<input name="ai_model" placeholder="nvidia/nemotron-3-super-120b-a12b" maxLength="80" defaultValue={s.ai_model || ''} /></label>
      <label className="label">Creativity / temperature (0 to 1)<input name="ai_temperature" inputMode="decimal" defaultValue={s.ai_temperature || '0.4'} /></label>
      <label className="label">Max answer length (tokens)<input name="ai_max_tokens" inputMode="numeric" defaultValue={s.ai_max_tokens || '600'} /></label>
      <label className="label">Messages per minute per customer<input name="ai_rate_per_min" inputMode="numeric" defaultValue={s.ai_rate_per_min || '12'} /></label>
      <label className="label">Max customer messages per day<input name="ai_daily_max" inputMode="numeric" defaultValue={s.ai_daily_max || '150'} /></label>
      <button className="btn">Save AI settings</button>
    </form>
    <p className="low" style={{ marginTop: 16 }}>Knowledge, bots, conversations, tickets and analytics live under Store management &gt; AI assistant. Grant AI permissions to admins and staff from the Admins &amp; staff page.</p>
  </>);
}
