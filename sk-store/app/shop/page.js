import Link from 'next/link';
import { listProducts, countProducts, categoryNames, filterOptions } from '../../lib/products';
import ProductCard from '../../components/ProductCard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shop | Sancho Kimberly', alternates: { canonical: '/shop' } };
const PER = 24;
const rands = (v) => { const s = String(v ?? '').replace(/[ ,R]/g, ''); if (s === '') return null; const n = parseFloat(s); return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 100) : null; };
export default async function Shop({ searchParams }) {
  const [cats, opts] = await Promise.all([categoryNames(), filterOptions()]);
  const cat = cats.includes(searchParams?.cat) ? searchParams.cat : null;
  const q = String(searchParams?.q || '').trim().slice(0, 60);
  const sort = ['price_asc', 'price_desc', 'new'].includes(searchParams?.sort) ? searchParams.sort : '';
  const page = Math.max(1, parseInt(searchParams?.page, 10) || 1);
  let min = rands(searchParams?.min), max = rands(searchParams?.max);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const size = opts.sizes.includes(searchParams?.size) ? searchParams.size : '';
  const colour = opts.colours.includes(searchParams?.colour) ? searchParams.colour : '';
  const inStock = searchParams?.stock === '1';
  const sale = searchParams?.sale === '1';
  const f = { q, min, max, size, colour, inStock, sale };
  const active = [min != null || max != null, !!size, !!colour, inStock, sale].filter(Boolean).length;
  const [list, total] = await Promise.all([listProducts(cat, { ...f, sort, limit: PER, offset: (page - 1) * PER }), countProducts(cat, f)]);
  const keep = { ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...(min != null ? { min: String(min / 100) } : {}), ...(max != null ? { max: String(max / 100) } : {}), ...(size ? { size } : {}), ...(colour ? { colour } : {}), ...(inStock ? { stock: '1' } : {}), ...(sale ? { sale: '1' } : {}) };
  const link = (o) => { const p = new URLSearchParams({ ...(cat ? { cat } : {}), ...keep, ...o }); for (const [k, v] of [...p]) if (v === 'undefined') p.delete(k); return '/shop' + (p.toString() ? '?' + p : ''); };
  return (
    <section className="wrap shop">
      <h2>Shop</h2>
      <form method="get" action="/shop" className="searchbar" role="search">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" maxLength={60} />
        <select name="sort" defaultValue={sort} aria-label="Sort"><option value="">Featured</option><option value="new">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
        {min != null && <input type="hidden" name="min" value={min / 100} />}{max != null && <input type="hidden" name="max" value={max / 100} />}
        {size && <input type="hidden" name="size" value={size} />}{colour && <input type="hidden" name="colour" value={colour} />}
        {inStock && <input type="hidden" name="stock" value="1" />}{sale && <input type="hidden" name="sale" value="1" />}
        <button className="btn">Search</button>
      </form>
      <details className="filters" open={active > 0}>
        <summary>Filters{active > 0 ? ` (${active})` : ''}</summary>
        <form method="get" action="/shop" className="filter-grid">
          {cat && <input type="hidden" name="cat" value={cat} />}{q && <input type="hidden" name="q" value={q} />}{sort && <input type="hidden" name="sort" value={sort} />}
          <label>Min price (R)<input name="min" type="number" inputMode="decimal" min="0" step="1" defaultValue={min != null ? min / 100 : ''} /></label>
          <label>Max price (R)<input name="max" type="number" inputMode="decimal" min="0" step="1" defaultValue={max != null ? max / 100 : ''} /></label>
          {opts.sizes.length > 0 && <label>Size<select name="size" defaultValue={size}><option value="">Any size</option>{opts.sizes.map((s) => <option key={s}>{s}</option>)}</select></label>}
          {opts.colours.length > 0 && <label>Colour<select name="colour" defaultValue={colour}><option value="">Any colour</option>{opts.colours.map((c) => <option key={c}>{c}</option>)}</select></label>}
          <label className="check"><input type="checkbox" name="stock" value="1" defaultChecked={inStock} />In stock only</label>
          <label className="check"><input type="checkbox" name="sale" value="1" defaultChecked={sale} />On sale</label>
          <div className="filter-actions"><button className="btn">Apply filters</button>{active > 0 && <Link href={link({ min: undefined, max: undefined, size: undefined, colour: undefined, stock: undefined, sale: undefined })}>Clear filters</Link>}</div>
        </form>
      </details>
      <div className="chips">
        <Link className={!cat ? 'sel' : ''} href={link({ cat: undefined, page: undefined })}>All</Link>
        {cats.map((c) => <Link key={c} className={cat === c ? 'sel' : ''} href={link({ cat: c, page: undefined })}>{c}</Link>)}
      </div>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (q || active > 0) ? (
        <div className="empty"><b>No products match</b>Try fewer filters or a different word.{' '}<Link href="/shop">Clear everything</Link></div>
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
