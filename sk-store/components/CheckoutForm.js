'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';
import { price } from '../lib/format';
import { PROVINCES } from '../lib/config';
const empty = { name: '', email: '', phone: '', address: '', suburb: '', city: '', province: '', postal: '' };
export default function CheckoutForm() {
  const { items, subtotal, clear, ready } = useCart();
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [q, setQ] = useState(null);
  const [qerr, setQerr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const payload = () => items.map(({ slug, size, colour, qty }) => ({ slug, size, colour: colour || '', qty }));
  useEffect(() => {
    if (!ready || !items.length) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: payload(), province: f.province || 'Gauteng', coupon, email: f.email }) });
        const d = await r.json(); if (r.ok) { setQ(d); setQerr(''); } else { setQ(null); setQerr(d.error || ''); }
      } catch (e) {}
    }, 300);
    return () => clearTimeout(t);
  }, [ready, items, f.province, coupon]);
  if (!ready) return <section className="wrap shop"><h2>Checkout</h2></section>;
  if (!items.length) return <section className="wrap shop"><h2>Checkout</h2><div className="empty"><b>Your cart is empty</b><Link className="btn" href="/shop">Shop</Link></div></section>;
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: f, coupon, items: payload() }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Something went wrong.'); setBusy(false); return; }
      if (data.payment?.redirect) { clear(); router.push(data.payment.redirect); return; }
      if (data.payment?.action) {
        const form = document.createElement('form'); form.method = 'POST'; form.action = data.payment.action;
        for (const [k, v] of Object.entries(data.payment.fields)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); }
        document.body.appendChild(form); clear(); form.submit(); return;
      }
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
          <input type="tel" placeholder="Phone number (e.g. 082 123 4567)" aria-label="Phone number" value={f.phone} onChange={set('phone')} autoComplete="tel" required />
          <input placeholder="Street address" aria-label="Street address" value={f.address} onChange={set('address')} autoComplete="street-address" required />
          <input placeholder="Suburb" aria-label="Suburb" value={f.suburb} onChange={set('suburb')} required />
          <input placeholder="City" aria-label="City" value={f.city} onChange={set('city')} required />
          <select aria-label="Province" value={f.province} onChange={set('province')} required>
            <option value="">Province</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input placeholder="Postal code" aria-label="Postal code" value={f.postal} onChange={set('postal')} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required />
        </div>
        <div className="sum">
          {items.map((x) => <div className="row" key={x.slug + x.size + (x.colour || '')}><span>{x.qty} &times; {x.name} ({x.size}{x.colour ? ', ' + x.colour : ''})</span><span>{price(x.price_cents * x.qty)}</span></div>)}
          <div className="row"><span>Subtotal</span><span>{price(q ? q.subtotal : subtotal)}</span></div>
          {q && q.discount > 0 && <div className="row"><span>Discount</span><span>&minus;{price(q.discount)}</span></div>}
          <div className="row"><span>Delivery</span><span>{q ? (q.shipping ? price(q.shipping) : 'Free') : '...'}</span></div>
          <div className="row tot"><span>Total</span><span>{q ? price(q.total) : price(subtotal)}</span></div>
          {q && <p className="low">{q.method}, about {q.estDays[0]} to {q.estDays[1]} working days.</p>}
          <input placeholder="Coupon code (optional)" aria-label="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={40} />
          {qerr && <p className="err">{qerr}</p>}
          {err && <p className="err">{err}</p>}
          <button className="btn full" disabled={busy}>{busy ? 'Starting payment…' : 'Place order and pay'}</button>
          <p className="low">You will be taken to our secure payment page. Stock is reserved only once your payment is confirmed.</p>
        </div>
      </form>
    </section>
  );
}
