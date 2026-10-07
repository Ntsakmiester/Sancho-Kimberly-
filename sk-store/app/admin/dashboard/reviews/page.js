import Link from 'next/link';
import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { Table, Td, Pager, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Reviews({ searchParams: sp }) {
  const { perms } = await pagePerm('reviews.view');
  const { page, size, offset } = pg(sp); const st = ['PENDING', 'APPROVED', 'REJECTED'].includes(sp?.status) ? sp.status : '';
  const rows = (await pool.query(`select r.id,r.rating,r.title,r.body,r.status,r.created_at,p.name,u.email,count(*) over()::int total from reviews r join products p on p.id=r.product_id join users u on u.id=r.user_id where ($1='' or r.status=$1) order by (r.status='PENDING') desc, r.id desc limit $2 offset $3`, [st, size, offset])).rows;
  const can = perms.has('reviews.moderate');
  return (
    <>
      <Flash sp={sp} /><h3>Reviews</h3>
      <form method="get"><select name="status" defaultValue={st} aria-label="Status"><option value="">All</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select> <button className="btn">Filter</button></form>
      <Table head={['Product', 'Rating', 'Review', 'By', 'Status', '']} count={rows.length} empty="No reviews yet.">
        {rows.map((r) => <tr key={r.id}><Td>{r.name}</Td><Td>{r.rating}/5</Td><Td><b>{r.title}</b> {r.body}</Td><Td>{r.email}</Td><Td>{r.status}</Td><Td>{can && <form method="post" action="/api/admin/reviews" style={{ display: 'flex', gap: 4 }}><input type="hidden" name="id" value={r.id} /><button className="btn" name="action" value="approve">Approve</button><button className="btn" name="action" value="reject">Reject</button></form>}</Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/reviews?status=${st}`} page={page} size={size} total={rows[0]?.total} />
    </>
  );
}
