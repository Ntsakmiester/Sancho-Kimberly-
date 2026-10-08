import { guestIdentity } from '../../../../lib/ai/guest';
import { getUser } from '../../../../lib/auth';
import { listConversations } from '../../../../lib/ai/engine';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const user = await getUser(req);
  const rows = await listConversations({ user: user?.role === 'customer' ? user : null, guestKey: (await guestIdentity(req)).guestKey });
  return Response.json({ conversations: rows });
}
