import pool from '../../../../lib/db';
import { adminPost } from '../../../../lib/adminapi';
import { readImage } from '../../../../lib/upload';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
// Image management: add / replace / delete / reorder / alt text. Needs products.edit.
export const POST = adminPost('products.edit', (b) => '/admin/dashboard/products/' + (parseInt(b.product_id, 10) || 0), async ({ g, b, form, ok, err }) => {
  const pid = parseInt(b.product_id, 10);
  const prod = (await pool.query('select id,name from products where id=$1', [pid])).rows[0];
  if (!prod) return err('Product not found.', 404);
  const iid = parseInt(b.image_id, 10) || null;
  const act = b.action || 'add';
  if (act === 'add' || act === 'replace') {
    const { buf, mime } = await readImage(form?.get('file'));
    const m = (await pool.query('insert into media(mime,bytes,data,created_by) values($1,$2,$3,$4) returning id', [mime, buf.length, buf, g.user.id])).rows[0];
    const alt = String(b.alt || prod.name).slice(0, 200);
    if (act === 'replace' && iid) {
      await pool.query('update product_images set url=$1, media_id=$2, alt=coalesce(nullif($3,\'\'),alt) where id=$4 and product_id=$5', ['/api/media/' + m.id, m.id, b.alt || '', iid, pid]);
    } else {
      const pos = (await pool.query('select coalesce(max(position),-1)+1 p from product_images where product_id=$1', [pid])).rows[0].p;
      await pool.query('insert into product_images(product_id,url,media_id,alt,position,variant_id) values($1,$2,$3,$4,$5,$6)', [pid, '/api/media/' + m.id, m.id, alt, pos, parseInt(b.variant_id, 10) || null]);
    }
  } else if (act === 'delete' && iid) {
    await pool.query('delete from product_images where id=$1 and product_id=$2', [iid, pid]);
  } else if ((act === 'up' || act === 'down') && iid) {
    const rows = (await pool.query('select id from product_images where product_id=$1 order by position,id', [pid])).rows.map((r) => r.id);
    const i = rows.indexOf(iid), j = act === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < rows.length) { [rows[i], rows[j]] = [rows[j], rows[i]]; for (let k = 0; k < rows.length; k++) await pool.query('update product_images set position=$1 where id=$2', [k, rows[k]]); }
  } else if (act === 'alt' && iid) {
    await pool.query('update product_images set alt=$1 where id=$2 and product_id=$3', [String(b.alt || '').slice(0, 200), iid, pid]);
  }
  await audit('PRODUCT_IMAGE_' + act.toUpperCase(), { accountId: g.user.id, role: g.user.role, ip: g.ip, record: prod.name, entity: 'product', entityId: pid });
  return ok('Images updated.');
});
