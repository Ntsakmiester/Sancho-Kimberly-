import { requestUrl } from './request-url';
import { verifyOwnerMfa } from './totp';
import pool from './db';
import { hashPassword, verifyPassword, token, sha256 } from './passwords';
import { audit } from './audit';
import { createSession, destroySession, destroyUserSessions, cookieHeader, clearCookieHeader, ipOf, RESET_MINUTES, MAX_FAILS_EMAIL, MAX_FAILS_IP, WINDOW_MIN } from './auth';
import { sendPasswordResetEmail } from './email';

export const MIN_PASSWORD = 10;
const json = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: h });
const roles_ = (r) => (Array.isArray(r) ? r : [r]);
const label = (r) => roles_(r)[0].toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DUMMY = hashPassword('timing-equaliser'); // so unknown emails cost the same time as wrong passwords
// HTML form posts get redirects back to the right page; fetch/XHR gets JSON.
const wantsRedirect = (req) => (req.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
const fail = (req, msg, status, back) =>
  wantsRedirect(req) ? Response.redirect(new URL(back + '?error=' + encodeURIComponent(msg), requestUrl(req)), 303) : json({ error: msg }, status);

export async function bodyOf(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(await req.formData());
  try { return await req.json(); } catch { return {}; }
}

// Lockout is per email+IP, so a stranger cannot lock the real owner out from elsewhere;
// there are also caps per email overall (distributed guessing) and per IP.
async function tooManyAttempts(email, ip) {
  const w = `and not success and created_at > now() - interval '${WINDOW_MIN} minutes'`;
  const c = async (where, p) => (await pool.query(`select count(*)::int c from login_attempts where ${where} ${w}`, p)).rows[0].c;
  const [pair, em, byIp] = await Promise.all([c('email=$1 and ip=$2', [email, ip]), c('email=$1', [email]), c('ip=$1', [ip])]);
  return pair >= MAX_FAILS_EMAIL || em >= MAX_FAILS_EMAIL * 4 || byIp >= MAX_FAILS_IP;
}

// One login flow per area. A valid account of a DIFFERENT role is rejected here too.
export function loginHandler(roleSpec, { back, next }) {
  const roles = roles_(roleSpec);
  return async (req) => {
    const b = await bodyOf(req);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const ip = ipOf(req);
    const bad = async (why) => {
      await pool.query('insert into login_attempts(email,ip,success) values($1,$2,false)', [email, ip]);
      await audit(`${label(roleSpec)}_LOGIN`, { record: email, ip, result: 'denied: ' + why });
      return fail(req, 'Invalid email or password.', 401, back);
    };
    if (password.length > 200) return fail(req, 'Password is too long.', 400, back);
    if (!email || !password) return fail(req, 'Enter your email and password.', 400, back);
    if (await tooManyAttempts(email, ip)) {
      await audit(`${label(roleSpec)}_LOGIN`, { record: email, ip, result: 'rate_limited' });
      return fail(req, 'Too many attempts. Please wait a few minutes and try again.', 429, back);
    }
    const u = (await pool.query('select * from users where email=$1', [email])).rows[0];
    const okPw = verifyPassword(password, u ? u.password_hash : DUMMY);
    if (!u || !roles.includes(u.role) || !u.active || !okPw) return bad(!u ? 'no_account' : !roles.includes(u.role) ? 'wrong_role' : !u.active ? 'disabled' : 'bad_password');
    if (u.role === 'owner' && u.totp_enabled && !(await verifyOwnerMfa(u.id, String(b.code || '').trim()))) return bad('mfa_required_or_invalid');
    await pool.query('insert into login_attempts(email,ip,success) values($1,$2,true)', [email, ip]);
    const s = await createSession(u.id, req);
    await audit(`${label(roleSpec)}_LOGIN`, { accountId: u.id, record: email, ip });
    const dest = new URL(next, requestUrl(req));
    return wantsRedirect(req)
      ? new Response(null, { status: 303, headers: { Location: dest.toString(), 'Set-Cookie': cookieHeader(s.token, s.maxAge) } })
      : json({ ok: true, role: u.role }, 200, { 'Set-Cookie': cookieHeader(s.token, s.maxAge) });
  };
}

export function logoutHandler(role, { back }) {
  return async (req) => {
    const { getUser } = await import('./auth');
    const u = await getUser(req);
    await destroySession(req);
    if (u) await audit(`${(role || u.role).toUpperCase()}_LOGOUT`, { accountId: u.id, ip: ipOf(req) });
    return wantsRedirect(req)
      ? new Response(null, { status: 303, headers: { Location: new URL(back, requestUrl(req)).toString(), 'Set-Cookie': clearCookieHeader() } })
      : json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
  };
}

// Links never trust the Host header in production: set APP_BASE_URL (Vercel's production URL is the fallback).
export function baseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return process.env.NODE_ENV === 'production' ? null : new URL(requestUrl(req)).origin;
}
// Creates a single-use, 30-minute token (stored only as a hash) and emails the link. Used for resets and invitations.
export async function issueReset(u, req, { resetPath, invite = false }) {
  const base = baseUrl(req);
  if (!base) throw new Error('APP_BASE_URL is not set');
  await pool.query('update password_reset_tokens set used_at=now() where user_id=$1 and used_at is null', [u.id]);
  const t = token(32);
  await pool.query("insert into password_reset_tokens(user_id,token_hash,expires_at) values($1,$2,now()+($3||' minutes')::interval)", [u.id, sha256(t), String(RESET_MINUTES)]);
  await sendPasswordResetEmail({ to: u.email, name: u.name, role: u.role === 'staff' ? 'admin' : u.role, url: `${base}${resetPath}?token=${t}`, minutes: RESET_MINUTES, invite });
}

const GENERIC = 'If an account exists for this email address, you will receive a password reset link.';
// Never reveals whether the email exists. Limits: 3 links per account per hour, 30 requests per IP per 15 minutes.
export function forgotHandler(roleSpec, { back, resetPath }) {
  const roles = roles_(roleSpec);
  return async (req) => {
    const t0 = Date.now();
    const b = await bodyOf(req);
    const email = String(b.email || '').trim().toLowerCase();
    const ip = ipOf(req);
    if (!email) return fail(req, 'Enter your email address.', 400, back);
    const recent = (await pool.query("select count(*)::int c from audit_log where ip=$1 and record like 'requested%' and created_at > now() - interval '15 minutes'", [ip])).rows[0].c;
    if (recent >= 30) return fail(req, 'Too many requests. Please wait a few minutes and try again.', 429, back);
    const u = (await pool.query('select * from users where email=$1 and role=any($2) and active', [email, roles])).rows[0];
    let sent = false;
    if (u) {
      const n = (await pool.query("select count(*)::int c from password_reset_tokens where user_id=$1 and created_at > now() - interval '1 hour'", [u.id])).rows[0].c;
      if (n < 3) {
        try { await issueReset(u, req, { resetPath }); sent = true; } catch (e) { console.error('reset email failed:', e.message); }
      }
    }
    await audit(`${label(roleSpec)}_PASSWORD_RESET`, { accountId: u ? u.id : null, record: u ? (sent ? 'requested' : 'requested (not sent)') : 'requested (no such account)', ip, result: u ? 'ok' : 'no_account' });
    const wait = 800 - (Date.now() - t0); // even out response time whether or not an email was sent
    if (wait > 0) await sleep(wait);
    return wantsRedirect(req) ? Response.redirect(new URL(back + '?sent=1', requestUrl(req)), 303) : json({ message: GENERIC });
  };
}

// Token is stored only as a hash; it expires, is claimed atomically (single-use even under parallel requests),
// only works for active accounts of the right area, and ends every existing session.
export function resetHandler(roleSpec, { back, loginPath }) {
  const roles = roles_(roleSpec);
  return async (req) => {
    const b = await bodyOf(req);
    const t = String(b.token || '');
    const pw = String(b.password || '');
    const ip = ipOf(req);
    const bad = (m) => fail(req, m, 400, back + '?token=' + encodeURIComponent(t));
    if (!t) return fail(req, 'Missing reset token.', 400, back);
    if (pw.length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (pw.length > 200) return bad('Password is too long.');
    const client = await pool.connect();
    let uid;
    try {
      await client.query('begin');
      const c = await client.query('update password_reset_tokens p set used_at=now() from users u where u.id=p.user_id and p.token_hash=$1 and p.used_at is null and p.expires_at>now() and u.role=any($2) and u.active returning p.user_id', [sha256(t), roles]);
      if (!c.rowCount) {
        await client.query('rollback');
        const r = (await pool.query('select p.used_at,p.expires_at,u.active from password_reset_tokens p join users u on u.id=p.user_id where p.token_hash=$1 and u.role=any($2)', [sha256(t), roles])).rows[0];
        if (!r || !r.active) return fail(req, 'This reset link is invalid.', 400, back);
        if (r.used_at) return fail(req, 'This reset link has already been used. Please request a new one.', 400, back);
        return fail(req, 'This reset link has expired. Please request a new one.', 400, back);
      }
      uid = c.rows[0].user_id;
      await client.query('update users set password_hash=$1 where id=$2', [hashPassword(pw), uid]);
      await client.query('delete from sessions where user_id=$1', [uid]);
      await client.query('update password_reset_tokens set used_at=now() where user_id=$1 and used_at is null', [uid]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      console.error(e);
      return fail(req, 'Something went wrong. Please try again.', 500, back);
    } finally { client.release(); }
    await audit(`${label(roleSpec)}_PASSWORD_RESET`, { accountId: uid, record: 'completed', ip });
    return wantsRedirect(req) ? Response.redirect(new URL(loginPath + '?reset=1', requestUrl(req)), 303) : json({ ok: true, message: 'Password updated. Please log in again.' });
  };
}
