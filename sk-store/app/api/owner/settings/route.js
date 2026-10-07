import pool from '../../../../lib/db';
import { requireRole, audit, ipOf } from '../../../../lib/auth';
import { bodyOf } from '../../../../lib/authflow';
import { getSettings } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return Response.json({ error: g.status === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: g.status });
  const b = await bodyOf(req);
  const KEYS = ['support_email', 'store_announcement', 'store_name', 'business_email', 'business_phone', 'business_address', 'vat_rate', 'vat_registered', 'prices_include_vat', 'order_prefix', 'store_description', 'social_tiktok', 'social_instagram', 'gateway_fee_pct', 'gateway_fee_fixed_cents', 'vat_number', 'logo_url'];
  const rules = { vat_rate: /^\d{1,2}(\.\d{1,2})?$/, vat_registered: /^(true|false)$/, prices_include_vat: /^(true|false)$/, order_prefix: /^[A-Za-z0-9]{1,6}$/, gateway_fee_pct: /^\d{1,2}(\.\d{1,3})?$/, gateway_fee_fixed_cents: /^\d{1,5}$/, business_email: /^$|^\S+@\S+\.\S+$/, social_tiktok: /^$|^https:\/\//, social_instagram: /^$|^https:\/\//, logo_url: /^$|^(https:\/\/|\/)/ };
  const old = await getSettings();
  const changed = {};
  for (const k of KEYS) {
    if (b[k] !== undefined && rules[k] && !rules[k].test(String(b[k]))) return Response.json({ error: 'Invalid value for ' + k }, { status: 400 });
  }
  for (const k of KEYS) {
    if (b[k] !== undefined) { changed[k] = String(b[k]).slice(0, 300); await pool.query('insert into settings(key,value) values($1,$2) on conflict(key) do update set value=$2', [k, changed[k]]); }
  }
  await audit('SETTINGS_CHANGED', { accountId: g.user.id, role: 'owner', record: 'settings', ip: ipOf(req), entity: 'settings', oldValue: Object.fromEntries(Object.keys(changed).map((k) => [k, old[k] ?? null])), newValue: changed });
  return (req.headers.get('content-type') || '').includes('urlencoded')
    ? Response.redirect(new URL('/owner/dashboard/settings?saved=1', req.url), 303) : Response.json({ ok: true });
}
