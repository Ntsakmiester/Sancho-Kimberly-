import Link from 'next/link';
import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { money } from '../../../../lib/format';
import { Table, Td, Pager, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Products({ searchParams: sp }) {
  const { perms } = await pagePerm('products.view');
  const { page, size, offset } = pg(sp); const q = String(sp?.q || '').trim().slice(0, 60); const arch = sp?.archived === '1';
  const rows = (await pool.query(`select p.id,p.name,p.category,p.price_cents,p.sale_price_cents,p.active,p.archived_at,(select coalesce(sum(qty),0)::int from variants v where v.product_id=p.id) stock,count(*) over()::int total from products p
    where (p.archived_at is not null)=$3 and ($1='' or p.name ilike '%'||$1||'%' or p.slug ilike '%'||$1||'%') order by p.id desc limit $2 offset $4`, [q, size, arch, offset])).rows;
  const cats = (await pool.query('select id,name from categories order by position,name')).rows;
  return (
    <>
      <Flash sp={sp} /><h3>Products</h3>
      <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Search products" aria-label="Search" /> <label><input type="checkbox" name="archived" value="1" defaultChecked={arch} /> Archived</label> <button className="btn">Search</button></form>
      <Table head={['Name', 'Category', 'Price', 'Stock', 'Status', '']} count={rows.length} empty="No products found.">
        {rows.map((p) => <tr key={p.id}><Td><Link href={`/admin/dashboard/products/${p.id}`}>{p.name}</Link></Td><Td>{p.category}</Td><Td>{p.sale_price_cents != null ? <>{money(p.sale_price_cents)} <s className="low">{money(p.price_cents)}</s></> : money(p.price_cents)}</Td><Td>{p.stock}</Td><Td>{p.archived_at ? 'Archived' : p.active ? 'Visible' : 'Hidden'}</Td><Td><Link href={`/admin/dashboard/products/${p.id}`}>Edit</Link></Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/products?q=${encodeURIComponent(q)}${arch ? '&archived=1' : ''}`} page={page} size={size} total={rows[0]?.total} />
      {perms.has('products.create') && (
        <form method="post" action="/api/admin/products" style={{ marginTop: 20, maxWidth: 520 }}>
          <h3>Add a product</h3><input type="hidden" name="action" value="create" />
          <input name="name" placeholder="Product name" required maxLength={150} aria-label="Name" />
          <select name="category_id" required aria-label="Category"><option value="">Category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input name="price" placeholder="Price in rand, e.g. 450" required inputMode="decimal" aria-label="Price" />
          <input name="sale_price" placeholder="Sale price (optional)" inputMode="decimal" aria-label="Sale price" />
          <textarea name="description" placeholder="Description" rows={3} style={{ width: '100%' }} aria-label="Description" />
          <input type="hidden" name="visible" value="off" />
          <button className="btn">Create (hidden until you activate it)</button>
        </form>
      )}
    </>
  );
}
