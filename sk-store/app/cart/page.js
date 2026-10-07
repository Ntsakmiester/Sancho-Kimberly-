'use client';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
import { price } from '../../lib/format';
export default function Cart() {
  const { items, setQty, remove, subtotal, ready } = useCart();
  if (!ready) return <section className="wrap shop"><h2>Your cart</h2></section>;
  if (!items.length) return <section className="wrap shop"><h2>Your cart</h2><div className="empty"><b>Your cart is empty</b>Pick something from the shop.<br /><Link className="btn" href="/shop">Shop</Link></div></section>;
  return (
    <section className="wrap shop">
      <h2>Your cart</h2>
      <div className="two cartgrid">
        <div>
          {items.map((x) => (
            <div className="line" key={x.slug + x.size + (x.colour || '')}>
              <img src={x.image} alt={x.name} />
              <div className="grow">
                <b>{x.name}</b>
                <div className="price">Size {x.size}{x.colour ? ' \u00b7 ' + x.colour : ''} &middot; {price(x.price_cents)}</div>
                <div className="qty">
                  <button onClick={() => setQty(x.slug, x.size, x.qty - 1, x.colour || '')} aria-label="Less">&minus;</button>
                  <span>{x.qty}</span>
                  <button onClick={() => setQty(x.slug, x.size, x.qty + 1, x.colour || '')} aria-label="More">+</button>
                  <button className="ul" onClick={() => remove(x.slug, x.size, x.colour || '')}>Remove</button>
                </div>
              </div>
              <div className="price">{price(x.price_cents * x.qty)}</div>
            </div>
          ))}
        </div>
        <div className="sum">
          <div className="row"><span>Subtotal</span><span>{price(subtotal)}</span></div>
          <p className="low">Delivery and any discount are calculated at checkout.</p>
          <Link className="btn full center" href="/checkout">Checkout</Link>
        </div>
      </div>
    </section>
  );
}
