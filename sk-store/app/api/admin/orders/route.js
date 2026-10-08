import { requestUrl } from '../../../../lib/request-url';
import pool from '../../../../lib/db';
import { adminPost, int } from '../../../../lib/adminapi';
import { requirePerm, deny } from '../../../../lib/perms';
import { changeStatus, STATUSES } from '../../../../lib/orders';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const g = await requirePerm(req, 'orders.view'); if (!g.user) return deny(g);
  const u = new URL(requestUrl(req)); const q = (u.searchParams.get('q') || '').trim(); const st = u.searchParams.get('status') || ''; const page = Math.max(1, int(u.searchParams.get('page'), 1));
  const r = await pool.query(`select id,ref,status,payment_status,name,email,total_cents,created_at,count(*) over() total from orders where ($1='' or ref ilike '%'||$1||'%' or email ilike '%'||$1||'%' or name ilike '%'||$1||'%') and ($2='' or status=$2) order by id desc limit 25 offset $3`, [q, STATUSES.includes(st) ? st : '', (page - 1) * 25]);
  return Response.json({ orders: r.rows });
}
export const POST = adminPost('orders.update', (b) => '/admin/dashboard/orders/' + (b.ref || ''), async ({ g, b, ok, err }) => {
  const o = (await pool.query('select id,ref from orders where ref=$1', [String(b.ref || '')])).rows[0];
  if (!o) return err('Order not found.', 404);
  if (b.status && b.status !== '' && !STATUSES.includes(b.status)) return err('Unknown status.');
  // payment_status / stock cannot be set from here at all: only verified payments and refunds change them.
  await changeStatus(o.id, b.status || null, { user: g.user, ip: g.ip, note: String(b.note || '').slice(0, 300), tracking: b.tracking_number, courier: b.courier, estDelivery: b.est_delivery });
  return ok('Order updated.');
});
