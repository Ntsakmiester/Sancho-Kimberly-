import pool from '../../../lib/db';
import { quote, UserError } from '../../../lib/pricing';
import { getUser, ipOf } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate';
export const dynamic = 'force-dynamic';
// Server-calculated totals for the cart/checkout display. Never trusted when the order is created (the order recalculates everything).
export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!(await rateLimit('quote:' + ipOf(req), 120, 300))) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const u = await getUser(req);
  try {
    const q = await quote(pool, { items: b.items, province: b.province || 'Gauteng', couponCode: b.coupon, userId: u?.role === 'customer' ? u.id : null, email: b.email });
    return Response.json({ subtotal: q.subtotal, discount: q.discount, shipping: q.shippingCents, total: q.total, vat: q.vat, method: q.shipping.method, estDays: [q.shipping.estMin, q.shipping.estMax], lines: q.lines.map((l) => ({ name: l.name, size: l.size, qty: l.qty, unit: l.unit })) });
  } catch (e) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e); return Response.json({ error: 'Could not calculate totals.' }, { status: 500 });
  }
}
