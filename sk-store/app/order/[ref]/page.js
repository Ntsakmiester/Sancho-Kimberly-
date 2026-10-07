import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '../../../lib/db';
import { price } from '../../../lib/format';
import OrderPoll from '../../../components/OrderPoll';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order | Sancho Kimberly', robots: { index: false, follow: false } };
const MSG = { PAID: 'Payment confirmed. Thank you!', UNPAID: 'Waiting for payment confirmation from the payment provider.', FAILED: 'Your payment did not go through.', CANCELLED: 'Payment was cancelled.', REFUNDED: 'This order has been refunded.', PARTIALLY_REFUNDED: 'This order has been partly refunded.' };
// Public page keyed by the unguessable reference: shows status and items only. Delivery address, email and phone are never shown here.
export default async function OrderPage({ params }) {
  const o = (await pool.query('select * from orders where ref=$1', [params.ref])).rows[0];
  if (!o) notFound();
  const items = (await pool.query('select name,size,colour,qty,price_cents from order_items where order_id=$1 order by id', [o.id])).rows;
  const unpaid = o.payment_status === 'UNPAID';
  return (
    <section className="wrap shop">
      <h2>{o.payment_status === 'PAID' ? 'Order confirmed' : 'Order ' + o.ref}</h2>
      <p className="lead">Reference <b>{o.ref}</b>. {MSG[o.payment_status] || ''}</p>
      {unpaid && <OrderPoll refCode={o.ref} />}
      <div className="sum narrow">
        {items.map((x, i) => <div className="row" key={i}><span>{x.qty} &times; {x.name} ({x.size}{x.colour ? ', ' + x.colour : ''})</span><span>{price(x.price_cents * x.qty)}</span></div>)}
        {o.discount_cents > 0 && <div className="row"><span>Discount</span><span>&minus;{price(o.discount_cents)}</span></div>}
        <div className="row"><span>Delivery</span><span>{o.shipping_cents ? price(o.shipping_cents) : 'Free'}</span></div>
        <div className="row tot"><span>Total</span><span>{price(o.total_cents)}</span></div>
        <p className="low">Status: {o.status}{o.tracking_number ? ` · Tracking: ${o.tracking_number}` : ''}</p>
        <Link className="btn" href="/shop">Keep shopping</Link>
      </div>
    </section>
  );
}
