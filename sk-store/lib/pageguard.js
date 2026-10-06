import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from './auth';
// Server-side page guard. Wrong role or no session never renders the page.
export async function requirePageRole(roleSpec, loginPath) {
  const allowed = Array.isArray(roleSpec) ? roleSpec : [roleSpec];
  const jar = cookies();
  const shim = { headers: { get: (k) => (k === 'cookie' ? jar.toString() : null) } };
  const u = await getUser(shim);
  if (!u) redirect(loginPath);
  if (!allowed.includes(u.role)) redirect(loginPath + '?error=' + encodeURIComponent('You are not allowed to access that area.'));
  return u;
}
