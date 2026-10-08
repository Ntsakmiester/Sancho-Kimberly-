import pool from './db';
import { getUser, ipOf } from './auth';
export const PERMS = ['products.view', 'products.create', 'products.edit', 'products.delete', 'inventory.view', 'inventory.edit', 'orders.view', 'orders.update', 'customers.view',
  'reviews.view', 'reviews.moderate', 'payments.view', 'refunds.create', 'finance.view', 'reports.view', 'notifications.view', 'coupons.manage', 'shipping.manage', 'contact.manage'];
export async function permsOf(user) {
  if (!user) return new Set();
  if (user.role === 'owner' || user.role === 'admin') return new Set(PERMS);
  if (user.role !== 'staff') return new Set();
  const r = await pool.query('select permission from user_permissions where user_id=$1', [user.id]);
  return new Set(r.rows.map((x) => x.permission));
}
// Server-side gate for every management API/page: signed in, a back-office role, and holding the permission.
export async function requirePerm(req, perm) {
  const u = await getUser(req);
  if (!u) return { error: 'Not authenticated.', status: 401 };
  if (!['owner', 'admin', 'staff'].includes(u.role)) return { error: 'Forbidden.', status: 403 };
  const p = await permsOf(u);
  if (perm && !p.has(perm)) return { error: 'Forbidden.', status: 403 };
  return { user: u, perms: p, ip: ipOf(req) };
}
export const deny = (g) => Response.json({ error: g.error }, { status: g.status });
