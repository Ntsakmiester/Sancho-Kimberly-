'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../components/CartProvider';
import { price } from '../../lib/format';
import { shippingFor, PROVINCES } from '../../lib/config';
const empty = { name: '', email: '', phone: '', address: '', suburb: '', city: '', province: '', postal: '' };
export default function Checkout() {
  const { items, subtotal, clear, ready } = useCart();
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!ready) return <section className="wrap shop"><h2>Checkout</h2></section>;
  if (!items.length) return <section className="wrap shop"><h2>Checkout</h2><div className="empty"><b>Your cart is empty</b><Link className="btn" href="/shop">Shop</Link></div></section>;
  const ship = shippingFor(subtotal);
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: f, items: items.map(({ slug, size, qty }) => ({ slug, size, qty })) }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Something went wrong.'); setBusy(false); return; }
      router.push('/order/' + data.ref); clear();
    } catch (x) { setErr('Could not reach the server. Try again.'); setBusy(false); }
  }
  return (
    <section className="wrap shop">
      <h2>Checkout</h2>
      <form className="two cartgrid" onSubmit={submit}>
        <div>
          <input placeholder="Full name" aria-label="Full name" value={f.name} onChange={set('name')} autoComplete="name" required />
          <input type="email" placeholder="Email address" aria-label="Email address" value={f.email} onChange={set('email')} autoComplete="email" required />
          <input type="tel" placeholder="Phone number" aria-label="Phone number" value={f.phone} onChange={set('phone')} autoComplete="tel" required />
          <input placeholder="Street address" aria-label="Street address" value={f.address} onChange={set('address')} autoComplete="street-address" required />
          <input placeholder="Suburb" aria-label="Suburb" value={f.suburb} onChange={set('suburb')} required />
          <input placeholder="City" aria-label="City" value={f.city} onChange={set('city')} required />
          <select aria-label="Province" value={f.province} onChange={set('province')} required>
            <option value="">Province</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input placeholder="Postal code" aria-label="Postal code" value={f.postal} onChange={set('postal')} inputMode="numeric" required />
        </div>
        <div className="sum">
          {items.map((x) => <div className="row" key={x.slug + x.size}><span>{x.qty} &times; {x.name} ({x.size})</span><span>{price(x.price_cents * x.qty)}</span></div>)}
          <div className="row"><span>Delivery</span><span>{ship ? price(ship) : 'Free'}</span></div>
          <div className="row tot"><span>Total</span><span>{price(subtotal + ship)}</span></div>
          {err && <p className="err">{err}</p>}
          <button className="btn full" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
          <p className="low">Payment is the next step and is being added.</p>
        </div>
      </form>
    </section>
  );
}
