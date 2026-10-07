import { notFound } from 'next/navigation';
import pool from '../../../../../lib/db';
import { pagePerm } from '../../../../../lib/adminpage';
import { Flash } from '../../../../../components/ui';
import Confirm from '../../../../../components/Confirm';
import { rands } from '../../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function EditProduct({ params, searchParams: sp }) {
  const { perms } = await pagePerm('products.view');
  const id = parseInt(params.id, 10); if (!id) notFound();
  const p = (await pool.query('select * from products where id=$1', [id])).rows[0]; if (!p) notFound();
  const cats = (await pool.query('select id,name from categories order by position,name')).rows;
  const vars = (await pool.query('select * from variants where product_id=$1 order by id', [id])).rows;
  const imgs = (await pool.query('select * from product_images where product_id=$1 order by position,id', [id])).rows;
  const edit = perms.has('products.edit');
  return (
    <>
      <Flash sp={sp} /><h3>{p.name}{p.archived_at ? ' (archived)' : p.active ? '' : ' (hidden)'}</h3>
      <form method="post" action="/api/admin/products" style={{ maxWidth: 560 }}>
        <input type="hidden" name="action" value="update" /><input type="hidden" name="id" value={id} />
        <label className="label">Name<input name="name" defaultValue={p.name} required maxLength={150} disabled={!edit} /></label>
        <label className="label">URL name<input name="slug" defaultValue={p.slug} disabled={!edit} /></label>
        <label className="label">Category<select name="category_id" defaultValue={p.category_id || ''} disabled={!edit}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="label">Price (R)<input name="price" defaultValue={rands(p.price_cents)} inputMode="decimal" disabled={!edit} /></label>
        <label className="label">Sale price (R, optional)<input name="sale_price" defaultValue={p.sale_price_cents != null ? rands(p.sale_price_cents) : ''} inputMode="decimal" disabled={!edit} /></label>
        <label className="label">Product SKU<input name="sku" defaultValue={p.sku || ''} disabled={!edit} /></label>
        <label className="label">Low-stock threshold<input name="low_stock_threshold" defaultValue={p.low_stock_threshold} inputMode="numeric" disabled={!edit} /></label>
        <label className="label">Description<textarea name="description" rows={4} defaultValue={p.description} style={{ width: '100%' }} disabled={!edit} /></label>
        <label className="label">Search title (SEO)<input name="meta_title" defaultValue={p.meta_title || ''} maxLength={70} disabled={!edit} /></label>
        <label className="label">Search description (SEO)<input name="meta_description" defaultValue={p.meta_description || ''} maxLength={160} disabled={!edit} /></label>
        <label><input type="checkbox" name="featured" defaultChecked={p.featured} disabled={!edit} /> Featured</label>
        <input type="hidden" name="visible" value={p.active ? 'on' : 'off'} />
        {edit && <p><button className="btn">Save product</button></p>}
      </form>
      {edit && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <form method="post" action="/api/admin/products"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={p.active ? 'deactivate' : 'activate'} /><Confirm message={p.active ? 'Hide this product from the shop?' : 'Show this product in the shop?'}>{p.active ? 'Hide from shop' : 'Show in shop'}</Confirm></form>
        {perms.has('products.delete') && <form method="post" action="/api/admin/products"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={p.archived_at ? 'restore' : 'archive'} /><Confirm message="Are you sure? Order history is kept either way.">{p.archived_at ? 'Restore' : 'Archive'}</Confirm></form>}
      </div>}
      <h3 style={{ marginTop: 24 }}>Sizes, colours and stock</h3>
      <div style={{ overflowX: 'auto' }}>
        {vars.map((v) => (
          <form key={v.id} method="post" action="/api/admin/products" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <input type="hidden" name="action" value="variant_save" /><input type="hidden" name="id" value={id} /><input type="hidden" name="variant_id" value={v.id} />
            <input name="size" defaultValue={v.size} size={5} aria-label="Size" /><input name="colour" defaultValue={v.colour} size={8} placeholder="Colour" aria-label="Colour" />
            <input name="sku" defaultValue={v.sku || ''} size={14} placeholder="SKU" aria-label="SKU" /><input name="price" defaultValue={v.price_cents != null ? rands(v.price_cents) : ''} size={7} placeholder="Own price" aria-label="Variant price" />
            <input name="qty" defaultValue={v.qty} size={4} inputMode="numeric" aria-label="Stock" /><label><input type="checkbox" name="active" defaultChecked={v.active} /> Available</label>
            <input type="hidden" name="active_hidden" value="1" />
            {edit && <button className="btn">Save</button>}
          </form>
        ))}
        {edit && <form method="post" action="/api/admin/products" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="hidden" name="action" value="variant_save" /><input type="hidden" name="id" value={id} />
          <input name="size" placeholder="Size" size={5} required aria-label="New size" /><input name="colour" placeholder="Colour" size={8} aria-label="New colour" /><input name="sku" placeholder="SKU" size={14} aria-label="New SKU" />
          <input name="price" placeholder="Own price" size={7} aria-label="New price" /><input name="qty" placeholder="Stock" size={4} defaultValue="0" aria-label="New stock" /><button className="btn">Add variant</button>
        </form>}
      </div>
      <h3 style={{ marginTop: 24 }}>Images</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {imgs.map((i) => (
          <div key={i.id} style={{ width: 150 }}>
            <img src={i.url} alt={i.alt || ''} style={{ width: 150, height: 150, objectFit: 'cover', background: i.bg }} loading="lazy" />
            {edit && <form method="post" action="/api/admin/media" encType="multipart/form-data">
              <input type="hidden" name="product_id" value={id} /><input type="hidden" name="image_id" value={i.id} />
              <input name="alt" defaultValue={i.alt || ''} placeholder="Alt text" aria-label="Alt text" size={14} />
              <button className="btn" name="action" value="alt">Save alt</button>{' '}<button name="action" value="up" aria-label="Move earlier">&uarr;</button><button name="action" value="down" aria-label="Move later">&darr;</button>
              <Confirm className="btn" message="Delete this image?" name="action" value="delete">Delete</Confirm>
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Replacement image" /><button className="btn" name="action" value="replace">Replace</button>
            </form>}
          </div>
        ))}
      </div>
      {edit && <form method="post" action="/api/admin/media" encType="multipart/form-data" style={{ marginTop: 12 }}>
        <input type="hidden" name="product_id" value={id} /><input type="hidden" name="action" value="add" />
        <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required aria-label="New image" /> <input name="alt" placeholder="Alt text" aria-label="Alt text" /> <button className="btn">Upload image</button>
        <p className="low">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
      </form>}
    </>
  );
}
