import { requirePageRole } from '../../../../lib/pageguard';
import pool from '../../../../lib/db';
import { Table, Td, Flash } from '../../../../components/ui';
import Confirm from '../../../../components/Confirm';
export const dynamic = 'force-dynamic';
export default async function Security({ searchParams: sp }) {
  await requirePageRole('owner', '/owner/login');
  const users = (await pool.query("select u.id,u.email,u.role,(select count(*)::int from sessions s where s.user_id=u.id and s.expires_at>now()) sessions from users u where u.role in ('admin','staff','owner') order by u.id")).rows;
  const ev = (await pool.query("select created_at,action,record,result,ip from audit_log where result<>'ok' or action ilike '%LOGIN%' or action ilike '%LOCK%' order by id desc limit 30")).rows;
  return (<>
    <Flash sp={sp} /><h3>Security</h3>
    <form method="post" action="/api/owner/security"><input type="hidden" name="action" value="signout_all" /><Confirm message="Sign everyone except you out?">Sign out all other users</Confirm></form>
    <h3 style={{ marginTop: 16 }}>Active sessions</h3>
    <Table head={['Account', 'Role', 'Sessions', '']} count={users.length}>{users.map((u) => <tr key={u.id}><Td>{u.email}</Td><Td>{u.role}</Td><Td>{u.sessions}</Td><Td>{u.role !== 'owner' && <form method="post" action="/api/owner/security"><input type="hidden" name="action" value="signout_user" /><input type="hidden" name="id" value={u.id} /><button className="btn">Sign out</button></form>}</Td></tr>)}</Table>
    <h3 style={{ marginTop: 16 }}>Recent login and failure events</h3>
    <Table head={['When', 'Event', 'Account', 'Result', 'IP']} count={ev.length} empty="Nothing yet.">{ev.map((e, i) => <tr key={i}><Td>{new Date(e.created_at).toLocaleString('en-ZA')}</Td><Td>{e.action}</Td><Td>{e.record}</Td><Td>{e.result}</Td><Td>{e.ip}</Td></tr>)}</Table>
  </>);
}
