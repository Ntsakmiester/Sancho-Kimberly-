import pool from '../../../../lib/db';
import { adminPost } from '../../../../lib/adminapi';
import { audit } from '../../../../lib/audit';
import { CONTACT_KEYS, CONTACT_RULES } from '../../../../lib/contact';
export const dynamic = 'force-dynamic';
// Saves the contact details the storefront support assistant shows. Whitelisted keys only.
export const POST = adminPost('contact.manage', '/admin/dashboard/contact', async ({ g, b, ok, err }) => {
  const changed = {};
  for (const k of CONTACT_KEYS) {
    if (b[k] === undefined) continue; // only save the fields actually submitted - a partial form must not blank the rest
    const v = String(b[k]).trim().slice(0, 300);
    if (!CONTACT_RULES[k].test(v)) return err('Check the ' + k.replace('contact_', '').replace('_', ' ') + ' value.');
    changed[k] = v;
    await pool.query('insert into settings(key,value) values($1,$2) on conflict(key) do update set value=$2', [k, v]);
  }
  await audit('SETTINGS_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: 'contact details', entity: 'settings', newValue: changed });
  return ok('Contact details saved.');
});
