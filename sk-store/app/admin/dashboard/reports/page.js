import { pagePerm } from '../../../../lib/adminpage';
import { rangeOf, summary, bestSellers, categorySales, customerStats, trend } from '../../../../lib/finance';
import { money } from '../../../../lib/format';
import { Stats, Stat, Table, Td, RangeBar } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Reports({ searchParams: spPromise }) {
  const sp = await spPromise;
  await pagePerm('reports.view');
  const r = rangeOf(sp); const [s, best, cats, cs, t] = await Promise.all([summary(r), bestSellers(r), categorySales(r), customerStats(r), trend(r)]);
  return (
    <>
      <h3>Reports</h3><RangeBar base="/admin/dashboard/reports" sp={sp} />
      <p className="low">{r.from} to {r.to}. Real data only. Conversion rate is not shown because the store does not track visits.</p>
      <Stats><Stat label="Orders paid" value={s.successful} /><Stat label="Revenue" value={money(s.gross)} /><Stat label="Average order value" value={money(s.aov)} /><Stat label="Payment success rate" value={s.successRate == null ? 'n/a' : s.successRate + '%'} /><Stat label="Refund rate (by value)" value={s.refundRate + '%'} />
        <Stat label="Returning customers" value={`${cs.returning_buyers || 0} of ${cs.buyers || 0}`} /><Stat label="Checkouts not paid within 1h" value={cs.abandonmentRate == null ? 'n/a' : cs.abandonmentRate + '%'} /></Stats>
      <h3>Best sellers</h3><Table head={['Product', 'Units', 'Revenue']} count={best.length} empty="No sales in this period.">{best.map((b) => <tr key={b.name}><Td>{b.name}</Td><Td>{b.units}</Td><Td>{money(Number(b.revenue))}</Td></tr>)}</Table>
      <h3 style={{ marginTop: 16 }}>Category sales</h3><Table head={['Category', 'Units', 'Revenue']} count={cats.length} empty="No sales in this period.">{cats.map((b) => <tr key={b.category}><Td>{b.category}</Td><Td>{b.units}</Td><Td>{money(Number(b.revenue))}</Td></tr>)}</Table>
      <h3 style={{ marginTop: 16 }}>Sales trend</h3><Table head={['Day', 'Orders', 'Revenue']} count={t.length} empty="No sales in this period.">{t.map((x) => <tr key={x.day}><Td>{x.day}</Td><Td>{x.orders}</Td><Td>{money(Number(x.revenue))}</Td></tr>)}</Table>
      <p><a href="/api/admin/export/orders">Orders CSV</a> &middot; <a href="/api/admin/export/products">Products CSV</a> &middot; <a href="/api/admin/export/customers">Customers CSV</a></p>
    </>
  );
}
