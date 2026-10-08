import { validOrigin, rejectOrigin } from './csrf';
import pool from './db';
import { hashPassword, verifyPassword, token, sha256 } from './passwords';
import { audit } from './audit';
export const ROLES = ['owner', 'admin', 'staff', 'customer'];
const COOKIE = 'sk_session';
const SESSION_HOURS = { owner: 8, admin: 24, staff: 24, customer: 24 * 7 };
const RESET_MINUTES = 30;
const MAX_FAILS_EMAIL = 5, MAX_FAILS_IP = 20, WINDOW_MIN = 15;

export const ipOf = (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';

export function cookieHeader(t, maxAgeSec) {
  const parts = [`${COOKIE}=${t}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
export const clearCookieHeader = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function createSession(userId, req) {
  const t = token(32);
  const hours = SESSION_HOURS[(await roleOf(userId))] || 24;
  await pool.query('insert into sessions(user_id,token_hash,expires_at,ip,user_agent) values($1,$2,now()+($3||\' hours\')::interval,$4,$5)',
    [userId, sha256(t), String(hours), ipOf(req), String(req.headers.get('user-agent') || '').slice(0, 300)]);
  return { token: t, maxAge: hours * 3600 };
}
async function roleOf(userId) {
  return (await pool.query('select role from users where id=$1', [userId])).rows[0]?.role;
}
export async function destroySession(req) {
  const t = readToken(req);
  if (t) await pool.query('delete from sessions where token_hash=$1', [sha256(t)]);
}
export const destroyUserSessions = (userId) => pool.query('delete from sessions where user_id=$1', [userId]);
function readToken(req) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}
export async function getUser(req) {
  const t = readToken(req);
  if (!t) return null;
  const r = await pool.query(
    `select u.id,u.email,u.name,u.role,u.active from sessions s join users u on u.id=s.user_id
     where s.token_hash=$1 and s.expires_at>now() and u.active`, [sha256(t)]);
  return r.rows[0] || null;
}
// Server-side authorization: the only gate that matters. Pages redirect, APIs reject.
export async function requireRole(req, role) {
  const u = await getUser(req);
  if (!u) return { error: 'unauthenticated', status: 401 };
  if (u.role !== role) return { error: 'forbidden', status: 403 };
  if (req.method && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !validOrigin(req)) return { error: 'invalid_origin', status: 403 };
  return { user: u };
}
export { hashPassword, verifyPassword, token, sha256, audit, RESET_MINUTES, MAX_FAILS_EMAIL, MAX_FAILS_IP, WINDOW_MIN };
