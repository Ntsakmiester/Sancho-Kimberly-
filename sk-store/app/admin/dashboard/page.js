import Link from 'next/link';
import { pagePerm } from '../../../lib/adminpage';
import { dashboardStats } from '../../../lib/finance';
import { money } from '../../../lib/format';
import { Stats, Stat, Flash } from '../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function AdminHome({ searchParams }) {
  const { perms } = await pagePerm(null);
  const s = await dashboardStats();
  const fin = perms.has('finance.view');
  return (
    <>
      <Flash sp={searchParams} />
      <div className="office-page-heading"><div><p className="eyebrow">STORE OVERVIEW</p><h3>At a glance</h3></div><Link className="office-action" href="/admin/dashboard/orders">View orders &rarr;</Link></div>
      <p className="low">All figures come from the database. Revenue counts verified payments only.</p>
      <Stats>
        {fin && <><Stat accent label="Today's revenue" value={money(s.today)} /><Stat accent label="Last 7 days" value={money(s.week)} /><Stat accent label="This month" value={money(s.month)} /></>}
        <Stat label="Total orders" value={s.orders} /><Stat label="Pending orders" value={s.pending} /><Stat label="Paid orders" value={s.paid} />
        <Stat label="Customers" value={s.customers} /><Stat label="Products" value={s.products} />
        <Stat label="Low stock" value={s.low} /><Stat label="Out of stock" value={s.out} /><Stat label="Failed payments" value={s.failed} /><Stat label="Open refunds" value={s.refunds} />
      </Stats>
      {s.low + s.out > 0 && perms.has('inventory.view') && <p><Link href="/admin/dashboard/inventory?filter=low">Review low and out-of-stock items</Link></p>}
    </>
  );
}
