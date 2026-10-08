import { requestUrl } from '../../../../lib/request-url';
import pool from '../../../../lib/db';
import { adminPost, int, cents, slugify } from '../../../../lib/adminapi';
import { requirePerm, deny } from '../../../../lib/perms';
import { adjustVariant } from '../../../../lib/inventory';
import { audit } from '../../../../lib/audit';
import { readImage } from '../../../../lib/upload';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const g = await requirePerm(req, 'products.view'); if (!g.user) return deny(g);
  const u = new URL(requestUrl(req)); const q = (u.searchParams.get('q') || '').trim(); const page = Math.max(1, int(u.searchParams.get('page'), 1));
  const r = await pool.query(`select id,slug,name,category,price_cents,sale_price_cents,active,featured,archived_at,count(*) over() total from products where ($1='' or name ilike '%'||$1||'%' or slug ilike '%'||$1||'%') order by id desc limit 25 offset $2`, [q, (page - 1) * 25]);
  return Response.json({ products: r.rows });
}
export const POST = adminPost(null, (b) => (b.id ? '/admin/dashboard/products/' + b.id : '/admin/dashboard/products'), async ({ g, b, form, ok, err, reply }) => {
  const act = String(b.action || '');
  const can = (p) => g.perms.has(p);
  const pid = int(b.id);
  const forbid = () => err('You do not have permission to do that.', 403);
  const cur = pid ? (await pool.query('select * from products where id=$1', [pid])).rows[0] : null;
  const log = (a, extra = {}) => audit(a, { accountId: g.user.id, role: g.user.role, ip: g.ip, record: cur?.name || b.name, entity: 'product', entityId: pid, ...extra });
  if (act === 'create' || act === 'update') {
    if (!can(act === 'create' ? 'products.create' : 'products.edit')) return forbid();
    const name = String(b.name || '').trim().slice(0, 150);
    const price = cents(b.price), sale = cents(b.sale_price);
    if (!name) return err('Enter a product name.');
    if (price == null || Number.isNaN(price) || Number.isNaN(sale)) return err('Enter a valid price.');
    if (sale != null && sale >= price) return err('Sale price must be lower than the normal price.');
    const cat = (await pool.query('select id,name from categories where id=$1', [int(b.category_id)])).rows[0];
    if (!cat) return err('Choose a category.');
    const slug = slugify(b.slug || name) || 'product';
    const vals = [name, slug, cat.name, cat.id, price, sale, String(b.description || '').slice(0, 5000), b.featured === 'on' || b.featured === 'true', b.visible === 'off' ? false : true, String(b.sku || '').trim().slice(0, 60) || null, Math.max(0, int(b.low_stock_threshold, 3)), String(b.meta_title || '').slice(0, 70) || null, String(b.meta_description || '').slice(0, 160) || null];
    try {
      if (act === 'create') {
        const files = (form?.getAll('images') || []).filter(f => typeof f !== 'string' && f.size);
        if (files.length > 8) return err('Choose up to 8 images.');
        const images = [];
        for (const file of files) images.push(await readImage(file));
        const client = await pool.connect(); let id;
        try {
          await client.query('begin');
          const r = await client.query('insert into products(name,slug,category,category_id,price_cents,sale_price_cents,description,featured,active,sku,low_stock_threshold,meta_title,meta_description) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id', vals);
          id = r.rows[0].id;
          for (let i = 0; i < images.length; i++) {
            const { buf, mime } = images[i];
            const m = (await client.query('insert into media(mime,bytes,data,created_by) values($1,$2,$3,$4) returning id', [mime, buf.length, buf, g.user.id])).rows[0];
            await client.query('insert into product_images(product_id,url,media_id,alt,position) values($1,$2,$3,$4,$5)', [id, '/api/media/' + m.id, m.id, name, i]);
          }
          await client.query('commit');
        } catch (e) { await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
        await audit('PRODUCT_CREATED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: name, entity: 'product', entityId: id, newValue: { name, price_cents: price, images: images.length } });
        return reply('saved=Created.', { id, location: `/admin/dashboard/products/${id}` });
      }
      if (!cur) return err('Product not found.', 404);
      await pool.query('update products set name=$1,slug=$2,category=$3,category_id=$4,price_cents=$5,sale_price_cents=$6,description=$7,featured=$8,active=$9,sku=$10,low_stock_threshold=$11,meta_title=$12,meta_description=$13,updated_at=now() where id=$14', [...vals, pid]);
      await log('PRODUCT_UPDATED', { oldValue: { name: cur.name, price_cents: cur.price_cents, sale_price_cents: cur.sale_price_cents, active: cur.active }, newValue: { name, price_cents: price, sale_price_cents: sale, active: vals[8] } });
      return ok('Product saved.');
    } catch (e) { if (e.code === '23505') return err('That product name/URL already exists.'); throw e; }
  }
  if (!cur) return err('Product not found.', 404);
  if (['activate', 'deactivate'].includes(act)) {
    if (!can('products.edit')) return forbid();
    await pool.query('update products set active=$1, updated_at=now() where id=$2', [act === 'activate', pid]); await log('PRODUCT_' + act.toUpperCase() + 'D', { oldValue: { active: cur.active } });
    return ok(act === 'activate' ? 'Product is now visible.' : 'Product hidden from the shop.');
  }
  if (act === 'archive' || act === 'restore') {
    if (!can('products.delete')) return forbid();
    await pool.query('update products set archived_at=$1, active=$2, updated_at=now() where id=$3', [act === 'archive' ? new Date() : null, false, pid]); await log('PRODUCT_' + act.toUpperCase() + 'D');
    return ok(act === 'archive' ? 'Product archived (order history kept).' : 'Product restored (still hidden until you activate it).');
  }
  if (act === 'variant_save') {
    if (!can('products.edit')) return forbid();
    const vid = int(b.variant_id);
    const size = String(b.size || '').trim().slice(0, 30); const colour = String(b.colour || '').trim().slice(0, 30);
    const price = cents(b.price); const qty = int(b.qty, 0);
    if (!size) return err('Enter a size.'); if (Number.isNaN(price)) return err('Enter a valid variant price.'); if (qty < 0) return err('Stock cannot be negative.');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const sku = String(b.sku || '').trim().slice(0, 60) || null; const low = b.low_stock_threshold === '' || b.low_stock_threshold == null ? null : Math.max(0, int(b.low_stock_threshold, 0));
      if (vid) {
        const old = (await client.query('select * from variants where id=$1 and product_id=$2 for update', [vid, pid])).rows[0];
        if (!old) { await client.query('rollback'); return err('Variant not found.', 404); }
        await client.query('update variants set size=$1,colour=$2,sku=$3,price_cents=$4,active=$5,low_stock_threshold=$6,image_url=$7,updated_at=now() where id=$8', [size, colour, sku, price, !(b.active_hidden === '1' && !b.active), low, String(b.image_url || '').slice(0, 300) || null, vid]);
        if (qty !== old.qty) { if (!can('inventory.edit')) { await client.query('rollback'); return forbid(); } await adjustVariant(client, { variantId: vid, delta: qty - old.qty, reason: 'MANUAL_ADJUSTMENT', userId: g.user.id, note: 'Edited on product page' }); }
      } else {
        const r = await client.query('insert into variants(product_id,size,colour,sku,price_cents,qty,active,low_stock_threshold,image_url) values($1,$2,$3,$4,$5,0,true,$6,$7) returning id', [pid, size, colour, sku, price, low, String(b.image_url || '').slice(0, 300) || null]);
        if (qty > 0) { if (!can('inventory.edit')) { await client.query('rollback'); return forbid(); } await adjustVariant(client, { variantId: r.rows[0].id, delta: qty, reason: 'INITIAL', userId: g.user.id, note: 'Opening stock' }); }
      }
      await client.query('commit');
    } catch (e) { await client.query('rollback').catch(() => {}); if (e.code === '23505') return err('That size/colour or SKU already exists for this product.'); throw e; } finally { client.release(); }
    await log('VARIANT_SAVED', { newValue: { size, colour, qty } });
    return ok('Variant saved.');
  }
  if (act === 'variant_delete') {
    if (!can('products.delete')) return forbid();
    const used = (await pool.query('select 1 from order_items where variant_id=$1 limit 1', [int(b.variant_id)])).rowCount;
    if (used) return err('This variant has orders. Mark it unavailable instead of deleting it.');
    await pool.query('delete from variants where id=$1 and product_id=$2', [int(b.variant_id), pid]); await log('VARIANT_DELETED');
    return ok('Variant deleted.');
  }
  return err('Unknown action.');
});
