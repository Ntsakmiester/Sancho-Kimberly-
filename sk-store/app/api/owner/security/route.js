import pool from '../../../../lib/db';
import { requireRole, audit, ipOf, destroyUserSessions } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
// Security actions: sign a user out everywhere, or sign everyone except the owner's current session out.
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  const b = await bodyOf(req);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const ip = ipOf(req);
  if (b.action === 'signout_user') {
    const id = parseInt(b.id, 10);
    const u = (await pool.query('select id,email from users where id=$1', [id])).rows[0];
    if (!u) return Response.json({ error: 'Not found.' }, { status: 404 });
    await destroyUserSessions(id);
    await audit('SESSIONS_REVOKED', { accountId: g.user.id, role: 'owner', ip, record: u.email, entity: 'user', entityId: id });
  } else if (b.action === 'signout_all') {
    const r = await pool.query('delete from sessions where user_id<>$1', [g.user.id]);
    await audit('SESSIONS_REVOKED', { accountId: g.user.id, role: 'owner', ip, record: 'all other users (' + r.rowCount + ')', entity: 'user' });
  } else return Response.json({ error: 'Unknown action.' }, { status: 400 });
  return isForm ? Response.redirect(new URL('/owner/dashboard/security?saved=1', req.url), 303) : Response.json({ ok: true });
}
