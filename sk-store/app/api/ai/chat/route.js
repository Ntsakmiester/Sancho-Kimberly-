import crypto from 'node:crypto';
import { getUser, ipOf } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { respond } from '../../../../lib/ai/engine';
import { aiConfig } from '../../../../lib/ai/settings';
export const dynamic = 'force-dynamic';
const GUEST_COOKIE = 'sk_ai';

// GET: public, non-secret assistant config for the chat widget.
export async function GET() {
  const cfg = await aiConfig();
  return Response.json({ enabled: cfg.enabled, name: cfg.name, greeting: cfg.greeting, proactive: cfg.proactive });
}

export async function POST(req) {
  const user = await getUser(req);
  const b = await bodyOf(req);
  const cookie = req.headers.get('cookie') || '';
  let guestKey = (cookie.match(new RegExp('(?:^|;\\s*)' + GUEST_COOKIE + '=([^;]+)')) || [])[1];
  const isNewGuest = !user && !guestKey;
  if (isNewGuest) guestKey = crypto.randomBytes(18).toString('base64url');
  const r = await respond({
    user: user?.role === 'customer' ? user : null,
    ip: ipOf(req), guestKey,
    conversationId: String(b.conversation_id || '').slice(0, 40) || null,
    text: b.text,
    clientContext: { product_slug: String(b.product_slug || '').slice(0, 120) || null, cart_count: Math.min(99, parseInt(b.cart_count, 10) || 0) },
  });
  if (r.error === 'forbidden') return Response.json({ error: 'That conversation is not yours.' }, { status: 403 });
  const headers = {};
  if (isNewGuest) headers['set-cookie'] = `${GUEST_COOKIE}=${guestKey}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 24 * 3600}`;
  return Response.json(r, { status: r.rateLimited ? 429 : 200, headers });
}
