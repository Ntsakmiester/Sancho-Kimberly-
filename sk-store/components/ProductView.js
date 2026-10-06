'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
export default function ProductView({ p }) {
  const cart = useCart();
  const [i, setI] = useState(0);
  const [size, setSize] = useState(p.variants.length === 1 ? p.variants[0].size : null);
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState(false);
  const im = p.images[i] || {};
  const v = p.variants.find((x) => x.size === size);
  const onAdd = () => {
    if (!size) { setMsg('Choose a size first.'); setAdded(false); return; }
    cart.add({ slug: p.slug, name: p.name, size, price_cents: p.price_cents, image: p.images[0]?.url });
    setMsg('Added to your cart.'); setAdded(true);
  };
  return (
    <div className="wrap pdp">
      <Link className="back" href="/shop">&larr; Shop</Link>
      <div className="two">
        <div>
          <div className="tile" style={{ background: im.bg }}><img src={im.url} alt={p.name} /></div>
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
          <p className="pbig">{p.priceText}</p>
          <p className="desc">{p.description}</p>
          <div className="label">Size</div>
          <div className="sizes">
            {p.variants.map((x) => (
              <button key={x.size} disabled={x.qty <= 0} className={x.size === size ? 'sel' : ''} onPointerDown={() => { setSize(x.size); setMsg(''); setAdded(false); }}>{x.size}</button>
            ))}
          </div>
          {v && v.qty > 0 && v.qty <= 3 && <p className="low">Only {v.qty} left</p>}
          <button className="btn full" onClick={onAdd}>Add to cart</button>
          {msg && <p className="low">{msg} {added && <Link href="/cart" className="ul">View cart</Link>}</p>}
          <div className="ship">Delivery in 3 to 5 working days, nationwide.<br />Pay by card or instant EFT.<br />Free returns within 7 days.</div>
        </div>
      </div>
    </div>
  );
}
