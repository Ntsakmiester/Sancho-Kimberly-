import pool from '../../../../lib/db';
import { hashPassword } from '../../../../lib/passwords';
import { bodyOf } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const b = await bodyOf(req);
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
  await pool.query('insert into users(email,name,password_hash,role) values($1,$2,$3,$4)', [email, name, hashPassword(pw), 'customer']);
  return isForm ? Response.redirect(new URL('/login?registered=1', req.url), 303) : Response.json({ ok: true });
}
