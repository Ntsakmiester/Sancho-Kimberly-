import pool from '../../../../lib/db';
import { hashPassword } from '../../../../lib/passwords';
import { bodyOf } from '../../../../lib/authflow';
import { flag } from '../../../../lib/flags';
import { notify } from '../../../../lib/notify';
import { rateLimit } from '../../../../lib/rate';
import { ipOf, audit } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const b = await bodyOf(req);
  const isForm0 = (req.headers.get('content-type') || '').includes('urlencoded');
  const stop = (m, st) => (isForm0 ? Response.redirect(new URL('/register?error=' + encodeURIComponent(m), req.url), 303) : Response.json({ error: m }, { status: st }));
  if (!(await flag('customer_registration'))) return stop('Registration is closed right now.', 403);
  if (!(await rateLimit('register:' + ipOf(req), 10, 3600))) return stop('Too many sign-ups from this address. Please try later.', 429);
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 120);
  const pw = String(b.password || '');
  const back = '/register';
  const redir = (q) => Response.redirect(new URL(back + q, req.url), 303);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  if (!/^\S+@\S+\.\S+$/.test(email)) return isForm ? redir('?error=' + encodeURIComponent('Enter a valid email address.')) : Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (pw.length < 10) return isForm ? redir('?error=' + encodeURIComponent('Password must be at least 10 characters.')) : Response.json({ error: 'Password must be at least 10 characters.' }, { status: 400 });
  const exists = await pool.query('select 1 from users where email=$1', [email]);
  if (exists.rowCount) return isForm ? redir('?error=' + encodeURIComponent('An account with this email already exists.')) : Response.json({ error: 'An account with this email already exists.' }, { status: 409 });
  const nu = await pool.query('insert into users(email,name,password_hash,role) values($1,$2,$3,$4) returning id', [email, name, hashPassword(pw), 'customer']);
  await audit('CUSTOMER_REGISTERED', { accountId: nu.rows[0].id, role: 'customer', record: email, ip: ipOf(req), entity: 'customer', entityId: nu.rows[0].id });
  await notify({ type: 'registration', userId: nu.rows[0].id, to: email, subject: 'Welcome to Sancho Kimberly', body: `Hi ${name || 'there'},\nYour account is ready. Thanks for joining us.` });
  return isForm ? Response.redirect(new URL('/login?registered=1', req.url), 303) : Response.json({ ok: true });
}
