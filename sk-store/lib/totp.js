import crypto from 'node:crypto';
import pool from './db';
import { encryptKey, decryptKey } from './ai/keys';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newSecret() {
  let bits = ''; for (const byte of crypto.randomBytes(20)) bits += byte.toString(2).padStart(8, '0');
  let out = ''; for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  let bits = ''; for (const c of secret.toUpperCase()) { const n = alphabet.indexOf(c); if (n < 0) throw new Error('Invalid authenticator key.'); bits += n.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest(); const offset = h[19] & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
export function matchingStep(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const step = Math.floor(now / 30000);
  for (const i of [0, -1, 1]) if (crypto.timingSafeEqual(Buffer.from(totp(secret, step + i)), Buffer.from(String(code)))) return step + i;
  return null;
}
export const recoveryHash = (code) => crypto.createHash('sha256').update(String(code || '').replace(/[\s-]/g, '').toUpperCase()).digest('hex');
export const recoveryCodes = () => Array.from({ length: 10 }, () => crypto.randomBytes(10).toString('hex').toUpperCase().match(/.{5}/g).join('-'));
export { encryptKey, decryptKey };
// Lock the account so a code or recovery code can be consumed only once.
export async function verifyOwnerMfa(userId, code, { disable = false } = {}) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const u = (await c.query("select totp_enabled,totp_secret,totp_last_step,totp_recovery_hashes from users where id=$1 and role='owner' and active for update", [userId])).rows[0];
    if (!u?.totp_enabled || !u.totp_secret) { await c.query('rollback'); return false; }
    let step = null; try { step = matchingStep(decryptKey(u.totp_secret), code); } catch { /* encrypted storage unavailable: recovery codes remain usable */ }
    const hashes = u.totp_recovery_hashes || []; const hash = recoveryHash(code);
    const recovery = hashes.includes(hash);
    if (!recovery && (step == null || step <= Number(u.totp_last_step ?? -1))) { await c.query('rollback'); return false; }
    if (disable) await c.query("update users set totp_enabled=false,totp_secret=null,totp_last_step=null,totp_pending=null,totp_pending_until=null,totp_recovery_hashes='[]' where id=$1", [userId]);
    else if (recovery) await c.query('update users set totp_recovery_hashes=$2 where id=$1', [userId, JSON.stringify(hashes.filter(h => h !== hash))]);
    else await c.query('update users set totp_last_step=$2 where id=$1', [userId, step]);
    await c.query('commit'); return true;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; }
  finally { c.release(); }
}
