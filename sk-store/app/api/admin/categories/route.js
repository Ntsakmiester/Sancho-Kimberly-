import pool from '../../../../lib/db';
import { adminPost, slugify } from '../../../../lib/adminapi';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
// Add a product category from the admin products page. Anyone who may create products may add a category.
export const POST = adminPost('products.create', '/admin/dashboard/products', async ({ g, b, ok, err }) => {
  if (b.action !== 'create') return err('Unknown action.');
  const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!name) return err('Enter a category name.');
  const slug = slugify(name) || 'category';
  try {
    const r = await pool.query('insert into categories(slug,name,position) values($1,$2,(select coalesce(max(position),0)+1 from categories)) returning id,name', [slug, name]);
    await audit('CATEGORY_CREATED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: name, entity: 'category', entityId: r.rows[0].id, newValue: { name, slug } });
    return ok(`Category "${r.rows[0].name}" added.`);
  } catch (e) {
    if (e.code === '23505') return err('That category already exists.');
    throw e;
  }
});
