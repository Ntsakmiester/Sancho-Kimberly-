import { validOrigin, rejectOrigin } from './csrf';
import { requirePerm, deny } from './perms';
import { bodyOf } from './authflow';
// Shared wrapper for back-office POST endpoints: server-side permission check, parsed body, redirect-or-JSON reply.
export function adminPost(perm, back, fn) {
  return async (req) => {
    if (!validOrigin(req)) return rejectOrigin();
    const g = await requirePerm(req, perm);
    if (!g.user) return deny(g);
    const isMultipart = (req.headers.get('content-type') || '').includes('multipart/form-data');
    const form = isMultipart ? await req.formData() : null;
    const b = form ? Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')) : await bodyOf(req);
    const isForm = isMultipart || (req.headers.get('content-type') || '').includes('urlencoded');
    const to = (typeof back === 'function' ? back(b) : back);
    const reply = (q, extra = {}) => (isForm ? new Response(null, { status: 303, headers: { Location: to + (to.includes('?') ? '&' : '?') + q } }) : Response.json({ ok: !q.startsWith('error'), message: q, ...extra }, { status: q.startsWith('error') ? (extra.status || 400) : 200 }));
    try { return await fn({ req, g, b, form, reply, ok: (m = 'Saved.', x) => reply('saved=' + encodeURIComponent(m), x), err: (m, s = 400) => reply('error=' + encodeURIComponent(m), { status: s }) }); }
    catch (e) { console.error(e); return reply('error=' + encodeURIComponent(e.userMessage || (e.userFacing ? e.message : 'Something went wrong.')), { status: e.userFacing ? 400 : 500 }); }
  };
}
export const int = (v, d = null) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
export const cents = (v) => { if (v === '' || v == null) return null; const n = Math.round(parseFloat(String(v).replace(/[ ,R]/g, '')) * 100); return Number.isFinite(n) && n >= 0 ? n : NaN; };
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const pageOf = (sp, size = 25) => { const p = Math.max(1, parseInt(sp?.page, 10) || 1); return { page: p, size, offset: (p - 1) * size }; };
