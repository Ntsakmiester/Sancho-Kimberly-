import Link from 'next/link';
import { listProducts } from '../../lib/products';
import ProductCard from '../../components/ProductCard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shop | Sancho Kimberly' };
const cats = ['Tees', 'Beanies', 'Pants', 'Accessories'];
export default async function Shop({ searchParams }) {
  const cat = cats.includes(searchParams?.cat) ? searchParams.cat : null;
  const list = cat ? await listProducts(cat) : await listProducts();
  return (
    <section className="wrap shop">
      <h2>Shop</h2>
      <div className="chips">
        <Link className={!cat ? 'sel' : ''} href="/shop">All</Link>
        {cats.map((c) => <Link key={c} className={cat === c ? 'sel' : ''} href={`/shop?cat=${c}`}>{c}</Link>)}
      </div>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <div className="empty"><b>{cat} are coming soon</b>New pieces are on the way.</div>
      )}
    </section>
  );
}
