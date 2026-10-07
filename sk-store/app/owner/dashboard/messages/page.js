import { recentMessages } from '../../../../lib/messages';
import { Table, Td, Flash } from '../../../../components/ui';
import MessageComposer from '../../../../components/MessageComposer';
export const dynamic = 'force-dynamic';
export default async function Messages({ searchParams: sp }) {
  const rows = await recentMessages();
  return (<><Flash sp={sp} /><h3>Message customers</h3><MessageComposer back="/owner/dashboard/messages" />
    <h3 style={{ marginTop: 24 }}>Recently sent</h3>
    <Table head={['Sent', 'Subject', 'Recipients', 'Opened']} count={rows.length} empty="Nothing sent yet.">{rows.map((m, i) => <tr key={i}><Td>{new Date(m.sent_at).toLocaleString('en-ZA')}</Td><Td><b>{m.subject}</b><br /><span className="low">{m.preview}</span></Td><Td>{m.recipients}</Td><Td>{m.reads}</Td></tr>)}</Table></>);
}
