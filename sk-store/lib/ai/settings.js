import pool from '../db';
import { getSettings } from '../service';
// AI assistant configuration. Secret material (API keys) lives ONLY in environment variables;
// everything here is non-secret and owner-editable from the owner dashboard.
let cache = { at: 0, cfg: null };
export async function aiConfig() {
  if (Date.now() - cache.at < 30000 && cache.cfg) return cache.cfg;
  const s = await getSettings().catch(() => ({}));
  const num = (v, d, min, max) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const cfg = {
    enabled: (s.ai_enabled || 'true') !== 'false',
    name: (s.ai_name || '').trim() || 'Madala',
    greeting: (s.ai_greeting || '').trim() || 'Hi! I can help you find products, track orders and answer questions about the store.',
    tone: (s.ai_tone || '').trim() || 'professional, friendly and concise',
    personality: (s.ai_personality || '').trim(),
    escalationRules: (s.ai_escalation_rules || '').trim(),
    model: (process.env.AI_MODEL || s.ai_model || '').trim(),
    temperature: num(s.ai_temperature, 0.4, 0, 1),
    maxTokens: Math.round(num(s.ai_max_tokens, 600, 100, 2000)),
    historyMessages: Math.round(num(s.ai_history_messages, 8, 2, 20)),
    ratePerMin: Math.round(num(s.ai_rate_per_min, 12, 1, 60)),
    dailyMax: Math.round(num(s.ai_daily_max, 150, 10, 2000)),
    conversationMax: Math.round(num(s.ai_conversation_max, 60, 10, 200)),
    proactive: (s.ai_proactive || 'true') !== 'false',
    provider: (process.env.AI_PROVIDER || '').trim().toLowerCase(),
    backupKeyCount: (process.env.GEMINI_API_KEYS || '').split(',').map((x) => x.trim()).filter(Boolean).length,
    keyCount: (process.env.AI_API_KEYS || process.env.AI_API_KEY || '').split(',').map((x) => x.trim()).filter(Boolean).length,
  };
  cache = { at: Date.now(), cfg };
  return cfg;
}
export const AI_SETTING_KEYS = ['ai_enabled', 'ai_name', 'ai_greeting', 'ai_tone', 'ai_personality', 'ai_escalation_rules', 'ai_model', 'ai_temperature', 'ai_max_tokens', 'ai_history_messages', 'ai_rate_per_min', 'ai_daily_max', 'ai_conversation_max', 'ai_proactive'];
export function invalidateAiConfig() { cache = { at: 0, cfg: null }; }
