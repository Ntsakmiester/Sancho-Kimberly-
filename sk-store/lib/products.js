import pool from './db';
export { price } from './format';
// Public catalogue: only active, non-archived products. Prices shown are the effective (sale) price.
const base = `select p.id,p.slug,p.name,p.category,p.price_cents,p.sale_price_cents,p.featured,p.description,p.meta_title,p.meta_description,
 coalesce((select json_agg(json_build_object('url',i.url,'bg',i.bg,'alt',i.alt) order by i.position,i.id) from product_images i where i.product_id=p.id),'[]') images,
 coalesce((select json_agg(json_build_object('size',v.size,'colour',v.colour,'qty',v.qty,'price_cents',v.price_cents) order by v.id) from variants v where v.product_id=p.id and v.active),'[]') variants,
 (select round(avg(r.rating)::numeric,1)::float from reviews r where r.product_id=p.id and r.status='APPROVED') rating,
 (select count(*)::int from reviews r where r.product_id=p.id and r.status='APPROVED') review_count
 from products p where p.active and p.archived_at is null`;
export const effective = (p) => (p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents);
export async function listProducts(cat, { q = '', sort = '', limit = 48, offset = 0 } = {}) {
  const args = []; let where = '';
  if (cat) { args.push(cat); where += ` and p.category=$${args.length}`; }
  if (q) { args.push('%' + q.replace(/[%_]/g, '') + '%'); where += ` and (p.name ilike $${args.length} or p.description ilike $${args.length})`; }
  const order = sort === 'price_asc' ? 'coalesce(p.sale_price_cents,p.price_cents) asc, p.id' : sort === 'price_desc' ? 'coalesce(p.sale_price_cents,p.price_cents) desc, p.id' : sort === 'new' ? 'p.id desc' : 'p.id';
  args.push(limit, offset);
  const r = await pool.query(`${base}${where} order by ${order} limit $${args.length - 1} offset $${args.length}`, args);
  return r.rows;
}
export async function countProducts(cat, q = '') {
  const args = []; let where = '';
  if (cat) { args.push(cat); where += ` and category=$${args.length}`; }
  if (q) { args.push('%' + q.replace(/[%_]/g, '') + '%'); where += ` and (name ilike $${args.length} or description ilike $${args.length})`; }
  return (await pool.query(`select count(*)::int c from products where active and archived_at is null${where}`, args)).rows[0].c;
}
export async function getProduct(slug) {
  const r = await pool.query(base + ' and p.slug=$1', [slug]);
  return r.rows[0] || null;
}
export async function categoryNames() {
  const r = await pool.query("select name from categories where active order by position,name");
  return r.rows.map((x) => x.name);
}
