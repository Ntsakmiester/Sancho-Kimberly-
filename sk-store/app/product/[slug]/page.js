import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, price, effective } from '../../../lib/products';
import pool from '../../../lib/db';
import { cookies } from 'next/headers';
import { getUser } from '../../../lib/auth';
import { flag } from '../../../lib/flags';
import ProductView from '../../../components/ProductView';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: 'Not found | Sancho Kimberly' };
  const title = p.meta_title || `${p.name} | Sancho Kimberly`; const desc = p.meta_description || String(p.description || '').slice(0, 155);
  return { title, description: desc, alternates: { canonical: `/product/${p.slug}` }, openGraph: { title, description: desc, type: 'website', images: p.images[0] ? [p.images[0].url] : [] } };
}
const Stars = ({ n }) => <span aria-label={`${n} out of 5`}>{'\u2605'.repeat(n)}{'\u2606'.repeat(5 - n)}</span>;
export default async function ProductPage({ params, searchParams }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  const jar = cookies(); const user = await getUser({ headers: { get: (k) => (k === 'cookie' ? jar.toString() : null) } });
  const reviewsOn = await flag('reviews');
  const reviews = (await pool.query("select r.rating,r.title,r.body,r.verified,r.created_at,coalesce(nullif(split_part(u.name,' ',1),''),'Customer') who from reviews r join users u on u.id=r.user_id where r.product_id=$1 and r.status='APPROVED' order by r.id desc limit 30", [p.id])).rows;
  const dist = (await pool.query("select rating,count(*)::int c from reviews where product_id=$1 and status='APPROVED' group by rating", [p.id])).rows;
  const can = user?.role === 'customer' && reviewsOn ? (await pool.query("select (select count(*) from orders o join order_items i on i.order_id=o.id where o.user_id=$1 and i.product_id=$2 and o.status='DELIVERED')::int delivered,(select count(*) from reviews where user_id=$1 and product_id=$2)::int done", [user.id, p.id])).rows[0] : null;
  const eff = effective(p); const sale = eff < p.price_cents;
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, image: p.images.map((i) => i.url), offers: { '@type': 'Offer', priceCurrency: 'ZAR', price: (eff / 100).toFixed(2), availability: p.variants.some((v) => v.qty > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }, ...(p.review_count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.review_count } } : {}) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <ProductView p={{ slug: p.slug, price_cents: eff, name: p.name, description: p.description, images: p.images, variants: p.variants, priceText: price(sale ? p.price_cents : eff), saleText: sale ? price(eff) : null, rating: p.rating, review_count: p.review_count }} />
      {reviewsOn && (
        <section className="wrap shop" style={{ marginTop: 24 }}>
          <h2 className="h2">Reviews</h2>
          {p.review_count > 0 ? (
            <>
              <p><b>{p.rating}</b> out of 5 &middot; {p.review_count} review{p.review_count === 1 ? '' : 's'}</p>
              {[5, 4, 3, 2, 1].map((n) => { const c = dist.find((d) => d.rating === n)?.c || 0; return <div key={n} className="low">{n} star: <span style={{ display: 'inline-block', height: 8, width: Math.round((c / p.review_count) * 140), background: '#111', verticalAlign: 'middle' }} /> {c}</div>; })}
              {reviews.map((r, i) => <div key={i} style={{ borderTop: '1px solid #eee', padding: '12px 0' }}><Stars n={r.rating} /> <b>{r.title}</b><div>{r.body}</div><div className="low">{r.who}{r.verified ? ' \u00b7 Verified purchase' : ''} \u00b7 {new Date(r.created_at).toLocaleDateString('en-ZA')}</div></div>)}
            </>
          ) : <p className="low">No reviews yet.</p>}
          {searchParams?.saved && <p className="low">{searchParams.saved}</p>}{searchParams?.error && <p className="err">{searchParams.error}</p>}
          {can && can.delivered > 0 && !can.done && (
            <form method="post" action="/api/account/review" style={{ marginTop: 16 }}>
              <input type="hidden" name="slug" value={p.slug} />
              <label className="label" htmlFor="rating">Your rating</label>
              <select id="rating" name="rating" required><option value="">Choose</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</select>
              <input name="title" placeholder="Title (optional)" maxLength={120} aria-label="Review title" />
              <textarea name="body" placeholder="Tell others what you think" maxLength={2000} rows={4} aria-label="Review" style={{ width: '100%' }} />
              <button className="btn">Submit review</button>
            </form>
          )}
          {can && can.done > 0 && <p className="low">Thanks, you have reviewed this product.</p>}
          {can && !can.delivered && <p className="low">You can review this product once your order has been delivered.</p>}
          {!user && <p className="low"><Link href="/login">Log in</Link> to review products you have bought.</p>}
        </section>
      )}
    </>
  );
}
