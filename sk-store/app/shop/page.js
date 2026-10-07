import Link from 'next/link';
import { listProducts, countProducts, categoryNames } from '../../lib/products';
import ProductCard from '../../components/ProductCard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shop | Sancho Kimberly', alternates: { canonical: '/shop' } };
const PER = 24;
export default async function Shop({ searchParams }) {
  const cats = await categoryNames();
  const cat = cats.includes(searchParams?.cat) ? searchParams.cat : null;
  const q = String(searchParams?.q || '').trim().slice(0, 60);
  const sort = ['price_asc', 'price_desc', 'new'].includes(searchParams?.sort) ? searchParams.sort : '';
  const page = Math.max(1, parseInt(searchParams?.page, 10) || 1);
  const [list, total] = await Promise.all([listProducts(cat, { q, sort, limit: PER, offset: (page - 1) * PER }), countProducts(cat, q)]);
  const link = (o) => { const p = new URLSearchParams({ ...(cat ? { cat } : {}), ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...o }); return '/shop' + (p.toString() ? '?' + p : ''); };
  return (
    <section className="wrap shop">
      <h2>Shop</h2>
      <form method="get" action="/shop" className="searchbar" role="search">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" maxLength={60} />
        <select name="sort" defaultValue={sort} aria-label="Sort"><option value="">Featured</option><option value="new">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
        <button className="btn">Search</button>
      </form>
      <div className="chips">
        <Link className={!cat ? 'sel' : ''} href="/shop">All</Link>
        {cats.map((c) => <Link key={c} className={cat === c ? 'sel' : ''} href={link({ cat: c, page: undefined })}>{c}</Link>)}
      </div>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : q ? (
        <div className="empty"><b>No results for &ldquo;{q}&rdquo;</b>Try a different word.</div>
      ) : (
        <div className="empty"><b>{cat || 'New pieces'} {cat ? 'are' : 'are'} coming soon</b>New pieces are on the way.</div>
      )}
      {total > PER && (
        <div className="chips" style={{ marginTop: 20 }}>
          {page > 1 && <Link href={link({ page: page - 1 })}>&larr; Previous</Link>}
          <span className="low">Page {page} of {Math.ceil(total / PER)}</span>
          {page * PER < total && <Link href={link({ page: page + 1 })}>Next &rarr;</Link>}
        </div>
      )}
    </section>
  );
}
