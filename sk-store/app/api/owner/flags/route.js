import pool from '../../../../lib/db';
import { requireRole, audit, ipOf } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const g = await requireRole(req, 'owner'); if (!g.user) return Response.json({ error: 'Forbidden.' }, { status: g.status });
  return Response.json({ flags: (await pool.query('select key,enabled,description from feature_flags order by key')).rows });
}
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  const b = await bodyOf(req);
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  const f = (await pool.query('select * from feature_flags where key=$1', [String(b.key || '')])).rows[0];
  if (!f) return Response.json({ error: 'Unknown feature flag.' }, { status: 404 });
  const enabled = b.enabled === 'true' || b.enabled === true || b.enabled === 'on';
  await pool.query('update feature_flags set enabled=$1, updated_by=$2, updated_at=now() where key=$3', [enabled, g.user.id, f.key]);
  await audit('FEATURE_FLAG_CHANGED', { accountId: g.user.id, role: 'owner', ip: ipOf(req), record: f.key, entity: 'feature_flag', entityId: f.key, oldValue: { enabled: f.enabled }, newValue: { enabled } });
  return isForm ? Response.redirect(new URL('/owner/dashboard/flags?saved=1', req.url), 303) : Response.json({ ok: true });
}
