import Link from 'next/link';
import { requirePageRole } from '../../../lib/pageguard';
export const dynamic = 'force-dynamic';
const tabs = [['/admin/dashboard', 'Store admin'], ['/owner/dashboard/flags', 'Features'], ['/owner/dashboard/security', 'Security'], ['/owner/dashboard/health', 'Health'], ['/owner/dashboard', 'Overview'], ['/owner/dashboard/orders', 'Orders'], ['/owner/dashboard/customers', 'Customers'], ['/owner/dashboard/products', 'Products & inventory'], ['/owner/dashboard/admins', 'Admins & staff'], ['/owner/dashboard/service', 'Service & licence'], ['/owner/dashboard/audit', 'Audit log'], ['/owner/dashboard/settings', 'Settings']];
export default async function OwnerLayout({ children }) {
  const u = await requirePageRole('owner', '/owner/login');
  return (
    <section className="wrap shop owner-panel">
      <h2>Owner Control Panel</h2>
      <p className="low">Signed in as {u.email}</p>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0 20px' }}>
        {tabs.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
        <form method="post" action="/api/auth/logout" style={{ display: 'inline' }}><button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#06c', textDecoration: 'underline' }}>Log out</button></form>
      </nav>
      {children}
    </section>
  );
}
