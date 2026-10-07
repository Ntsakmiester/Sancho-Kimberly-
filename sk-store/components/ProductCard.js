import Link from 'next/link';
import ScrollReveal from './ScrollReveal';
import { price } from '../lib/products';
export default function ProductCard({ p }) {
  const im = p.images[0] || {};
  const sold = p.variants.length > 0 && p.variants.every((v) => v.qty <= 0);
  const sale = p.sale_price_cents != null && p.sale_price_cents < p.price_cents;
  return (
    <ScrollReveal><Link className="card" href={`/product/${p.slug}`}>
      <div className="tile" style={{ background: im.bg }}><img src={im.url} alt={im.alt || p.name} loading="lazy" /></div>
      <h3>{p.name}</h3>
      <p className="price">{sold ? 'Sold out' : sale ? <><s style={{ opacity: 0.55 }}>{price(p.price_cents)}</s> {price(p.sale_price_cents)}</> : price(p.price_cents)}{p.review_count > 0 && <span className="low"> &middot; &#9733; {p.rating} ({p.review_count})</span>}</p>
    </Link></ScrollReveal>
  );
}
