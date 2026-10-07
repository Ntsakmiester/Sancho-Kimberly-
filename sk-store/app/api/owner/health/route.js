import { requireRole } from '../../../../lib/auth';
import { healthReport } from '../../../../lib/health';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const g = await requireRole(req, 'owner'); if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  return Response.json(await healthReport());
}
