import pool from '../../../../lib/db';
import { adminPost, int, cents } from '../../../../lib/adminapi';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
const ids = (s) => String(s || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
export const POST = adminPost('coupons.manage', '/admin/dashboard/coupons', async ({ g, b, ok, err }) => {
  const log = (a, extra) => audit(a, { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'coupon', ...extra });
  if (b.action === 'toggle') { const r = await pool.query('update coupons set active=not active where id=$1 returning code,active', [int(b.id)]); if (!r.rowCount) return err('Not found.', 404); await log('COUPON_TOGGLED', { record: r.rows[0].code, entityId: b.id, newValue: { active: r.rows[0].active } }); return ok('Updated.'); }
  const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
  const kind = b.kind === 'FIXED' ? 'FIXED' : 'PERCENT';
  let value = kind === 'FIXED' ? cents(b.value) : int(b.value);
  if (!code) return err('Enter a coupon code.');
  if (!value || Number.isNaN(value) || value <= 0 || (kind === 'PERCENT' && value > 100)) return err('Enter a valid discount value.');
  const min = cents(b.min_order) || 0;
  try {
    const r = await pool.query('insert into coupons(code,kind,value,product_ids,category_ids,min_order_cents,starts_at,ends_at,max_uses,max_uses_per_customer,first_order_only) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id',
      [code, kind, value, ids(b.product_ids).length ? ids(b.product_ids) : null, ids(b.category_ids).length ? ids(b.category_ids) : null, min, b.starts_at || null, b.ends_at || null, int(b.max_uses), int(b.max_uses_per_customer, 1), b.first_order_only === 'on']);
    await log('COUPON_CREATED', { record: code, entityId: r.rows[0].id, newValue: { kind, value } });
  } catch (e) { if (e.code === '23505') return err('That code already exists.'); throw e; }
  return ok('Coupon created.');
});
