import Link from 'next/link';
import pool from '../../../../lib/db';
import { price } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Products() {
  const r = await pool.query(`select p.id,p.name,p.category,p.price_cents,p.active,
    coalesce((select json_agg(json_build_object('size',v.size,'colour',v.colour,'qty',v.qty) order by v.id) from variants v where v.product_id=p.id),'[]') variants
    from products p order by p.id`);
  return (<>
    <h3>Products &amp; inventory</h3><p className="lead">Manage images, colour variants and stock in store management.</p><div className="office-actions"><Link className="btn" href="/admin/dashboard/products">Manage products</Link><Link className="office-action" href="/admin/dashboard/inventory">Adjust inventory &rarr;</Link></div>
    <div className="owner-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left' }}><th>Product</th><th>Category</th><th>Price</th><th>Stock by size</th><th>Status</th></tr></thead>
      <tbody>{r.rows.map((p) => <tr key={p.id} style={{ borderTop: '1px solid #eee' }}><td>{p.name}</td><td>{p.category}</td><td>{price(p.price_cents)}</td><td>{p.variants.map((v) => `${v.size}${v.colour ? ' / ' + v.colour : ''}: ${v.qty}`).join(' | ')}</td><td>{p.active ? 'Active' : 'Hidden'}</td></tr>)}</tbody></table></div>
  </>);
}
