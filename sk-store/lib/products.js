import pool from './db';
export { price } from './format';
// Public catalogue: only active, non-archived products. Prices shown are the effective (sale) price.
const base = `select p.id,p.slug,p.name,p.category,p.price_cents,p.sale_price_cents,p.featured,p.description,p.meta_title,p.meta_description,
 coalesce((select json_agg(json_build_object('url',i.url,'bg',i.bg,'alt',i.alt) order by i.position,i.id) from product_images i where i.product_id=p.id),'[]') images,
 coalesce((select json_agg(json_build_object('size',v.size,'colour',v.colour,'qty',v.qty,'price_cents',v.price_cents,'image_url',v.image_url) order by v.id) from variants v where v.product_id=p.id and v.active),'[]') variants,
 (select round(avg(r.rating)::numeric,1)::float from reviews r where r.product_id=p.id and r.status='APPROVED') rating,
 (select count(*)::int from reviews r where r.product_id=p.id and r.status='APPROVED') review_count
 from products p where p.active and p.archived_at is null`;
export const effective = (p) => (p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents);
const EFF = 'coalesce(p.sale_price_cents,p.price_cents)';
// Shared shop filter: category, search text, price range (cents), size, colour, in stock, on sale. All values are bound parameters.
function filterSql(cat, { q = '', min = null, max = null, size = '', colour = '', inStock = false, sale = false } = {}) {
  const args = []; let where = '';
  if (cat) { args.push(cat); where += ` and p.category=$${args.length}`; }
  if (q) { args.push('%' + q.replace(/[%_]/g, '') + '%'); where += ` and (p.name ilike $${args.length} or p.description ilike $${args.length})`; }
  if (min != null) { args.push(min); where += ` and ${EFF}>=$${args.length}`; }
  if (max != null) { args.push(max); where += ` and ${EFF}<=$${args.length}`; }
  const vc = [];
  if (size) { args.push(size); vc.push(`v.size=$${args.length}`); }
  if (colour) { args.push(colour); vc.push(`v.colour=$${args.length}`); }
  if (inStock) vc.push('v.qty>0');
  if (vc.length) where += ` and exists(select 1 from variants v where v.product_id=p.id and v.active and ${vc.join(' and ')})`;
  if (sale) where += ' and p.sale_price_cents is not null and p.sale_price_cents<p.price_cents';
  return { args, where };
}
export async function listProducts(cat, { sort = '', limit = 48, offset = 0, ...f } = {}) {
  const { args, where } = filterSql(cat, f);
  const order = sort === 'price_asc' ? EFF + ' asc, p.id' : sort === 'price_desc' ? EFF + ' desc, p.id' : sort === 'new' ? 'p.id desc' : 'p.id';
  args.push(limit, offset);
  const r = await pool.query(`${base}${where} order by ${order} limit $${args.length - 1} offset $${args.length}`, args);
  return r.rows;
}
export async function countProducts(cat, f = {}) {
  const { args, where } = filterSql(cat, typeof f === 'string' ? { q: f } : f);
  return (await pool.query(`select count(*)::int c from products p where p.active and p.archived_at is null${where}`, args)).rows[0].c;
}
// Sizes and colours that exist on visible products, for the filter menu.
export async function filterOptions() {
  const r = await pool.query("select v.size,v.colour from variants v join products p on p.id=v.product_id where v.active and p.active and p.archived_at is null");
  const uniq = (k) => [...new Set(r.rows.map((x) => (x[k] || '').trim()).filter(Boolean))];
  const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const sizes = uniq('size').sort((a, b) => { const i = order.indexOf(a.toUpperCase()), j = order.indexOf(b.toUpperCase()); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b, undefined, { numeric: true }); });
  return { sizes, colours: uniq('colour').sort() };
}
export async function getProduct(slug) {
  const r = await pool.query(base + ' and p.slug=$1', [slug]);
  return r.rows[0] || null;
}
export async function categoryNames() {
  const r = await pool.query("select name from categories where active order by position,name");
  return r.rows.map((x) => x.name);
}
