import pool from '../../../../lib/db';
import { adminPost, int } from '../../../../lib/adminapi';
import { destroyUserSessions } from '../../../../lib/auth';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
// Customer notes and enable/disable. Staff need customers.view; disabling needs an admin or owner.
export const POST = adminPost('customers.view', (b) => '/admin/dashboard/customers/' + (b.id || ''), async ({ g, b, ok, err }) => {
  const id = int(b.id);
  const c = id ? (await pool.query("select id,email,active from users where id=$1 and role='customer'", [id])).rows[0] : null;
  if (!c) return err('Customer not found.', 404);
  if (b.action === 'note') {
    const n = String(b.note || '').trim().slice(0, 1000); if (!n) return err('Write a note first.');
    await pool.query('insert into customer_notes(user_id,note,author_id) values($1,$2,$3)', [id, n, g.user.id]);
    await audit('CUSTOMER_NOTE_ADDED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: c.email, entity: 'customer', entityId: id });
    return ok('Note added.');
  }
  if (b.action === 'disable' || b.action === 'enable') {
    if (g.user.role === 'staff') return err('Only an administrator can change account status.', 403);
    await pool.query('update users set active=$1 where id=$2', [b.action === 'enable', id]);
    if (b.action === 'disable') await destroyUserSessions(id);
    await audit('CUSTOMER_' + b.action.toUpperCase() + 'D', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: c.email, entity: 'customer', entityId: id, oldValue: { active: c.active }, newValue: { active: b.action === 'enable' } });
    return ok('Account updated.');
  }
  return err('Unknown action.');
});
