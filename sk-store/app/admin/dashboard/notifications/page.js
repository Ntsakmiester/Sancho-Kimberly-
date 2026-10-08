import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { Table, Td, Pager, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Notifications({ searchParams: spPromise }) {
  const sp = await spPromise;
  await pagePerm('notifications.view');
  const { page, size, offset } = pg(sp);
  const rows = (await pool.query("select id,type,subject,body,created_at,read_at,count(*) over()::int total from notifications where audience='admin' order by id desc limit $1 offset $2", [size, offset])).rows;
  const failed = (await pool.query("select type,email_to,created_at from notifications where email_status='FAILED' order by id desc limit 10")).rows;
  return (
    <>
      <Flash sp={sp} /><h3>Notifications</h3>
      <form method="post" action="/api/admin/notifications"><button className="btn">Mark all as read</button></form>
      <Table head={['When', 'Alert', 'Details']} count={rows.length} empty="No alerts.">{rows.map((n) => <tr key={n.id}><Td>{new Date(n.created_at).toLocaleString('en-ZA')}</Td><Td>{n.read_at ? n.subject : <b>{n.subject}</b>}</Td><Td>{n.body}</Td></tr>)}</Table>
      <Pager base="/admin/dashboard/notifications?x=1" page={page} size={size} total={rows[0]?.total} />
      {failed.length > 0 && <><h3 style={{ marginTop: 16 }}>Customer emails that failed to send</h3><Table head={['When', 'Type', 'To']} count={failed.length}>{failed.map((f, i) => <tr key={i}><Td>{new Date(f.created_at).toLocaleString('en-ZA')}</Td><Td>{f.type}</Td><Td>{f.email_to}</Td></tr>)}</Table></>}
    </>
  );
}
