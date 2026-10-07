import Link from 'next/link';
import BackofficeNav from '../../../components/BackofficeNav';
import { requirePageRole } from '../../../lib/pageguard';
export const dynamic = 'force-dynamic';
const tabs = [['/admin/dashboard', 'Store admin'], ['/owner/dashboard/flags', 'Features'], ['/owner/dashboard/security', 'Security'], ['/owner/dashboard/health', 'Health'], ['/owner/dashboard', 'Overview'], ['/owner/dashboard/orders', 'Orders'], ['/owner/dashboard/customers', 'Customers'], ['/owner/dashboard/messages', 'Message customers'], ['/owner/dashboard/products', 'Products & inventory'], ['/owner/dashboard/admins', 'Admins & staff'], ['/owner/dashboard/service', 'Service & licence'], ['/owner/dashboard/audit', 'Audit log'], ['/owner/dashboard/settings', 'Settings']];
export default async function OwnerLayout({ children }) {
  const u = await requirePageRole('owner', '/owner/login');
  return (
    <section className="wrap shop owner-panel backoffice">
      <h2>Owner Control Panel</h2>
      <p className="low">Signed in as {u.email}</p>
      <div className="office-shell"><aside><BackofficeNav items={tabs} label="Owner navigation" /></aside><div className="office-content">
      {children}
      </div></div>
    </section>
  );
}
