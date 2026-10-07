import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
import { PROVINCES, normalisePhone, isSaPostal } from '../../../../lib/config';
export const dynamic = 'force-dynamic';
export const POST = customerPost('/account', async ({ u, b, ok, err }) => {
  if (b.action === 'delete') { await pool.query('delete from addresses where id=$1 and user_id=$2', [parseInt(b.id, 10) || 0, u.id]); return ok('Address removed.'); }
  const f = (k) => String(b[k] || '').trim().slice(0, 200);
  if (!f('address') || !f('suburb') || !f('city')) return err('Fill in the street, suburb and city.');
  if (!PROVINCES.includes(b.province)) return err('Choose a province.');
  if (!isSaPostal(b.postal)) return err('Enter a 4-digit postal code.');
  const phone = b.phone ? normalisePhone(b.phone) : null; if (b.phone && !phone) return err('Enter a valid South African phone number.');
  const n = (await pool.query('select count(*)::int c from addresses where user_id=$1', [u.id])).rows[0].c; if (n >= 10) return err('You can save up to 10 addresses.');
  await pool.query('insert into addresses(user_id,label,name,phone,address,suburb,city,province,postal,is_default) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [u.id, f('label'), f('name'), phone, f('address'), f('suburb'), f('city'), b.province, f('postal'), n === 0]);
  return ok('Address saved.');
});
