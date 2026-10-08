import { requirePageRole } from '../../../../lib/pageguard';
import Link from 'next/link';
import pool from '../../../../lib/db';
import { Flash } from '../../../../components/ui';
import { price } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Products({ searchParams: spPromise }) {
  const sp = await spPromise;
  await requirePageRole('owner', '/owner/login');
  const r = await pool.query(`select p.id,p.name,p.category,p.price_cents,p.active,
    coalesce((select json_agg(json_build_object('size',v.size,'colour',v.colour,'qty',v.qty) order by v.id) from variants v where v.product_id=p.id),'[]') variants
    from products p order by p.id`);
  return (<>
    <Flash sp={sp} /><h3>Products &amp; inventory</h3><p className="lead">Manage images, colour variants and stock in store management.</p><div className="office-actions"><Link className="btn" href="/admin/dashboard/products">Manage products</Link><Link className="office-action" href="/admin/dashboard/inventory">Adjust inventory &rarr;</Link></div>
    <form method="post" action="/api/admin/categories" className="office-form" style={{ margin: '20px 0', maxWidth: 620 }}>
      <h3>Add a category</h3><input type="hidden" name="action" value="create" /><input type="hidden" name="back" value="/owner/dashboard/products" />
      <input name="name" placeholder="e.g. Hoodies" required maxLength={60} aria-label="Category name" /><button className="btn">Add category</button>
      <p className="low">After adding a category, open Manage products to select it when creating a product.</p>
    </form>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Product</th><th>Category</th><th>Price</th><th>Stock by size</th><th>Status</th></tr></thead>
      <tbody>{r.rows.map((p) => <tr key={p.id} style={{ borderTop: '1px solid #eee' }}><td>{p.name}</td><td>{p.category}</td><td>{price(p.price_cents)}</td><td>{p.variants.map((v) => `${v.size}${v.colour ? ' / ' + v.colour : ''}: ${v.qty}`).join(' | ')}</td><td>{p.active ? 'Active' : 'Hidden'}</td></tr>)}</tbody></table></div>
  </>);
}
