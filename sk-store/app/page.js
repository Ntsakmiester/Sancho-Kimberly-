import Link from 'next/link';
import { listProducts } from '../lib/products';
import ProductCard from '../components/ProductCard';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const all = await listProducts();
  const hero = all.find((p) => p.slug === 'varsity-script-tee') || all[0];
  return (
    <>
      <div className="wrap hero">
        <div>
          <h1>Made in the kasi. Worn nationwide.</h1>
          <p>Everyday streetwear in small drops, delivered anywhere in South Africa.</p>
          <Link className="btn" href="/shop">Shop the drop</Link>
        </div>
        {hero && <div className="tile cover" style={{ background: hero.images[0]?.bg }}><img src={hero.images[0]?.url} alt={hero.name} /></div>}
      </div>
      <section className="band"><div className="wrap">
        <h2>Latest drop</h2>
        <div className="grid">{all.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </div></section>
    </>
  );
}
