import { pagePerm } from '../../../../lib/adminpage';
import { rangeOf, summary, trend } from '../../../../lib/finance';
import { money } from '../../../../lib/format';
import { Stats, Stat, Table, Td, RangeBar } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Finance({ searchParams: spPromise }) {
  const sp = await spPromise;
  await pagePerm('finance.view');
  const r = rangeOf(sp); const [s, t] = await Promise.all([summary(r), trend(r)]);
  const max = Math.max(1, ...t.map((x) => Number(x.revenue)));
  return (
    <>
      <h3>Finance</h3><RangeBar base="/admin/dashboard/finance" sp={sp} />
      <p className="low">{r.from} to {r.to}. Only verified payments count. Fees are estimates from the gateway rate in settings, not actual statements.</p>
      <Stats><Stat label="Gross sales" value={money(s.gross)} /><Stat label="Successful payments" value={s.successful} /><Stat label="Pending payments" value={`${s.pendingN} (${money(s.pending)})`} /><Stat label="Failed/cancelled payments" value={s.failed} />
        <Stat label="Refunds" value={`${money(s.refunds)} (${s.refundsN})`} /><Stat label="Cancelled orders" value={s.cancelled} /><Stat label="Estimated gateway fees" value={money(s.fees)} /><Stat label="Net sales" value={money(s.net)} /><Stat label="Average order value" value={money(s.aov)} /><Stat label="Transactions" value={s.transactions} /></Stats>
      <p><a href={`/api/admin/export/finance?range=${r.key}&from=${r.from}&to=${r.to}`}>Export CSV</a></p>
      <h3>Revenue by day</h3>
      <Table head={['Day', 'Payments', 'Revenue', '']} count={t.length} empty="No verified payments in this period.">{t.map((x) => <tr key={x.day}><Td>{x.day}</Td><Td>{x.orders}</Td><Td>{money(Number(x.revenue))}</Td><Td><span style={{ display: 'inline-block', height: 10, background: '#111', width: Math.max(2, Math.round((Number(x.revenue) / max) * 200)) }} /></Td></tr>)}</Table>
    </>
  );
}
