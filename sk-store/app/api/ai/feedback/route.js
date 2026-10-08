import { guestIdentity } from '../../../../lib/ai/guest';
import { getUser } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { recordFeedback } from '../../../../lib/ai/engine';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const user = await getUser(req);
  const { guestKey } = await guestIdentity(req);
  const b = await bodyOf(req);
  const ok = await recordFeedback({ user: user?.role === 'customer' ? user : null, guestKey, messageId: parseInt(b.message_id, 10), rating: parseInt(b.rating, 10), note: b.note });
  if (!ok) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
