import pool from '../lib/db';
export const dynamic = 'force-dynamic';
export default async function sitemap() {
  const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  let ps = []; try { ps = (await pool.query('select slug,updated_at from products where active order by id limit 5000')).rows; } catch {}
  return [{ url: base + '/' }, { url: base + '/shop' }, ...ps.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updated_at }))];
}
