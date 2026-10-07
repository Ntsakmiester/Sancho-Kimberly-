'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
export default function ProductView({ p }) {
  const cart = useCart();
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(p.variants.length === 1 ? 0 : null);
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState(false);
  const im = p.images[i] || {};
  const v = sel != null ? p.variants[sel] : null;
  const size = v ? v.size : null;
  const onAdd = () => {
    if (!size) { setMsg('Choose a size first.'); setAdded(false); return; }
    cart.add({ slug: p.slug, name: p.name, size, colour: v.colour || '', price_cents: v.price_cents != null ? v.price_cents : p.price_cents, image: p.images[0]?.url });
    setMsg('Added to your cart.'); setAdded(true);
  };
  return (
    <div className="wrap pdp">
      <Link className="back" href="/shop">&larr; Shop</Link>
      <div className="two">
        <div>
          <div className="tile" style={{ background: im.bg }}><img src={im.url} alt={im.alt || p.name} /></div>
          {p.images.length > 1 && (
            <div className="thumbs">
              {p.images.map((x, j) => (
                <button key={j} className={j === i ? 'sel' : ''} onPointerDown={() => setI(j)} aria-label={`View ${j + 1}`}><img src={x.url} alt="" /></button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="h2">{p.name}</h1>
          <p className="pbig">{p.saleText ? <><s style={{ opacity: 0.55 }}>{p.priceText}</s> {p.saleText}</> : p.priceText}</p>
          {p.review_count > 0 && <p className="low">&#9733; {p.rating} &middot; {p.review_count} review{p.review_count === 1 ? '' : 's'}</p>}
          <p className="desc">{p.description}</p>
          <div className="label">{p.variants.some((x) => x.colour) ? 'Size / colour' : 'Size'}</div>
          <div className="sizes">
            {p.variants.map((x, k) => (
              <button key={x.size + '|' + x.colour} disabled={x.qty <= 0} className={k === sel ? 'sel' : ''} onPointerDown={() => { setSel(k); setMsg(''); setAdded(false); }}>{x.size}{x.colour ? ' \u00b7 ' + x.colour : ''}</button>
            ))}
          </div>
          {v && v.qty > 0 && v.qty <= 3 && <p className="low">Only {v.qty} left</p>}
          <button className="btn full" onClick={onAdd}>Add to cart</button>
          {msg && <p className="low">{msg} {added && <Link href="/cart" className="ul">View cart</Link>}</p>}
          <div className="ship">Delivery nationwide. Estimated times are shown at checkout.<br />Secure online payment.<br />Free returns within 7 days.</div>
        </div>
      </div>
    </div>
  );
}
