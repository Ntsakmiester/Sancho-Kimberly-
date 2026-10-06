import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '../../../lib/db';
import { price } from '../../../lib/format';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order | Sancho Kimberly' };
export default async function OrderPage({ params }) {
  const o = (await pool.query('select * from orders where ref=$1', [params.ref])).rows[0];
  if (!o) notFound();
  const items = (await pool.query('select name,size,qty,price_cents from order_items where order_id=$1 order by id', [o.id])).rows;
  return (
    <section className="wrap shop">
      <h2>Order received</h2>
      <p className="lead">Your order reference is <b>{o.ref}</b>. We'll email {o.email} when payment is confirmed.</p>
      <div className="sum narrow">
        {items.map((x, i) => <div className="row" key={i}><span>{x.qty} &times; {x.name} ({x.size})</span><span>{price(x.price_cents * x.qty)}</span></div>)}
        <div className="row"><span>Delivery</span><span>{o.shipping_cents ? price(o.shipping_cents) : 'Free'}</span></div>
        <div className="row tot"><span>Total</span><span>{price(o.total_cents)}</span></div>
        <p className="low">Status: {o.status}. Payment is the next step and is being added.</p>
        <Link className="btn" href="/shop">Keep shopping</Link>
      </div>
    </section>
  );
}
