import pool from '../../../../lib/db';
import { adminPost, int, cents } from '../../../../lib/adminapi';
import { PROVINCES } from '../../../../lib/config';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
export const POST = adminPost('shipping.manage', '/admin/dashboard/shipping', async ({ g, b, ok, err }) => {
  const log = (a, extra) => audit(a, { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'shipping_rate', ...extra });
  if (b.action === 'toggle') { await pool.query('update shipping_rates set active=not active where id=$1', [int(b.id)]); await log('SHIPPING_RATE_TOGGLED', { entityId: b.id }); return ok('Updated.'); }
  const provinces = [].concat(b.provinces || '').join(',').split(',').filter((p) => PROVINCES.includes(p));
  const fee = cents(b.fee); const free = cents(b.free_over);
  if (!String(b.zone || '').trim() || !provinces.length) return err('Enter a zone name and choose at least one province.');
  if (fee == null || Number.isNaN(fee) || Number.isNaN(free)) return err('Enter a valid fee.');
  const vals = [String(b.zone).trim().slice(0, 80), provinces, String(b.method || 'Standard delivery').slice(0, 80), String(b.courier || '').slice(0, 80), fee, free, int(b.est_min, 3), int(b.est_max, 7)];
  if (b.action === 'update' && int(b.id)) { await pool.query('update shipping_rates set zone=$1,provinces=$2,method=$3,courier=$4,fee_cents=$5,free_over_cents=$6,est_days_min=$7,est_days_max=$8 where id=$9', [...vals, int(b.id)]); await log('SHIPPING_RATE_UPDATED', { entityId: b.id, newValue: { fee_cents: fee, free_over_cents: free } }); }
  else { const r = await pool.query('insert into shipping_rates(zone,provinces,method,courier,fee_cents,free_over_cents,est_days_min,est_days_max) values($1,$2,$3,$4,$5,$6,$7,$8) returning id', vals); await log('SHIPPING_RATE_CREATED', { entityId: r.rows[0].id }); }
  return ok('Shipping rate saved.');
});
