import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
import { verifyPassword, hashPassword, destroyUserSessions, createSession, cookieHeader } from '../../../../lib/auth';
import { audit } from '../../../../lib/audit';
import { rateLimit } from '../../../../lib/rate';
import { notify } from '../../../../lib/notify';
export const dynamic = 'force-dynamic';
// Changing the password ends every other session and starts a fresh one for this browser.
export const POST = customerPost('/account', async ({ req, u, b, ip, err }) => {
  if (!(await rateLimit('pwchange:' + u.id, 5, 900))) return err('Too many attempts. Please wait.', 429);
  const row = (await pool.query('select password_hash,email,name from users where id=$1', [u.id])).rows[0];
  if (!verifyPassword(String(b.current || ''), row.password_hash)) return err('Your current password is not correct.');
  const pw = String(b.password || '');
  if (pw.length < 10 || pw.length > 200) return err('New password must be at least 10 characters.');
  await pool.query('update users set password_hash=$1, updated_at=now() where id=$2', [hashPassword(pw), u.id]);
  await destroyUserSessions(u.id);
  const s = await createSession(u.id, req);
  await audit('CUSTOMER_PASSWORD_CHANGED', { accountId: u.id, role: 'customer', ip, entity: 'customer', entityId: u.id });
  await notify({ type: 'security_alert', userId: u.id, to: row.email, subject: 'Your password was changed', body: `Hi ${row.name || ''},\nThe password on your account was just changed. If this was not you, reset it straight away.` });
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const h = { 'Set-Cookie': cookieHeader(s.token, s.maxAge) };
  return isForm ? new Response(null, { status: 303, headers: { ...h, Location: new URL('/account?saved=Password+changed.', req.url).toString() } }) : Response.json({ ok: true }, { headers: h });
});
