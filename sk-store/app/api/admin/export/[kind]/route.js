import pool from '../../../../../lib/db';
import { requirePerm, deny } from '../../../../../lib/perms';
import { toCsv, csvResponse } from '../../../../../lib/csv';
import { rangeOf } from '../../../../../lib/finance';
import { audit } from '../../../../../lib/audit';
import { rands } from '../../../../../lib/format';
export const dynamic = 'force-dynamic';
const KINDS = {
  orders: { perm: 'orders.view', sql: `select ref,status,payment_status,name,email,phone,province,subtotal_cents,discount_cents,shipping_cents,vat_cents,total_cents,coupon_code,tracking_number,created_at from orders where created_at >= $1 and created_at < $2 order by id desc limit 10000` },
  customers: { perm: 'customers.view', sql: `select u.id,u.name,u.email,u.phone,u.active,u.created_at,(select count(*) from orders o where o.user_id=u.id) orders,(select coalesce(sum(total_cents),0) from orders o where o.user_id=u.id and o.payment_status in ('PAID','PARTIALLY_REFUNDED')) spent_cents from users u where u.role='customer' and u.created_at >= $1 and u.created_at < $2 order by u.id limit 10000` },
  products: { perm: 'products.view', sql: `select p.id,p.name,p.category,p.price_cents,p.sale_price_cents,p.active,p.sku,(select coalesce(sum(qty),0) from variants v where v.product_id=p.id) stock,$1::text from_,$2::text to_ from products p where p.archived_at is null order by p.id` },
  inventory: { perm: 'inventory.view', sql: `select p.name,v.size,v.colour,v.sku,v.qty,v.active,$1::text from_,$2::text to_ from variants v join products p on p.id=v.product_id order by p.name,v.size` },
  payments: { perm: 'payments.view', sql: `select p.id,o.ref,p.provider,p.provider_ref,p.status,p.amount_cents,p.fee_cents,p.paid_at,p.created_at from payments p join orders o on o.id=p.order_id where p.created_at >= $1 and p.created_at < $2 order by p.id desc limit 10000` },
  finance: { perm: 'finance.view', sql: `select to_char((paid_at at time zone 'Africa/Johannesburg')::date,'YYYY-MM-DD') day, count(*) payments, sum(amount_cents) gross_cents, sum(coalesce(fee_cents,0)) est_fees_cents from payments where status in ('PAID','REFUNDED','PARTIALLY_REFUNDED') and paid_at >= $1 and paid_at < $2 group by 1 order by 1` },
};
export async function GET(req, { params }) {
  const k = KINDS[params.kind];
  if (!k) return Response.json({ error: 'Unknown export.' }, { status: 404 });
  const g = await requirePerm(req, k.perm); if (!g.user) return deny(g);
  if (!g.perms.has('reports.view') && !['owner', 'admin'].includes(g.user.role)) return Response.json({ error: 'Forbidden.' }, { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams); const r = rangeOf({ range: sp.range || 'custom', from: sp.from || '2000-01-01', to: sp.to || '2999-12-31' });
  const rows = (await pool.query(k.sql, [r.start, r.end])).rows;
  await audit('DATA_EXPORTED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: params.kind, entity: 'export', newValue: { rows: rows.length } });
  const cols = rows.length ? Object.keys(rows[0]).filter((c) => !['from_', 'to_'].includes(c)) : [];
  return csvResponse(`${params.kind}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(cols, rows));
}
