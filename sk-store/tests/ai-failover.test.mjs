// Offline cross-provider tests; dummy keys and stubbed fetch only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../lib/ai/provider.js',import.meta.url),'utf8');
const {complete,providerReady}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const input={system:'Only store facts',history:[],userText:'Delivery?'};
const cfg={provider:'nvidia',keyCount:2,model:'primary/model',maxTokens:600,temperature:0.4,timeoutMs:30};
const success=(google=false)=>({status:200,text:async()=>JSON.stringify(google?{candidates:[{content:{parts:[{text:'Backup answer'}]}}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:7}}:{choices:[{message:{content:'Primary answer'}}],model:'primary/model'})});
let count=0;
async function scenario(name,primaryStatus,backupStatus=200){
 count++; process.env.AI_PROVIDER='nvidia';process.env.AI_API_KEYS=`primary-${count}-a,primary-${count}-b`;
 process.env.GEMINI_API_KEYS=`google-${count}-a,google-${count}-b`;process.env.AI_BASE_URL='https://primary.example';
 delete process.env.GEMINI_MODEL;delete process.env.GEMINI_BASE_URL;
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  const google=url.includes('generativelanguage');calls.push({url,opts,google});
  if(!google && primaryStatus==='network') throw new Error('offline');
  if(!google && primaryStatus==='timeout') throw Object.assign(new Error('timeout'),{name:'AbortError'});
  const status=google?backupStatus:primaryStatus;
  return status===200?success(google):{status,text:async()=>'{}'};
 };
 if(backupStatus!==200 && primaryStatus!==200){await assert.rejects(complete(cfg,input),/request failed/);}
 else {const out=await complete(cfg,input); assert.equal(out.provider,primaryStatus===200?'nvidia':'gemini');}
 if(primaryStatus===200){assert.equal(calls.length,1);}
 else {const g=calls.filter(c=>c.google);assert.ok(g.length);assert.ok(g[0].url.includes('/models/gemini-2.5-flash:generateContent'));assert.ok(!g[0].url.includes('primary-'));assert.ok(!g[0].url.includes('primary.example'));assert.equal(JSON.parse(g[0].opts.body).system_instruction.parts[0].text,input.system);assert.equal(JSON.parse(g[0].opts.body).generationConfig.thinkingConfig.thinkingBudget,0);}
 console.log('PASS',name);return calls;
}
await scenario('healthy NVIDIA never contacts backup',200);
for(const status of [429,500,401,403,400,'network','timeout']) await scenario('NVIDIA '+status+' switches to Gemini',status);
const all=await scenario('both pools fail -> exception for fixed-answer fallback',429,429);assert.equal(all.length,4);
assert.notEqual(all[0].opts.headers.authorization,all[1].opts.headers.authorization);assert.notEqual(all[2].opts.headers['x-goog-api-key'],all[3].opts.headers['x-goog-api-key']);
// Exhausted pools stay cooled down: no hot retry loop.
let calls=0;globalThis.fetch=async()=>{calls++;return success()};await assert.rejects(complete(cfg,input));assert.equal(calls,0);count++;console.log('PASS independent pool cooldowns');
process.env.AI_API_KEYS='';process.env.GEMINI_API_KEYS='fresh-backup';assert.equal(providerReady({...cfg,keyCount:0}),true);
process.env.GEMINI_MODEL='backup/custom';process.env.GEMINI_BASE_URL='https://backup.example';
globalThis.fetch=async(url)=>{assert.ok(url.startsWith('https://backup.example/v1beta/models/backup/custom:'));return success(true)};
assert.equal((await complete({...cfg,keyCount:0},input)).provider,'gemini');count++;console.log('PASS no primary keys, backup config separate');
delete process.env.GEMINI_API_KEYS;assert.equal(providerReady({...cfg,keyCount:0}),false);
process.env.AI_API_KEYS='no-backup-primary';globalThis.fetch=async()=>({status:500,text:async()=>'{}'});await assert.rejects(complete(cfg,input));count++;console.log('PASS absent backup preserves old fallback');
process.env.AI_PROVIDER='openai';process.env.AI_API_KEYS='only-openai';process.env.GEMINI_API_KEYS='must-not-use';globalThis.fetch=async()=>({status:500,text:async()=>'{}'});await assert.rejects(complete({...cfg,provider:'openai'},input));count++;console.log('PASS backup only enabled for NVIDIA');
console.log(`${count}/${count} offline failover tests passed`);
