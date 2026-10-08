import { guestIdentity } from '../../../../../lib/ai/guest';
import { getUser } from '../../../../../lib/auth';
import { conversationMessages, deleteConversation } from '../../../../../lib/ai/engine';
export const dynamic = 'force-dynamic';
const caller = async (req) => { const u = await getUser(req); return { user: u?.role === 'customer' ? u : null, guestKey: (await guestIdentity(req)).guestKey }; };
export async function GET(req, { params }) {
  params = await params;
  const c = await caller(req);
  const r = await conversationMessages({ ...c, conversationId: params.id });
  if (!r) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json(r);
}
export async function DELETE(req, { params }) {
  params = await params;
  const c = await caller(req);
  const ok = await deleteConversation({ ...c, conversationId: params.id });
  if (!ok) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
