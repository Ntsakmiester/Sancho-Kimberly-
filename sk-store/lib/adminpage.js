import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from './auth';
import { permsOf } from './perms';
// Page-level permission check (the layout already requires a back-office role). Returns { user, perms }.
export async function pagePerm(perm) {
  const jar = cookies();
  const u = await getUser({ headers: { get: (k) => (k === 'cookie' ? jar.toString() : null) } });
  if (!u || !['owner', 'admin', 'staff'].includes(u.role)) redirect('/admin/login');
  const perms = await permsOf(u);
  if (perm && !perms.has(perm)) redirect('/admin/dashboard?error=' + encodeURIComponent('You do not have permission to open that page.'));
  return { user: u, perms };
}
export const pg = (sp, size = 25) => { const page = Math.max(1, parseInt(sp?.page, 10) || 1); return { page, size, offset: (page - 1) * size }; };
