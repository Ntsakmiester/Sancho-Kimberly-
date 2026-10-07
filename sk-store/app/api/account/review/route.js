import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
import { flag } from '../../../../lib/flags';
import { rateLimit } from '../../../../lib/rate';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
// Only a customer with a DELIVERED order containing the product can review it, once per product. Reviews wait for moderation.
export const POST = customerPost((b) => '/product/' + (b.slug || ''), async ({ u, b, ip, ok, err }) => {
  if (!(await flag('reviews'))) return err('Reviews are switched off right now.', 403);
  if (!(await rateLimit('review:' + u.id, 10, 3600))) return err('Too many reviews. Please wait.', 429);
  const p = (await pool.query('select id from products where slug=$1', [String(b.slug || '')])).rows[0];
  if (!p) return err('Product not found.', 404);
  const rating = parseInt(b.rating, 10); if (!(rating >= 1 && rating <= 5)) return err('Choose a rating from 1 to 5.');
  const body = String(b.body || '').trim().slice(0, 2000); const title = String(b.title || '').trim().slice(0, 120);
  const o = (await pool.query("select o.id from orders o join order_items i on i.order_id=o.id where o.user_id=$1 and i.product_id=$2 and o.status='DELIVERED' order by o.id desc limit 1", [u.id, p.id])).rows[0];
  if (!o) return err('You can review a product once your order for it has been delivered.', 403);
  try {
    const r = await pool.query('insert into reviews(product_id,user_id,order_id,rating,title,body,verified) values($1,$2,$3,$4,$5,$6,true) returning id', [p.id, u.id, o.id, rating, title, body]);
    await audit('REVIEW_SUBMITTED', { accountId: u.id, role: 'customer', ip, entity: 'review', entityId: r.rows[0].id });
  } catch (e) { if (e.code === '23505') return err('You have already reviewed this product.'); throw e; }
  return ok('Thanks! Your review will show once it has been approved.');
});
