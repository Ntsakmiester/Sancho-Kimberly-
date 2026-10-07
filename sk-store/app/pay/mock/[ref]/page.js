import { notFound } from 'next/navigation';
import pool from '../../../../lib/db';
import { provider } from '../../../../lib/payments';
import { price } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Test payment', robots: { index: false } };
export default async function MockPay({ params, searchParams }) {
  if (provider() !== 'mock') notFound();
  const pid = parseInt(searchParams?.p, 10);
  const r = (await pool.query('select p.id,p.amount_cents,o.ref from payments p join orders o on o.id=p.order_id where p.id=$1 and o.ref=$2', [pid, params.ref])).rows[0];
  if (!r) notFound();
  return (
    <section className="wrap shop">
      <h2>Test payment page</h2>
      <p className="err">This is the TEST gateway. No real money moves. It exists so the payment flow can be tried before real PayFast credentials are added.</p>
      <p>Order {r.ref}: <b>{price(r.amount_cents)}</b></p>
      <form method="post" action="/api/payments/mock">
        <input type="hidden" name="p" value={r.id} />
        <button className="btn" name="outcome" value="success">Simulate successful payment</button>{' '}
        <button className="btn" name="outcome" value="fail">Simulate failed payment</button>{' '}
        <button className="btn" name="outcome" value="cancel">Cancel</button>
      </form>
    </section>
  );
}
