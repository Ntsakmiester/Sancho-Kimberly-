// AI provider abstraction. The store never hard-codes one provider: AI_PROVIDER picks the
// implementation and AI_API_KEYS holds one or more comma-separated keys used with bounded
// failover (a key that rate-limits or errors is cooled down, never retried in a hot loop).
// Keys live only in environment variables and are never logged, stored or sent to the browser.
const state = globalThis.__aiKeyState || (globalThis.__aiKeyState = { i: 0, cool: new Map() });

export function aiKeys() {
  return (process.env.AI_API_KEYS || process.env.AI_API_KEY || '').split(',').map((x) => x.trim()).filter(Boolean);
}
export function providerName() { return (process.env.AI_PROVIDER || '').trim().toLowerCase(); }
export function providerReady(cfg) {
  if (!cfg.provider) return false;
  if (cfg.provider === 'mock') return process.env.ALLOW_TEST_AI === 'yes_no_real_cost';
  return cfg.keyCount > 0 && ['openai', 'nvidia', 'gemini', 'anthropic'].includes(cfg.provider);
}
function nextKey() {
  const keys = aiKeys(); const now = Date.now();
  for (let n = 0; n < keys.length; n++) {
    const idx = (state.i + n) % keys.length;
    if ((state.cool.get(keys[idx]) || 0) <= now) { state.i = idx + 1; return keys[idx]; }
  }
  return null;
}
const coolDown = (key, ms) => state.cool.set(key, Date.now() + ms);

export class ProviderUnavailable extends Error { constructor(m) { super(m); this.unavailable = true; } }

async function callHttp(url, { method = 'POST', headers = {}, body }, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text };
  } finally { clearTimeout(t); }
}
const RETRYABLE = (s) => s === 429 || s >= 500;
const KEY_BAD = (s) => s === 401 || s === 403;

async function openai(cfg, key, payload) {
  const nvidia = cfg.provider === 'nvidia';
  const base = (process.env.AI_BASE_URL || (nvidia ? 'https://integrate.api.nvidia.com' : 'https://api.openai.com')).replace(/\/+$/, '');
  const endpoint = base.endsWith('/v1') ? base + '/chat/completions' : base + '/v1/chat/completions';
  const r = await callHttp(endpoint, {
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: { model: cfg.model || (nvidia ? 'meta/llama-3.1-70b-instruct' : 'gpt-4o-mini'), messages: [{ role: 'system', content: payload.system }, ...payload.messages], max_tokens: cfg.maxTokens, temperature: cfg.temperature },
  }, cfg.timeoutMs);
  if (r.status !== 200) return r;
  const c = r.data?.choices?.[0]?.message?.content;
  return { ...r, out: { text: String(c || '').trim(), tokensIn: r.data?.usage?.prompt_tokens || 0, tokensOut: r.data?.usage?.completion_tokens || 0, model: r.data?.model || cfg.model } };
}
async function gemini(cfg, key, payload) {
  const base = (process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = cfg.model || 'gemini-2.0-flash';
  const r = await callHttp(`${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    headers: { 'content-type': 'application/json' },
    body: {
      system_instruction: { parts: [{ text: payload.system }] },
      contents: payload.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: cfg.maxTokens, temperature: cfg.temperature },
    },
  }, cfg.timeoutMs);
  if (r.status !== 200) return r;
  const parts = r.data?.candidates?.[0]?.content?.parts || [];
  return { ...r, out: { text: parts.map((p) => p.text || '').join('').trim(), tokensIn: r.data?.usageMetadata?.promptTokenCount || 0, tokensOut: r.data?.usageMetadata?.candidatesTokenCount || 0, model } };
}
async function anthropic(cfg, key, payload) {
  const base = (process.env.AI_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const r = await callHttp(base + '/v1/messages', {
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: { model: cfg.model || 'claude-3-5-haiku-latest', max_tokens: cfg.maxTokens, temperature: cfg.temperature, system: payload.system, messages: payload.messages },
  }, cfg.timeoutMs);
  if (r.status !== 200) return r;
  return { ...r, out: { text: (r.data?.content || []).map((b) => b.text || '').join('').trim(), tokensIn: r.data?.usage?.input_tokens || 0, tokensOut: r.data?.usage?.output_tokens || 0, model: r.data?.model || cfg.model } };
}
async function mock(cfg, _key, payload) {
  const last = payload.messages[payload.messages.length - 1]?.content || '';
  return { status: 200, out: { text: `[test-ai] ${payload.system.split('\n')[0]} :: ${last.slice(0, 120)}`, tokensIn: 50, tokensOut: 20, model: 'mock' } };
}
const IMPL = { openai, nvidia: openai, gemini, anthropic, mock };

// One completion with bounded key failover. Throws ProviderUnavailable when nothing works.
export async function complete(cfg, { system, history, userText }) {
  const impl = IMPL[providerName()];
  if (!impl || !providerReady(cfg)) throw new ProviderUnavailable('AI provider is not configured.');
  const messages = [...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })), { role: 'user', content: userText }];
  const attempts = providerName() === 'mock' ? 1 : Math.min(Math.max(aiKeys().length, 1), 2);
  let lastErr = 'unavailable';
  for (let a = 0; a < attempts; a++) {
    const key = providerName() === 'mock' ? 'test' : nextKey();
    if (!key) break;
    const started = Date.now();
    let r;
    try { r = await impl(cfg, key, { system, messages }); }
    catch (e) { coolDown(key, 30000); lastErr = e.name === 'AbortError' ? 'timeout' : 'network'; continue; }
    if (r.status === 200 && r.out?.text) return { ...r.out, ms: Date.now() - started };
    if (RETRYABLE(r.status)) { coolDown(key, 60000); lastErr = 'http ' + r.status; continue; }
    if (KEY_BAD(r.status)) { coolDown(key, 10 * 60000); lastErr = 'key rejected'; continue; }
    lastErr = 'http ' + r.status; break; // 4xx request problem: retrying another key won't help
  }
  throw new ProviderUnavailable('AI provider request failed: ' + lastErr);
}
