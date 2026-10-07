'use client';
import { useState } from 'react';
import ProductGallery from './ProductGallery';
import Link from 'next/link';
import { price } from '../lib/format';
import { useCart } from './CartProvider';
export default function ProductView({ p }) {
  const cart = useCart();
  const [useVariantImage, setUseVariantImage] = useState(true);
  const colours = [...new Set(p.variants.map(x => x.colour || ''))];
  const hasColours = colours.some(Boolean);
  const [colour, setColour] = useState(p.variants.find(x => x.qty > 0)?.colour || colours[0] || '');
  const [sel, setSel] = useState(p.variants.length === 1 ? 0 : null);
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState(false);
  const v = sel != null ? p.variants[sel] : null;
  const size = v ? v.size : null;
  const chooseVariant = (k) => { setUseVariantImage(true); setSel(k); setMsg(''); setAdded(false); };
  const onAdd = () => {
    if (!size || v.qty <= 0) { setMsg('Choose an available size first.'); setAdded(false); return; }
    cart.add({ slug: p.slug, name: p.name, size, colour: v.colour || '', price_cents: v.price_cents != null ? v.price_cents : p.price_cents, image: v?.image_url || p.images[0]?.url });
    setMsg('Added to your cart.'); setAdded(true);
  };
  return (
    <div className="wrap pdp">
      <Link className="back" href="/shop">&larr; Shop</Link>
      <div className="two">
        <div>
          <ProductGallery images={p.images} name={p.name} overrideImage={useVariantImage ? v?.image_url : null} onNavigate={() => setUseVariantImage(false)} />
        </div>
        <div>
          <h1 className="h2">{p.name}</h1>
          <p className="pbig">{v?.price_cents != null ? price(v.price_cents) : p.saleText ? <><s style={{ opacity: 0.55 }}>{p.priceText}</s> {p.saleText}</> : p.priceText}</p>
          {p.review_count > 0 && <p className="low">&#9733; {p.rating} &middot; {p.review_count} review{p.review_count === 1 ? '' : 's'}</p>}
          <p className="desc">{p.description}</p>
          {hasColours && <fieldset className="variant-field"><legend className="label">Colour: {colour || 'Original'}</legend><div className="colour-options">
            {colours.map(c => { const available = p.variants.some(x => (x.colour || '') === c && x.qty > 0); return <button type="button" key={c} className={c === colour ? 'sel' : ''} aria-pressed={c === colour} disabled={!available} onClick={() => {
              setColour(c); setUseVariantImage(true); const next = p.variants.findIndex(x => (x.colour || '') === c && x.size === size && x.qty > 0);
              setSel(next >= 0 ? next : null); setMsg(''); setAdded(false);
            }}>{c || 'Original'}{!available ? ' (sold out)' : ''}</button>; })}
          </div></fieldset>}
          <fieldset className="variant-field"><legend className="label">Size</legend><div className="sizes">
            {p.variants.map((x, k) => (!hasColours || (x.colour || '') === colour) && <button type="button" key={x.size + '|' + x.colour} disabled={x.qty <= 0} className={k === sel ? 'sel' : ''} aria-pressed={k === sel} onClick={() => chooseVariant(k)}>{x.size}</button>)}
          </div></fieldset>
          {v && v.qty > 0 && v.qty <= 3 && <p className="low">Only {v.qty} left</p>}
          <button className="btn full" onClick={onAdd} disabled={!p.variants.some(x => x.qty > 0)}>{p.variants.some(x => x.qty > 0) ? 'Add to cart' : 'Sold out'}</button>
          {msg && <p className="low" role="status">{msg} {added && <Link href="/cart" className="ul">View cart</Link>}</p>}
          <div className="ship">Delivery nationwide. Estimated times are shown at checkout.<br />Secure online payment.<br />Free returns within 7 days.</div>
        </div>
      </div>
    </div>
  );
}
