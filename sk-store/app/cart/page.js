'use client';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
import { price } from '../../lib/format';
import { shippingFor, FREE_SHIPPING_OVER_CENTS } from '../../lib/config';
export default function Cart() {
  const { items, setQty, remove, subtotal, ready } = useCart();
  if (!ready) return <section className="wrap shop"><h2>Your cart</h2></section>;
  if (!items.length) return <section className="wrap shop"><h2>Your cart</h2><div className="empty"><b>Your cart is empty</b>Pick something from the shop.<br /><Link className="btn" href="/shop">Shop</Link></div></section>;
  const ship = shippingFor(subtotal);
  return (
    <section className="wrap shop">
      <h2>Your cart</h2>
      <div className="two cartgrid">
        <div>
          {items.map((x) => (
            <div className="line" key={x.slug + x.size}>
              <img src={x.image} alt={x.name} />
              <div className="grow">
                <b>{x.name}</b>
                <div className="price">Size {x.size} &middot; {price(x.price_cents)}</div>
                <div className="qty">
                  <button onClick={() => setQty(x.slug, x.size, x.qty - 1)} aria-label="Less">&minus;</button>
                  <span>{x.qty}</span>
                  <button onClick={() => setQty(x.slug, x.size, x.qty + 1)} aria-label="More">+</button>
                  <button className="ul" onClick={() => remove(x.slug, x.size)}>Remove</button>
                </div>
              </div>
              <div className="price">{price(x.price_cents * x.qty)}</div>
            </div>
          ))}
        </div>
        <div className="sum">
          <div className="row"><span>Subtotal</span><span>{price(subtotal)}</span></div>
          <div className="row"><span>Delivery</span><span>{ship ? price(ship) : 'Free'}</span></div>
          {ship > 0 && <p className="low">Free delivery on orders over {price(FREE_SHIPPING_OVER_CENTS)}.</p>}
          <div className="row tot"><span>Total</span><span>{price(subtotal + ship)}</span></div>
          <Link className="btn full center" href="/checkout">Checkout</Link>
        </div>
      </div>
    </section>
  );
}
