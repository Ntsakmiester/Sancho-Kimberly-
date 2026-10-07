import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
import { normalisePhone } from '../../../../lib/config';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
export const POST = customerPost('/account', async ({ u, b, ip, ok, err }) => {
  const name = String(b.name || '').trim().slice(0, 120); const phone = b.phone ? normalisePhone(b.phone) : null;
  if (b.phone && !phone) return err('Enter a valid South African phone number.');
  await pool.query('update users set name=$1, phone=$2, updated_at=now() where id=$3', [name, phone, u.id]);
  await audit('CUSTOMER_PROFILE_UPDATED', { accountId: u.id, role: 'customer', ip, entity: 'customer', entityId: u.id });
  return ok('Profile saved.');
});
