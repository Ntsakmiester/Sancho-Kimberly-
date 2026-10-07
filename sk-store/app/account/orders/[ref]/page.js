import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '../../../../lib/db';
import { requirePageRole } from '../../../../lib/pageguard';
import { money } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order | Sancho Kimberly', robots: { index: false, follow: false } };
export default async function AccountOrder({ params, searchParams: sp }) {
  const u = await requirePageRole('customer', '/login');
  const o = (await pool.query('select * from orders where ref=$1 and user_id=$2', [params.ref, u.id])).rows[0];
  if (!o) notFound();
  const items = (await pool.query('select name,size,colour,qty,price_cents from order_items where order_id=$1 order by id', [o.id])).rows;
  const hist = (await pool.query('select status as to_status,created_at from order_status_history where order_id=$1 order by id', [o.id])).rows;
  const refunds = (await pool.query('select amount_cents,status,reason,created_at from refunds where order_id=$1 order by id', [o.id])).rows;
  const canRefund = o.payment_status === 'PAID' || o.payment_status === 'PARTIALLY_REFUNDED';
  return (
    <section className="wrap shop">
      <p><Link href="/account">&larr; My account</Link></p><h2>Order {o.ref}</h2>
      {sp?.saved && <p style={{ color: '#146c2e' }} role="status">{sp.saved === '1' ? 'Saved.' : sp.saved}</p>}{sp?.error && <p className="err" role="alert">{sp.error}</p>}
      <p>Status: <b>{o.status}</b> &middot; Payment: {o.payment_status}{o.tracking_number ? ` · ${o.courier || 'Courier'} tracking: ${o.tracking_number}` : ''}</p>
      <div className="sum narrow">
        {items.map((x, i) => <div className="row" key={i}><span>{x.qty} &times; {x.name} ({x.size}{x.colour ? ', ' + x.colour : ''})</span><span>{money(x.price_cents * x.qty)}</span></div>)}
        {o.discount_cents > 0 && <div className="row"><span>Discount</span><span>&minus;{money(o.discount_cents)}</span></div>}
        <div className="row"><span>Delivery</span><span>{o.shipping_cents ? money(o.shipping_cents) : 'Free'}</span></div><div className="row tot"><span>Total</span><span>{money(o.total_cents)}</span></div>
      </div>
      <p className="low">Delivering to: {o.address}, {o.city}, {o.province} {o.postal}</p>
      {hist.length > 0 && <><h3>Progress</h3>{hist.map((h, i) => <p key={i} className="low">{h.to_status} - {new Date(h.created_at).toLocaleString('en-ZA')}</p>)}</>}
      {refunds.length > 0 && <><h3>Refund requests</h3>{refunds.map((r, i) => <p key={i}>{money(r.amount_cents)} - {r.status}</p>)}</>}
      {canRefund && <form method="post" action="/api/account/refund" style={{ display: 'grid', gap: 8, maxWidth: 380, marginTop: 16 }}><h3>Request a refund</h3><input type="hidden" name="ref" value={o.ref} />
        <input name="amount" placeholder="Amount in rand (leave empty for full)" inputMode="decimal" aria-label="Amount" /><textarea name="reason" rows={3} placeholder="Reason" required aria-label="Reason" /><button className="btn">Request refund</button></form>}
    </section>
  );
}
