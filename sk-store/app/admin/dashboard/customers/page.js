import Link from 'next/link';
import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { money } from '../../../../lib/format';
import { Table, Td, Pager } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Customers({ searchParams: spPromise }) {
  const sp = await spPromise;
  await pagePerm('customers.view');
  const { page, size, offset } = pg(sp); const q = String(sp?.q || '').trim().slice(0, 60);
  const rows = (await pool.query(`select u.id,u.name,u.email,u.active,u.created_at,(select count(*)::int from orders o where o.user_id=u.id) orders,(select coalesce(sum(total_cents),0)::bigint from orders o where o.user_id=u.id and o.payment_status in ('PAID','PARTIALLY_REFUNDED')) spent,count(*) over()::int total
    from users u where u.role='customer' and ($1='' or u.email ilike '%'||$1||'%' or u.name ilike '%'||$1||'%') order by u.id desc limit $2 offset $3`, [q, size, offset])).rows;
  return (
    <>
      <h3>Customers</h3>
      <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search" /> <button className="btn">Search</button> <a href="/api/admin/export/customers">Export CSV</a></form>
      <Table head={['Name', 'Email', 'Orders', 'Spent', 'Status', 'Joined']} count={rows.length} empty="No customers yet.">
        {rows.map((c) => <tr key={c.id}><Td><Link href={`/admin/dashboard/customers/${c.id}`}>{c.name || '(no name)'}</Link></Td><Td>{c.email}</Td><Td>{c.orders}</Td><Td>{money(Number(c.spent))}</Td><Td>{c.active ? 'Active' : 'Disabled'}</Td><Td>{new Date(c.created_at).toLocaleDateString('en-ZA')}</Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/customers?q=${encodeURIComponent(q)}`} page={page} size={size} total={rows[0]?.total} />
    </>
  );
}
