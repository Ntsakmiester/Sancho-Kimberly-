import crypto from 'node:crypto';
import pool from '../db';
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
export async function guestIdentity(req, issue = false) {
  const raw = ((req.headers.get('cookie') || '').match(/(?:^|;\s*)sk_ai=([^;]+)/) || [])[1] || '';
  if (/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    const row = (await pool.query('select guest_key from ai_guest_sessions where token_hash=$1 and expires_at>now()', [hash(raw)])).rows[0];
    if (row) return { guestKey: row.guest_key };
  }
  if (!issue) return { guestKey: '' };
  const token = crypto.randomBytes(32).toString('base64url');
  const guestKey = crypto.randomBytes(18).toString('base64url');
  const persist = () => pool.query("insert into ai_guest_sessions(token_hash,guest_key,expires_at) values($1,$2,now()+interval '180 days')", [hash(token), guestKey]);
  // Remove expired tokens; never log bearer values.
  if (Math.random() < 0.02) pool.query('delete from ai_guest_sessions where expires_at<now()').catch(() => {});
  return { guestKey, persist, cookie: `sk_ai=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` };
}
