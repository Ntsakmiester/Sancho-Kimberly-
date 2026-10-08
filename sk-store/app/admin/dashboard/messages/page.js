import { pagePerm } from '../../../../lib/adminpage';
import { recentMessages } from '../../../../lib/messages';
import { Table, Td, Flash } from '../../../../components/ui';
import MessageComposer from '../../../../components/MessageComposer';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Messages({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { user } = await pagePerm('notifications.view');
  if (user.role === 'staff') redirect('/admin/dashboard?error=' + encodeURIComponent('Only the owner or an administrator can message customers.'));
  const rows = await recentMessages();
  return (<><Flash sp={sp} /><h3>Message customers</h3><MessageComposer back="/admin/dashboard/messages" />
    <h3 style={{ marginTop: 24 }}>Recently sent</h3>
    <Table head={['Sent', 'Subject', 'Recipients', 'Opened']} count={rows.length} empty="Nothing sent yet.">{rows.map((m, i) => <tr key={i}><Td>{new Date(m.sent_at).toLocaleString('en-ZA')}</Td><Td><b>{m.subject}</b><br /><span className="low">{m.preview}</span></Td><Td>{m.recipients}</Td><Td>{m.reads}</Td></tr>)}</Table></>);
}
