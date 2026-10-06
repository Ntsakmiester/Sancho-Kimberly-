import Link from 'next/link';
import { price } from '../lib/products';
export default function ProductCard({ p }) {
  const im = p.images[0] || {};
  const sold = p.variants.length > 0 && p.variants.every((v) => v.qty <= 0);
  return (
    <Link className="card" href={`/product/${p.slug}`}>
      <div className="tile" style={{ background: im.bg }}><img src={im.url} alt={p.name} loading="lazy" /></div>
      <h3>{p.name}</h3>
      <p className="price">{sold ? 'Sold out' : price(p.price_cents)}</p>
    </Link>
  );
}
