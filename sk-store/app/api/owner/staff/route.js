import pool from '../../../../lib/db';
import { requireRole, audit, ipOf, destroyUserSessions } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { ALL_PERMS } from '../../../../lib/perms';
export const dynamic = 'force-dynamic';
// Only the OWNER can grant or remove staff permissions.
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  const b = await bodyOf(req);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const id = parseInt(b.id, 10);
  const target = (await pool.query("select id,email from users where id=$1 and role in ('admin','staff')", [id])).rows[0];
  if (!target) return isForm ? Response.redirect(new URL('/owner/dashboard/admins?error=Staff+account+not+found.', req.url), 303) : Response.json({ error: 'Account not found.' }, { status: 404 });
  const wanted = [].concat(b.permissions || []).flatMap((x) => String(x).split(',')).filter((p) => ALL_PERMS.includes(p));
  const old = (await pool.query('select permission from user_permissions where user_id=$1 order by 1', [id])).rows.map((r) => r.permission);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from user_permissions where user_id=$1', [id]);
    for (const p of wanted) await client.query('insert into user_permissions(user_id,permission,granted_by) values($1,$2,$3)', [id, p, g.user.id]);
    await client.query('commit');
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
  await audit('STAFF_PERMISSIONS_CHANGED', { accountId: g.user.id, role: 'owner', ip: ipOf(req), record: target.email, entity: 'staff', entityId: id, oldValue: { permissions: old }, newValue: { permissions: wanted.sort() } });
  return isForm ? Response.redirect(new URL('/owner/dashboard/admins?saved=1', req.url), 303) : Response.json({ ok: true, permissions: wanted });
}
