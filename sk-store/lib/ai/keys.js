import pool from '../db';
import crypto from 'node:crypto';
export function encryptionReady() { return /^[a-f0-9]{64}$/i.test(process.env.AI_KEY_ENCRYPTION_SECRET || ''); }
const encryptionKey = () => {
  if (!encryptionReady()) throw new Error('Set AI_KEY_ENCRYPTION_SECRET to 64 random hex characters in your server environment before managing dashboard keys.');
  return Buffer.from(process.env.AI_KEY_ENCRYPTION_SECRET, 'hex');
};
export function encryptKey(value) { const iv=crypto.randomBytes(12); const c=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv); const ciphertext=Buffer.concat([c.update(value,'utf8'),c.final()]); return [iv.toString('base64'),c.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.'); }
export function decryptKey(value) { const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64')); const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),iv); d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]).toString('utf8'); }
export async function keyMetadata() { return (await pool.query('select id,provider,last4,created_at from ai_provider_keys order by id')).rows; }
export async function dashboardKeyPools() {
  const result={nvidia:[],gemini:[]};
  try { const rows=(await pool.query('select provider,encrypted_value from ai_provider_keys order by id')).rows; for(const row of rows) result[row.provider].push(decryptKey(row.encrypted_value)); }
  catch { /* Environment keys remain available if encrypted storage is unavailable. */ }
  return result;
}
export const validProviderKey = (provider, key) => provider === 'nvidia' ? /^nvapi-[A-Za-z0-9_-]{20,500}$/.test(key) : provider === 'gemini' && /^(?:AIza[A-Za-z0-9_-]{20,500}|AQ\.[A-Za-z0-9._-]{20,2000})$/.test(key);
export async function addDashboardKeys(provider, raw) {
 if (!['nvidia','gemini'].includes(provider)) throw new Error('Choose NVIDIA or Gemini.');
 const values=String(raw||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!values.length || values.length>10) throw new Error('Enter between 1 and 10 comma-separated keys.');
 for(const key of values) if (!validProviderKey(provider, key)) throw new Error(provider === 'gemini' ? 'Enter the full Google AI Studio key (standard AIza or auth AQ. format), without quotes or a Bearer prefix.' : 'Enter a full NVIDIA key starting with nvapi-.');
 encryptionKey();
 const c=await pool.connect();try{await c.query('begin');for(const key of values) await c.query('insert into ai_provider_keys(provider,encrypted_value,last4,fingerprint) values($1,$2,$3,$4) on conflict do nothing',[provider,encryptKey(key),key.slice(-4),crypto.createHash('sha256').update(key).digest('hex')]);await c.query('commit');}catch{await c.query('rollback');throw new Error('Could not save keys. Please try again.');}finally{c.release();}
}
export async function removeDashboardKey(id) { await pool.query('delete from ai_provider_keys where id=$1',[id]); }
