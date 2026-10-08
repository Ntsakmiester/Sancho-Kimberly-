import { getUser } from '../../../../../lib/auth';
import { conversationMessages, deleteConversation } from '../../../../../lib/ai/engine';
export const dynamic = 'force-dynamic';
const guestKeyOf = (req) => ((req.headers.get('cookie') || '').match(/(?:^|;\s*)sk_ai=([^;]+)/) || [])[1] || '';
const caller = async (req) => { const u = await getUser(req); return { user: u?.role === 'customer' ? u : null, guestKey: guestKeyOf(req) }; };
export async function GET(req, { params }) {
  const c = await caller(req);
  const r = await conversationMessages({ ...c, conversationId: params.id });
  if (!r) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json(r);
}
export async function DELETE(req, { params }) {
  const c = await caller(req);
  const ok = await deleteConversation({ ...c, conversationId: params.id });
  if (!ok) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
