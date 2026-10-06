import pool from '../../../../lib/db';
import { requireRole, audit, ipOf } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  const b = await bodyOf(req);
  for (const k of ['support_email', 'store_announcement']) {
    if (b[k] !== undefined) await pool.query('insert into settings(key,value) values($1,$2) on conflict(key) do update set value=$2', [k, String(b[k]).slice(0, 300)]);
  }
  await audit('SETTINGS_CHANGED', { accountId: g.user.id, record: 'settings', ip: ipOf(req) });
  return (req.headers.get('content-type') || '').includes('urlencoded')
    ? Response.redirect(new URL('/owner/dashboard/settings?saved=1', req.url), 303) : Response.json({ ok: true });
}
