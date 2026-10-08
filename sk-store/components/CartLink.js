'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';
export default function CartLink() {
  const { count } = useCart();
  const label = count > 0 ? `Cart (${count} item${count === 1 ? '' : 's'})` : 'Cart';
  return <Link className="header-cart" href="/cart" aria-label={label} title={label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, position: 'relative' }}>
    <span style={{ position: 'relative', display: 'inline-flex' }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 3h2l2.4 12h11.2l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
    {count > 0 && <span className="badge cart-count" aria-hidden="true">{count}</span>}
    </span>
  </Link>;
}
