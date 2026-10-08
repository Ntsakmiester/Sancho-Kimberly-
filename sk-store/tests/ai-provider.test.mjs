// Offline provider contract tests. No real keys, network calls or costs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../lib/ai/provider.js', import.meta.url), 'utf8');
const { complete, providerReady } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
let passed = 0;
const cfg = { provider: 'nvidia', keyCount: 2, model: '', maxTokens: 600, temperature: 0.4, timeoutMs: 1000 };
const input = { system: 'Use only verified store facts.', history: [{role:'user',content:'Hi'}, {role:'assistant',content:'Hello'}], userText:'Shipping?' };
process.env.AI_PROVIDER = 'nvidia'; process.env.AI_API_KEYS = 'fake-key-a,fake-key-b';
delete process.env.AI_BASE_URL;
assert.equal(providerReady(cfg), true); passed++;
let calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, ...options, body: JSON.parse(options.body) });
  if (calls.length === 1) return { status: 429, text: async () => '{}' };
  return { status: 200, text: async () => JSON.stringify({choices:[{message:{content:'Verified answer'}}],usage:{prompt_tokens:12,completion_tokens:5},model:'meta/llama-3.1-70b-instruct'}) };
};
const out = await complete(cfg, input);
assert.equal(out.text, 'Verified answer'); assert.equal(out.tokensIn, 12); assert.equal(out.tokensOut, 5); passed++;
assert.equal(calls.length, 2); assert.notEqual(calls[0].headers.authorization, calls[1].headers.authorization); passed++;
assert.equal(calls[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions'); passed++;
assert.equal(calls[0].body.model, 'meta/llama-3.1-70b-instruct');
assert.deepEqual(calls[0].body.messages[0], {role:'system',content: input.system}); passed++;
for (const base of ['http://localhost:1234', 'http://localhost:1234/v1/']) {
  process.env.AI_BASE_URL = base; process.env.AI_API_KEYS = 'fake-new-' + passed; calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({url, body: JSON.parse(opts.body)}); return {status:200,text:async()=>JSON.stringify({choices:[{message:{content:'Custom'}}]})}; };
  await complete({...cfg,model:'custom/model'},input);
  assert.equal(calls[0].url, 'http://localhost:1234/v1/chat/completions'); assert.equal(calls[0].body.model,'custom/model'); passed++;
}
process.env.AI_API_KEYS = 'fake-down';
globalThis.fetch = async () => { throw new Error('offline'); };
await assert.rejects(complete(cfg,input), /AI provider request failed/); passed++;
assert.equal(providerReady({...cfg,keyCount:0}), false); passed++;
process.env.AI_PROVIDER = 'openai'; process.env.AI_API_KEYS = 'fake-openai'; delete process.env.AI_BASE_URL;
globalThis.fetch = async (url,opts) => { assert.equal(url,'https://api.openai.com/v1/chat/completions'); assert.equal(JSON.parse(opts.body).messages[0].role,'system'); return {status:200,text:async()=>JSON.stringify({choices:[{message:{content:'OpenAI'}}]})}; };
await complete({...cfg,provider:'openai'},input); passed++;
console.log(`AI provider tests: ${passed}/${passed} passed (offline)`);
