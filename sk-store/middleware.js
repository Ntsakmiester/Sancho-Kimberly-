import { validOrigin } from './lib/csrf';
import { NextResponse } from 'next/server';
// Defence in depth only. Real authorization happens server-side in every page and API handler (lib/auth.js, lib/perms.js).
// This layer turns away requests that carry no session cookie at all, and keeps back-office pages out of search engines and caches.
const OPEN = /^\/(admin|owner)\/(login|forgot-password|reset-password)$|^\/api\/(admin|owner)\/(login|forgot-password|reset-password)$/;
export function middleware(req) {
  const p = req.nextUrl.pathname;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && p !== '/api/payments/webhook' && !validOrigin(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const protectedArea = /^\/(admin|owner)(\/|$)/.test(p) || /^\/api\/(admin|owner)\//.test(p) || /^\/account(\/|$)/.test(p);
  if (protectedArea && !OPEN.test(p) && !req.cookies.get('sk_session')) {
    if (p.startsWith('/api/') || /^\/(admin|owner)\/api\//.test(p)) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    const login = p.startsWith('/owner') ? '/owner/login' : p.startsWith('/admin') ? '/admin/login' : '/login';
    return NextResponse.redirect(new URL(login, req.url));
  }
  const res = NextResponse.next();
  if (protectedArea || /^\/(admin|owner)\//.test(p)) { res.headers.set('X-Robots-Tag', 'noindex, nofollow'); res.headers.set('Cache-Control', 'no-store'); }
  return res;
}
export const config = { matcher: ['/api/:path*', '/admin/:path*', '/owner/:path*', '/api/admin/:path*', '/api/owner/:path*', '/account/:path*', '/account'] };
