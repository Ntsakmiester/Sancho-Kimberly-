import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '../../../../../lib/db';
import { pagePerm } from '../../../../../lib/adminpage';
import { money } from '../../../../../lib/format';
import { Table, Td, Flash } from '../../../../../components/ui';
import Confirm from '../../../../../components/Confirm';
export const dynamic = 'force-dynamic';
export default async function Customer({ params: paramsPromise, searchParams: spPromise }) {
  const params = await paramsPromise;
  const sp = await spPromise;
  const { user } = await pagePerm('customers.view');
  const id = parseInt(params.id, 10); const c = id ? (await pool.query("select id,name,email,phone,active,created_at from users where id=$1 and role='customer'", [id])).rows[0] : null; if (!c) notFound();
  const orders = (await pool.query('select ref,status,payment_status,total_cents,created_at from orders where user_id=$1 order by id desc limit 50', [id])).rows;
  const addrs = (await pool.query('select * from addresses where user_id=$1', [id])).rows;
  const notes = (await pool.query('select n.*,u.email who from customer_notes n left join users u on u.id=n.author_id where n.user_id=$1 order by n.id desc', [id])).rows;
  const spent = orders.filter((o) => ['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status)).reduce((s, o) => s + o.total_cents, 0);
  return (
    <>
      <Flash sp={sp} /><h3>{c.name || c.email}</h3>
      <p>{c.email}{c.phone ? ' · ' + c.phone : ''} &middot; {c.active ? 'Active' : 'Disabled'} &middot; joined {new Date(c.created_at).toLocaleDateString('en-ZA')} &middot; {orders.length} orders &middot; spent {money(spent)}</p>
      {user.role !== 'staff' && <form method="post" action="/api/admin/customers"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={c.active ? 'disable' : 'enable'} /><Confirm message={c.active ? 'Disable this account? They will be signed out.' : 'Re-enable this account?'}>{c.active ? 'Disable account' : 'Enable account'}</Confirm></form>}
      <h3 style={{ marginTop: 16 }}>Addresses</h3>{addrs.length ? addrs.map((a) => <p key={a.id}>{a.address}, {a.suburb}, {a.city}, {a.province}, {a.postal}</p>) : <p className="low">None saved.</p>}
      <h3>Orders</h3>
      <Table head={['Ref', 'Status', 'Payment', 'Total', 'Placed']} count={orders.length}>{orders.map((o) => <tr key={o.ref}><Td><Link href={`/admin/dashboard/orders/${o.ref}`}>{o.ref}</Link></Td><Td>{o.status}</Td><Td>{o.payment_status}</Td><Td>{money(o.total_cents)}</Td><Td>{new Date(o.created_at).toLocaleDateString('en-ZA')}</Td></tr>)}</Table>
      <h3 style={{ marginTop: 16 }}>Notes</h3>
      {notes.map((n) => <p key={n.id}>{n.note} <span className="low">- {n.who}, {new Date(n.created_at).toLocaleDateString('en-ZA')}</span></p>)}
      <form method="post" action="/api/admin/customers" style={{ maxWidth: 480 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="note" /><textarea name="note" rows={2} style={{ width: '100%' }} required aria-label="Note" /><button className="btn">Add note</button></form>
    </>
  );
}
