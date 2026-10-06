import { notFound } from 'next/navigation';
import { getProduct, price } from '../../../lib/products';
import ProductView from '../../../components/ProductView';
export const dynamic = 'force-dynamic';
export default async function ProductPage({ params }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  return <ProductView p={{ slug: p.slug, price_cents: p.price_cents, name: p.name, description: p.description, images: p.images, variants: p.variants, priceText: price(p.price_cents) }} />;
}
