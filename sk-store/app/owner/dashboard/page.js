import { requirePageRole } from '../../../lib/pageguard';
import Link from 'next/link';
import pool from '../../../lib/db';
import { money } from '../../../lib/format';
import { getServiceState } from '../../../lib/service';
import { Stats, Stat } from '../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Overview() {
  await requirePageRole('owner', '/owner/login');
  const [rev, orders, customers, products, admins, staff, state] = await Promise.all([
    pool.query("select coalesce(sum(amount_cents),0)::bigint t from payments where status in ('PAID','REFUNDED','PARTIALLY_REFUNDED')"),
    pool.query('select count(*)::int c from orders'), pool.query("select count(*)::int c from users where role='customer'"),
    pool.query('select count(*)::int c from products where active and archived_at is null'),
    pool.query("select count(*)::int c from users where role='admin' and active"), pool.query("select count(*)::int c from users where role='staff' and active"), getServiceState(),
  ]);
  return <><div className="office-page-heading"><div><p className="eyebrow">OWNER OVERVIEW</p><h3>Your store, in focus</h3></div><Link className="office-action" href="/admin/dashboard">Store management &rarr;</Link></div>
    <p className="lead">Verified payments, store activity and service status.</p>
    <Stats><Stat accent label="Verified revenue · all time" value={money(Number(rev.rows[0].t))} /><Stat label="Total orders" value={orders.rows[0].c} /><Stat label="Customers" value={customers.rows[0].c} /><Stat label="Active products" value={products.rows[0].c} /><Stat label="Active administrators" value={admins.rows[0].c} /><Stat label="Active staff" value={staff.rows[0].c} /></Stats>
    <div className="service-summary"><div><p className="eyebrow">SERVICE & LICENCE</p><h3>Store status</h3></div><dl><div><dt>Site</dt><dd><span className="status-pill">{state.status}</span></dd></div><div><dt>Service payment</dt><dd>{state.payment_status}</dd></div><div><dt>Next payment</dt><dd>{state.next_payment_date ? String(state.next_payment_date).slice(0,10) : 'Not scheduled'}</dd></div></dl><Link className="office-action" href="/owner/dashboard/service">Manage service &rarr;</Link></div>
    <p className="low">Revenue is gross verified payments before fees and refunds. See Finance for net revenue. Service payment status is separate from customer checkout payments.</p>
  </>;
}
