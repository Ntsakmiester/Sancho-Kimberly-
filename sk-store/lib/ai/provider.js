// AI provider abstraction. The store never hard-codes one provider: AI_PROVIDER picks the
// implementation and AI_API_KEYS holds one or more comma-separated keys used with bounded
// failover (a key that rate-limits or errors is cooled down, never retried in a hot loop).
// Keys live only in environment variables and are never logged, stored or sent to the browser.
const states = globalThis.__aiProviderStates || (globalThis.__aiProviderStates = new Map());
const splitKeys = (value) => (value || '').split(',').map((x) => x.trim()).filter(Boolean);
export function geminiBackupKeys() { return splitKeys(process.env.GEMINI_API_KEYS); }
function keyState(provider) {
  if (!states.has(provider)) states.set(provider, { i: 0, cool: new Map() });
  return states.get(provider);
}

export function aiKeys() {
  return (process.env.AI_API_KEYS || process.env.AI_API_KEY || '').split(',').map((x) => x.trim()).filter(Boolean);
}
export function providerName() { return (process.env.AI_PROVIDER || '').trim().toLowerCase(); }
export function providerReady(cfg) {
  if (!cfg.provider) return false;
  if (cfg.provider === 'mock') return process.env.ALLOW_TEST_AI === 'yes_no_real_cost';
  return (cfg.keyCount > 0 && ['openai', 'nvidia', 'gemini', 'anthropic'].includes(cfg.provider))
    || (cfg.provider === 'nvidia' && (cfg.backupKeys || geminiBackupKeys()).length > 0);
}
function nextKey(provider, keys) {
  const state = keyState(provider); const now = Date.now();
  for (let n = 0; n < keys.length; n++) {
    const idx = (state.i + n) % keys.length;
    if ((state.cool.get(keys[idx]) || 0) <= now) { state.i = idx + 1; return keys[idx]; }
  }
  return null;
}
const coolDown = (provider, key, ms) => keyState(provider).cool.set(key, Date.now() + ms);

export class ProviderUnavailable extends Error { constructor(m) { super(m); this.unavailable = true; } }

async function callHttp(url, { method = 'POST', headers = {}, body }, timeoutMs = 4500) {
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
    body: { model: cfg.model || (nvidia ? 'nvidia/nemotron-3-super-120b-a12b' : 'gpt-4o-mini'), messages: [{ role: 'system', content: payload.system }, ...payload.messages], max_tokens: cfg.maxTokens, temperature: cfg.temperature, ...(nvidia && (cfg.model || 'nvidia/nemotron-3-super-120b-a12b') === 'nvidia/nemotron-3-super-120b-a12b' ? { chat_template_kwargs: { enable_thinking: false } } : {}) },
  }, cfg.timeoutMs);
  if (r.status !== 200) return r;
  const c = r.data?.choices?.[0]?.message?.content;
  return { ...r, out: { text: String(c || '').trim(), tokensIn: r.data?.usage?.prompt_tokens || 0, tokensOut: r.data?.usage?.completion_tokens || 0, model: r.data?.model || cfg.model } };
}
async function gemini(cfg, key, payload) {
  const base = (cfg.baseUrl || process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = cfg.model || 'gemini-2.5-flash';
  const r = await callHttp(`${base}/v1beta/models/${model}:generateContent`, {
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: {
      system_instruction: { parts: [{ text: payload.system }] },
      contents: payload.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: cfg.maxTokens, temperature: cfg.temperature, ...(cfg.backup && model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
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

// Each provider has its own key pool and cooldown state. NVIDIA stays first on every
// request; only after its bounded attempts fail do we try the configured Gemini backup.
async function completePool(cfg, keys, payload) {
  const provider = cfg.provider;
  const impl = IMPL[provider];
  const attempts = provider === 'mock' ? 1 : Math.min(keys.length, 2);
  let lastErr = 'unavailable';
  for (let a = 0; a < attempts; a++) {
    const key = provider === 'mock' ? 'test' : nextKey(provider, keys);
    if (!key) break;
    let r;
    try { r = await impl(cfg, key, payload); }
    catch (e) { coolDown(provider, key, 30000); lastErr = e.name === 'AbortError' ? 'timeout' : 'network'; continue; }
    if (r.status === 200 && r.out?.text) return { ...r.out, provider };
    if (RETRYABLE(r.status)) { coolDown(provider, key, 60000); lastErr = 'http ' + r.status; continue; }
    if (KEY_BAD(r.status)) { coolDown(provider, key, 10 * 60000); lastErr = 'key rejected'; continue; }
    lastErr = 'http ' + r.status; break;
  }
  throw new ProviderUnavailable('AI provider request failed: ' + lastErr);
}
export async function complete(cfg, { system, history, userText }) {
  const provider = providerName();
  if (!IMPL[provider] || !providerReady(cfg)) throw new ProviderUnavailable('AI provider is not configured.');
  const started = Date.now();
  const messages = [...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })), { role: 'user', content: userText }];
  const payload = { system, messages };
  try {
    const out = await completePool({ ...cfg, provider }, cfg.primaryKeys || aiKeys(), payload);
    return { ...out, ms: Date.now() - started };
  } catch (e) {
    if (provider !== 'nvidia' || !(cfg.backupKeys || geminiBackupKeys()).length) throw e;
    const backup = { ...cfg, provider: 'gemini', backup: true,
      model: (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash',
      baseUrl: (process.env.GEMINI_BASE_URL || '').trim() || 'https://generativelanguage.googleapis.com' };
    const out = await completePool(backup, cfg.backupKeys || geminiBackupKeys(), payload);
    return { ...out, ms: Date.now() - started };
  }
}

// Owner-only diagnostics. One request per provider, bypassing cooldowns without changing
// customer rotation state. Never returns keys, request URLs, headers or raw response JSON.
function safeDiagnostic(value, cfg = {}) {
  let text = String(value || '');
  for (const secret of [...aiKeys(), ...geminiBackupKeys(), ...(cfg.primaryKeys || []), ...(cfg.backupKeys || [])]) {
    if (secret) { text = text.split(secret).join('[redacted]'); text = text.split(encodeURIComponent(secret)).join('[redacted]'); }
  }
  return text.replace(/(nvapi-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z._-]+|Bearer\s+\S+)/gi, '[redacted]').slice(0, 1500);
}
function defaultModel(provider) {
  return { nvidia: 'nvidia/nemotron-3-super-120b-a12b', openai: 'gpt-4o-mini', gemini: 'gemini-2.5-flash', anthropic: 'claude-3-5-haiku-latest', mock: 'mock' }[provider] || '';
}
export async function testProviders(cfg) {
  const primary = providerName();
  const plans = [{ ...cfg, provider: primary, model: cfg.model || defaultModel(primary), keys: cfg.primaryKeys || aiKeys() }];
  if (primary === 'nvidia') plans.push({ ...cfg, provider: 'gemini', backup: true,
    model: (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash',
    baseUrl: (process.env.GEMINI_BASE_URL || '').trim() || 'https://generativelanguage.googleapis.com', keys: cfg.backupKeys || geminiBackupKeys() });
  const attempts = [];
  const payload = { system: 'This is a connection test. Reply only OK. Do not include secrets.', messages: [{ role: 'user', content: 'Reply OK.' }] };
  for (const plan of plans) {
    const row = { provider: plan.provider || 'not set', model: safeDiagnostic(plan.model, cfg), keyCount: plan.keys.length, ok: false };
    if (!IMPL[plan.provider] || (plan.provider === 'mock' && process.env.ALLOW_TEST_AI !== 'yes_no_real_cost')) {
      row.error = 'Provider is not configured or not supported.'; attempts.push(row); continue;
    }
    if (!plan.keys.length && plan.provider !== 'mock') { row.error = 'No keys configured for this provider.'; attempts.push(row); continue; }
    const started = Date.now();
    try {
      const r = await IMPL[plan.provider]({ ...plan, maxTokens: plan.backup ? 128 : 32, temperature: 0 }, plan.keys[0] || 'test', payload);
      row.status = r.status;
      row.ok = r.status === 200 && !!r.out?.text;
      if (row.ok) { row.model = safeDiagnostic(r.out.model || plan.model, cfg); row.reply = safeDiagnostic(r.out.text, cfg).slice(0, 200); }
      else {
        const error = r.data?.error;
        row.error = safeDiagnostic(error?.message || (typeof error === 'string' ? error : '') || r.data?.detail || r.data?.message || (r.status === 200 ? 'Provider returned an empty answer.' : 'HTTP ' + r.status + ' (no provider error message).'), cfg);
      }
    } catch (e) {
      row.error = e.name === 'AbortError' ? 'Request timed out after 4500 ms.' : safeDiagnostic(e.cause?.message || e.message || 'Network request failed.', cfg);
    }
    row.ms = Date.now() - started;
    attempts.push(row);
    if (row.ok) return { ok: true, provider: row.provider, model: row.model, attempts };
  }
  return { ok: false, attempts };
}
