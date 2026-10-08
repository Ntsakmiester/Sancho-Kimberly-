import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser } from './auth';
import { permsOf, AI_PERMS } from './perms';
// Page guard for the AI section: any back-office user holding at least one AI permission.
export async function aiPagePerm(perm) {
  const jar = await cookies();
  const u = await getUser({ headers: { get: (k) => (k === 'cookie' ? jar.toString() : null) } });
  if (!u || !['owner', 'admin', 'staff'].includes(u.role)) redirect('/admin/login');
  const perms = await permsOf(u);
  if (!AI_PERMS.some((p) => perms.has(p))) redirect('/admin/dashboard?error=' + encodeURIComponent('You do not have permission to open that page.'));
  if (perm && !perms.has(perm)) redirect('/admin/dashboard/ai?error=' + encodeURIComponent('You do not have permission to open that page.'));
  return { user: u, perms };
}
export function AiTabs({ perms, active }) {
  const tabs = [
    ['/admin/dashboard/ai', 'Overview', 'ai.view'],
    ['/admin/dashboard/ai/conversations', 'Conversations', 'ai.conversations'],
    ['/admin/dashboard/ai/tickets', 'Support tickets', 'ai.tickets'],
    ['/admin/dashboard/ai/knowledge', 'Knowledge base', 'ai.knowledge'],
    ['/admin/dashboard/ai/bots', 'AI bots', 'ai.bots'],
    ['/admin/dashboard/ai/analytics', 'Analytics', 'ai.analytics'],
  ].filter(([, , p]) => perms.has(p));
  return <div className="chips" style={{ marginBottom: 20 }}>{tabs.map(([href, text]) => <Link key={href} href={href} className={active === href ? 'chip-on' : ''} style={{ textDecoration: 'none' }}>{text}</Link>)}</div>;
}
