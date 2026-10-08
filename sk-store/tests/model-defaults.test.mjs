// Offline provider/model and key-format compatibility regression tests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../lib/ai/provider.js',import.meta.url),'utf8');
const {testProviders,complete}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
process.env.AI_PROVIDER='nvidia';process.env.AI_API_KEYS='nvapi-fake';process.env.GEMINI_API_KEYS='';
let body;globalThis.fetch=async(url,opts)=>{body=JSON.parse(opts.body);assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');return {status:200,text:async()=>JSON.stringify({choices:[{message:{content:'OK'}}]})}};
const cfg={provider:'nvidia',model:'',keyCount:1,maxTokens:600,temperature:.4};
assert.equal((await testProviders(cfg)).model,'nvidia/nemotron-3-super-120b-a12b');assert.equal(body.model,'nvidia/nemotron-3-super-120b-a12b');assert.equal(body.chat_template_kwargs.enable_thinking,false);
await complete(cfg,{system:'Store facts',history:[],userText:'Shipping?'});assert.equal(body.model,'nvidia/nemotron-3-super-120b-a12b');
console.log('PASS diagnostics and chat use current NVIDIA default; non-thinking store responses');
const auth='AQ.'+'a'.repeat(120);process.env.AI_API_KEYS='';process.env.GEMINI_API_KEYS=auth;process.env.GEMINI_MODEL='gemini-3.5-flash-lite';
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');assert.equal(opts.headers['x-goog-api-key'],auth);assert.ok(!url.includes(auth));return {status:401,text:async()=>JSON.stringify({error:{message:'Rejected '+auth}})}};
const fail=await testProviders(cfg);assert.equal(fail.ok,false);assert.equal(fail.attempts[1].error,'Rejected [redacted]');assert.ok(!JSON.stringify(fail).includes(auth));
console.log('PASS new Google auth keys use native endpoint/header and diagnostic redaction');

const keySource = await fs.readFile(new URL('../lib/ai/keys.js',import.meta.url),'utf8');
const helper = keySource.slice(keySource.indexOf('export const validProviderKey'),keySource.indexOf('export async function addDashboardKeys'));
const {validProviderKey} = await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
const standard='AIza'+'x'.repeat(35);
assert.equal(validProviderKey('gemini',standard),true);assert.equal(validProviderKey('gemini',auth),true);
assert.equal(validProviderKey('nvidia',auth),false);assert.equal(validProviderKey('gemini','nvapi-'+'x'.repeat(35)),false);
for(const key of ['Bearer '+auth,'"'+auth+'"',auth+' ', 'AQ.short','AIzaab',auth+'\nJUNK']) assert.equal(validProviderKey('gemini',key),false);
console.log('PASS standard AIza+35 and AQ. keys; provider mismatch/malformed inputs rejected');
