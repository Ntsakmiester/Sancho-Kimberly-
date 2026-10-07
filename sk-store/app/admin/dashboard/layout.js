import Link from 'next/link';
import { cookies } from 'next/headers';
import { requirePageRole } from '../../../lib/pageguard';
import { permsOf } from '../../../lib/perms';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin | Sancho Kimberly', robots: { index: false, follow: false } };
const NAV = [['/admin/dashboard', 'Dashboard', null], ['/admin/dashboard/products', 'Products', 'products.view'], ['/admin/dashboard/inventory', 'Inventory', 'inventory.view'], ['/admin/dashboard/orders', 'Orders', 'orders.view'],
  ['/admin/dashboard/customers', 'Customers', 'customers.view'], ['/admin/dashboard/reviews', 'Reviews', 'reviews.view'], ['/admin/dashboard/payments', 'Payments', 'payments.view'], ['/admin/dashboard/finance', 'Finance', 'finance.view'],
  ['/admin/dashboard/reports', 'Reports', 'reports.view'], ['/admin/dashboard/coupons', 'Coupons', 'coupons.manage'], ['/admin/dashboard/shipping', 'Shipping', 'shipping.manage'], ['/admin/dashboard/notifications', 'Notifications', 'notifications.view'], ['/admin/dashboard/audit', 'Audit log', 'audit']];
export default async function AdminLayout({ children }) {
  const u = await requirePageRole(['owner', 'admin', 'staff'], '/admin/login');
  const perms = await permsOf(u);
  return (
    <section className="wrap shop owner-panel">
      <h2>{u.role === 'owner' ? 'Store management' : 'Administrator dashboard'}</h2>
      <p className="low">Signed in as {u.email} ({u.role}){u.role === 'owner' && <> &middot; <Link href="/owner/dashboard">Owner panel</Link></>}</p>
      <nav aria-label="Admin" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0 20px' }}>
        {NAV.filter(([, , p]) => !p || (p === 'audit' ? u.role !== 'staff' : perms.has(p))).map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
        <form method="post" action="/api/auth/logout" style={{ display: 'inline' }}><button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#06c', textDecoration: 'underline' }}>Log out</button></form>
      </nav>
      {children}
    </section>
  );
}
