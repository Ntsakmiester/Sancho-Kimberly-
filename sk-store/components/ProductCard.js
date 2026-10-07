import Link from 'next/link';
import ProductGallery from './ProductGallery';
import ScrollReveal from './ScrollReveal';
import { price } from '../lib/products';
export default function ProductCard({ p }) {
  const sold = p.variants.length > 0 && p.variants.every((v) => v.qty <= 0);
  const sale = p.sale_price_cents != null && p.sale_price_cents < p.price_cents;
  return (
    <ScrollReveal><article className="card">
      <ProductGallery images={p.images} name={p.name} compact href={`/product/${p.slug}`} />
      <Link className="card-details" href={`/product/${p.slug}`} aria-label={`View ${p.name}`}>
      <h3>{p.name}</h3>
      <p className="price">{sold ? 'Sold out' : sale ? <><s style={{ opacity: 0.55 }}>{price(p.price_cents)}</s> {price(p.sale_price_cents)}</> : price(p.price_cents)}{p.review_count > 0 && <span className="low"> &middot; &#9733; {p.rating} ({p.review_count})</span>}</p>
    </Link></article></ScrollReveal>
  );
}
