import { requestUrl } from './request-url';
import { validOrigin, rejectOrigin } from './csrf';
import { getUser, ipOf } from './auth';
import { bodyOf } from './authflow';
// Wrapper for logged-in customer endpoints. Every handler gets the session user and may only touch rows that user owns.
export function customerPost(back, fn) {
  return async (req) => {
    if (!validOrigin(req)) return rejectOrigin();
    const u = await getUser(req);
    if (!u || u.role !== 'customer') return Response.json({ error: u ? 'Forbidden.' : 'Not authenticated.' }, { status: u ? 403 : 401 });
    const b = await bodyOf(req);
    const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
    const to = typeof back === 'function' ? back(b) : back;
    const reply = (q, status) => (isForm ? Response.redirect(new URL(to + (to.includes('?') ? '&' : '?') + q, requestUrl(req)), 303) : Response.json({ ok: !q.startsWith('error'), message: decodeURIComponent(q.split('=').slice(1).join('=')) }, { status: q.startsWith('error') ? status || 400 : 200 }));
    try { return await fn({ req, u, b, ip: ipOf(req), ok: (m = 'Saved.') => reply('saved=' + encodeURIComponent(m)), err: (m, s) => reply('error=' + encodeURIComponent(m), s) }); }
    catch (e) { console.error(e); return reply('error=' + encodeURIComponent('Something went wrong.'), 500); }
  };
}
