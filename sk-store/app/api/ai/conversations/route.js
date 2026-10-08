import { getUser } from '../../../../lib/auth';
import { listConversations } from '../../../../lib/ai/engine';
export const dynamic = 'force-dynamic';
const guestKeyOf = (req) => ((req.headers.get('cookie') || '').match(/(?:^|;\s*)sk_ai=([^;]+)/) || [])[1] || '';
export async function GET(req) {
  const user = await getUser(req);
  const rows = await listConversations({ user: user?.role === 'customer' ? user : null, guestKey: guestKeyOf(req) });
  return Response.json({ conversations: rows });
}
