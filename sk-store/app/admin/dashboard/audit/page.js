import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { redirect } from 'next/navigation';
import { Table, Td, Pager } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Audit({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { user } = await pagePerm(null);
  if (user.role === 'staff') redirect('/admin/dashboard');
  const { page, size, offset } = pg(sp, 50); const q = String(sp?.q || '').trim().slice(0, 60);
  const rows = (await pool.query(`select a.created_at,a.action,a.role,a.record,a.entity,a.entity_id,a.result,a.ip,u.email who,count(*) over()::int total from audit_log a left join users u on u.id=a.account_id
    where ($1='' or a.action ilike '%'||$1||'%' or a.record ilike '%'||$1||'%') and a.action not like 'OWNER_%' order by a.id desc limit $2 offset $3`, [q, size, offset])).rows;
  return (
    <>
      <h3>Audit log</h3><p className="low">Owner security events are visible only to the owner.</p>
      <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Action or record" aria-label="Search" /> <button className="btn">Search</button></form>
      <Table head={['When', 'Who', 'Action', 'Record', 'Result']} count={rows.length} empty="Nothing logged yet.">{rows.map((a, i) => <tr key={i}><Td>{new Date(a.created_at).toLocaleString('en-ZA')}</Td><Td>{a.who || ''} {a.role ? `(${a.role})` : ''}</Td><Td>{a.action}</Td><Td>{a.record}</Td><Td>{a.result}</Td></tr>)}</Table>
      <Pager base={`/admin/dashboard/audit?q=${encodeURIComponent(q)}`} page={page} size={size} total={rows[0]?.total} />
    </>
  );
}
