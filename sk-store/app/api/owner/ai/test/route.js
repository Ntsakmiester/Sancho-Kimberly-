import { requireRole } from '../../../../../lib/auth';
import { rateLimit } from '../../../../../lib/rate';
import { aiConfig } from '../../../../../lib/ai/settings';
import { testProviders } from '../../../../../lib/ai/provider';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: 'Only the owner can test AI.' }, { status: g.status || 403 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await rateLimit('ai-test:' + g.user.id, 2, 60))) return Response.json({ error: 'Wait a minute before testing again.' }, { status: 429 });
  return Response.json(await testProviders(await aiConfig()), { headers: { 'Cache-Control': 'no-store' } });
}
