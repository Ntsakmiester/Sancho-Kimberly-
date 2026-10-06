import pool from '../../../../lib/db';
import { requireRole, audit, ipOf, destroyUserSessions } from '../../../../lib/auth';
import { hashPassword, token } from '../../../../lib/passwords';
import { bodyOf, issueReset } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
const deny = (s) => Response.json({ error: s === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: s });
const back = (req, q) => Response.redirect(new URL('/owner/dashboard/admins' + q, req.url), 303);
export async function GET(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return deny(g.status);
  const r = await pool.query("select id,email,name,role,active,created_at from users where role in ('admin','staff') order by id");
  return Response.json({ staff: r.rows });
}
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return deny(g.status);
  const b = await bodyOf(req);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const done = (q) => (isForm ? back(req, q) : Response.json({ ok: true }));
  const failMsg = (m, s = 400) => (isForm ? back(req, '?error=' + encodeURIComponent(m)) : Response.json({ error: m }, { status: s }));
  const ip = ipOf(req);
  const action = String(b.action || 'create');
  const id = parseInt(b.id, 10);
  const target = id ? (await pool.query("select * from users where id=$1 and role in ('admin','staff')", [id])).rows[0] : null;

  if (action === 'create') {
    const email = String(b.email || '').trim().toLowerCase();
    const name = String(b.name || '').trim().slice(0, 120);
    const role = b.role === 'staff' ? 'staff' : 'admin';
    if (!/^\S+@\S+\.\S+$/.test(email)) return failMsg('Enter a valid email address.');
    if ((await pool.query('select 1 from users where email=$1', [email])).rowCount) return failMsg('That email is already in use.', 409);
    // No password is ever created, shown or emailed: the person sets their own via a single-use invitation link.
    const r = await pool.query('insert into users(email,name,password_hash,role) values($1,$2,$3,$4) returning id,email,name,role', [email, name, hashPassword(token(24)), role]);
    await audit('ADMIN_CREATED', { accountId: g.user.id, record: `${role}:${email}`, ip });
    try { await issueReset(r.rows[0], req, { resetPath: '/admin/reset-password', invite: true }); }
    catch (e) { console.error('invite email failed:', e.message); return failMsg('Account created, but the invitation email could not be sent. Check the email settings, then use Reset access to resend it.', 502); }
    return isForm ? back(req, '?created=' + encodeURIComponent(email)) : Response.json({ ok: true, invited: true });
  }
  if (!target) return failMsg('Account not found.', 404);
  if (action === 'disable') {
    await pool.query('update users set active=false where id=$1', [id]);
    await destroyUserSessions(id);
    await audit('ADMIN_DISABLED', { accountId: g.user.id, record: target.email, ip });
  } else if (action === 'reactivate') {
    await pool.query('update users set active=true where id=$1', [id]);
    await audit('ADMIN_REACTIVATED', { accountId: g.user.id, record: target.email, ip });
  } else if (action === 'remove') {
    await pool.query('delete from users where id=$1', [id]);
    await audit('ADMIN_REMOVED', { accountId: g.user.id, record: target.email, ip });
  } else if (action === 'role') {
    const role = b.role === 'staff' ? 'staff' : 'admin';
    await pool.query('update users set role=$1 where id=$2', [role, id]);
    await destroyUserSessions(id);
    await audit('SETTINGS_CHANGED', { accountId: g.user.id, record: `role:${target.email}->${role}`, ip });
  } else if (action === 'reset') {
    await destroyUserSessions(id);
    try { await issueReset(target, req, { resetPath: '/admin/reset-password' }); }
    catch (e) { console.error('reset email failed:', e.message); return failMsg('The reset email could not be sent. Check the email settings.', 502); }
    await audit('ADMIN_ACCESS_RESET', { accountId: g.user.id, record: target.email, ip });
    return isForm ? back(req, '?resetfor=' + encodeURIComponent(target.email)) : Response.json({ ok: true, emailed: true });
  } else return failMsg('Unknown action.');
  return done('?saved=1');
}
