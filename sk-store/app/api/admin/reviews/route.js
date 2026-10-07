import pool from '../../../../lib/db';
import { adminPost, int } from '../../../../lib/adminapi';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
export const POST = adminPost('reviews.moderate', '/admin/dashboard/reviews', async ({ g, b, ok, err }) => {
  const st = { approve: 'APPROVED', reject: 'REJECTED', pending: 'PENDING' }[b.action];
  if (!st) return err('Unknown action.');
  const r = await pool.query('update reviews set status=$1, moderated_by=$2 where id=$3 returning id,product_id', [st, g.user.id, int(b.id)]);
  if (!r.rowCount) return err('Review not found.', 404);
  await audit('REVIEW_' + st, { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'review', entityId: r.rows[0].id });
  return ok('Review ' + st.toLowerCase() + '.');
});
