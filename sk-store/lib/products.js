import pool from './db';
export const price = (c) => 'R ' + Math.round(c / 100).toLocaleString('en-ZA');
const base = `select p.id,p.slug,p.name,p.category,p.price_cents,p.description,
 coalesce((select json_agg(json_build_object('url',i.url,'bg',i.bg) order by i.position) from product_images i where i.product_id=p.id),'[]') images,
 coalesce((select json_agg(json_build_object('size',v.size,'qty',v.qty) order by v.id) from variants v where v.product_id=p.id),'[]') variants
 from products p where p.active`;
export async function listProducts(cat) {
  const r = cat ? await pool.query(base + ' and p.category=$1 order by p.id', [cat]) : await pool.query(base + ' order by p.id');
  return r.rows;
}
export async function getProduct(slug) {
  const r = await pool.query(base + ' and p.slug=$1', [slug]);
  return r.rows[0] || null;
}
