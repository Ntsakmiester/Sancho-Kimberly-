import { healthReport } from '../../../../lib/health';
import { Table, Td } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Health() {
  const h = await healthReport();
  const rows = [['Database', `${h.database.status}${h.database.latency_ms != null ? ' (' + h.database.latency_ms + ' ms)' : ''}`], ['Payments', `${h.payments.provider}: ${h.payments.status}`], ['Email', `${h.email.provider}: ${h.email.status}`], ['Service state', h.service ? `${h.service.status} / ${h.service.payment_status}` : '-'],
    ['Gateway notifications (7 days)', h.webhook_failures_7d], ['Failed emails (7 days)', h.failed_emails_7d], ['Unpaid orders older than a day', h.stale_unpaid_orders], ['Orders needing stock attention', h.orders_needing_attention]];
  return (<>
    <h3>System health</h3><p className="low">Shows whether things are configured, never secrets.</p>
    <Table head={['Check', 'Status']} count={rows.length}>{rows.map(([a, b]) => <tr key={a}><Td>{a}</Td><Td>{String(b)}</Td></tr>)}</Table>
    <h3 style={{ marginTop: 16 }}>Recent system events</h3>
    <Table head={['When', 'Kind', 'Severity', 'Message']} count={h.recent_events.length} empty="None.">{h.recent_events.map((e, i) => <tr key={i}><Td>{new Date(e.created_at).toLocaleString('en-ZA')}</Td><Td>{e.kind}</Td><Td>{e.severity}</Td><Td>{e.message}</Td></tr>)}</Table>
  </>);
}
