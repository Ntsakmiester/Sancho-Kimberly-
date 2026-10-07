import Link from 'next/link';
import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { money } from '../../../../lib/format';
import { STATUSES } from '../../../../lib/orders';
import { Table, Td, Pager, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Orders({ searchParams: sp }) {
  await pagePerm('orders.view');
  const { page, size, offset } = pg(sp); const q = String(sp?.q || '').trim().slice(0, 60); const st = STATUSES.includes(sp?.status) ? sp.status : '';
  const rows = (await pool.query(`select ref,status,payment_status,name,total_cents,created_at,count(*) over()::int total from orders where ($1='' or ref ilike '%'||$1||'%' or email ilike '%'||$1||'%' or name ilike '%'||$1||'%') and ($2='' or status=$2) order by id desc limit $3 offset $4`, [q, st, size, offset])).rows;
  return (
    <>
      <Flash sp={sp} /><h3>Orders</h3>
      <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Reference, name or email" aria-label="Search orders" /> <select name="status" defaultValue={st} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select> <button className="btn">Filter</button> <a href="/api/admin/export/orders">Export CSV</a></form>
      <Table head={['Reference', 'Customer', 'Status', 'Payment', 'Total', 'Placed']} count={rows.length} empty="No orders match.">
        {rows.map((o) => <tr key={o.ref}><Td><Link href={`/admin/dashboard/orders/${o.ref}`}>{o.ref}</Link></Td><Td>{o.name}</Td><Td>{o.status}</Td><Td>{o.payment_status}</Td><Td>{money(o.total_cents)}</Td><Td>{new Date(o.created_at).toLocaleString('en-ZA')}</Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/orders?q=${encodeURIComponent(q)}&status=${st}`} page={page} size={size} total={rows[0]?.total} />
    </>
  );
}
