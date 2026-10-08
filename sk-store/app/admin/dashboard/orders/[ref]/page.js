import { notFound } from 'next/navigation';
import pool from '../../../../../lib/db';
import { pagePerm } from '../../../../../lib/adminpage';
import { money } from '../../../../../lib/format';
import { allowedNext } from '../../../../../lib/orders';
import { Table, Td, Flash } from '../../../../../components/ui';
import Confirm from '../../../../../components/Confirm';
export const dynamic = 'force-dynamic';
export default async function Order({ params: paramsPromise, searchParams: spPromise }) {
  const params = await paramsPromise;
  const sp = await spPromise;
  const { perms } = await pagePerm('orders.view');
  const o = (await pool.query('select * from orders where ref=$1', [params.ref])).rows[0]; if (!o) notFound();
  const items = (await pool.query('select * from order_items where order_id=$1 order by id', [o.id])).rows;
  const hist = (await pool.query('select h.*,u.email who from order_status_history h left join users u on u.id=h.user_id where order_id=$1 order by h.id', [o.id])).rows;
  const pays = (await pool.query('select * from payments where order_id=$1 order by id', [o.id])).rows;
  const refunds = (await pool.query('select * from refunds where order_id=$1 order by id', [o.id])).rows;
  const next = allowedNext(o.status); const canU = perms.has('orders.update'); const canR = perms.has('refunds.create');
  return (
    <>
      <Flash sp={sp} /><h3>Order {o.ref}</h3>
      <p>Status <b>{o.status}</b> &middot; payment <b>{o.payment_status}</b> &middot; stock {o.stock_status}</p>
      <p>{o.name} &middot; {o.email} &middot; {o.phone}<br />{o.address}, {o.suburb}, {o.city}, {o.province}, {o.postal}</p>
      <Table head={['Item', 'Qty', 'Price', 'SKU']} count={items.length}>{items.map((i) => <tr key={i.id}><Td>{i.name} ({i.size}{i.colour ? ', ' + i.colour : ''})</Td><Td>{i.qty}</Td><Td>{money(i.price_cents)}</Td><Td>{i.sku}</Td></tr>)}</Table>
      <p>Subtotal {money(o.subtotal_cents)}{o.discount_cents ? ` · Discount −${money(o.discount_cents)}${o.coupon_code ? ' (' + o.coupon_code + ')' : ''}` : ''} · Delivery {money(o.shipping_cents)} · VAT included {money(o.vat_cents)} · <b>Total {money(o.total_cents)}</b></p>
      {canU && next.length > 0 && (
        <form method="post" action="/api/admin/orders" style={{ maxWidth: 520 }}>
          <input type="hidden" name="ref" value={o.ref} />
          <select name="status" aria-label="New status"><option value="">Keep {o.status}</option>{next.map((s) => <option key={s}>{s}</option>)}</select>
          <input name="courier" placeholder="Courier" defaultValue={o.courier || ''} aria-label="Courier" /><input name="tracking_number" placeholder="Tracking number" defaultValue={o.tracking_number || ''} aria-label="Tracking number" />
          <input type="date" name="est_delivery" defaultValue={o.est_delivery ? new Date(o.est_delivery).toISOString().slice(0, 10) : ''} aria-label="Estimated delivery" /><input name="note" placeholder="Note (optional)" aria-label="Note" />
          <Confirm message="Update this order? The customer may be emailed.">Update order</Confirm>
        </form>
      )}
      <h3 style={{ marginTop: 20 }}>Payments</h3>
      <Table head={['Provider', 'Reference', 'Amount', 'Status', 'Paid']} count={pays.length} empty="No payment started.">{pays.map((p) => <tr key={p.id}><Td>{p.provider}</Td><Td>{p.provider_ref}</Td><Td>{money(p.amount_cents)}</Td><Td>{p.status}</Td><Td>{p.paid_at ? new Date(p.paid_at).toLocaleString('en-ZA') : ''}</Td></tr>)}</Table>
      <h3 style={{ marginTop: 20 }}>Refunds</h3>
      <Table head={['Amount', 'Reason', 'Status', '']} count={refunds.length} empty="No refunds.">
        {refunds.map((r) => <tr key={r.id}><Td>{money(r.amount_cents)}</Td><Td>{r.reason}</Td><Td>{r.status}</Td><Td>{canR && ['REQUESTED', 'APPROVED', 'PROCESSING'].includes(r.status) && (
          <form method="post" action="/api/admin/refunds" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><input type="hidden" name="refund_id" value={r.id} /><input type="hidden" name="ref" value={o.ref} />
            {r.status === 'REQUESTED' && <><Confirm message="Approve this refund?" name="action" value="approve">Approve</Confirm><Confirm message="Reject this refund?" name="action" value="reject">Reject</Confirm></>}
            {['APPROVED', 'PROCESSING'].includes(r.status) && <><Confirm message="Mark as refunded? Only do this once the money has been returned." name="action" value="complete">Mark completed</Confirm><Confirm message="Mark this refund as failed?" name="action" value="fail">Failed</Confirm></>}</form>)}</Td></tr>)}
      </Table>
      {canR && ['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status) && (
        <form method="post" action="/api/admin/refunds" style={{ maxWidth: 420, marginTop: 8 }}>
          <input type="hidden" name="action" value="create" /><input type="hidden" name="ref" value={o.ref} />
          <input name="amount" placeholder="Amount in rand (partial)" inputMode="decimal" aria-label="Refund amount" /><label><input type="checkbox" name="full" /> Refund the full remaining amount</label>
          <input name="reason" placeholder="Reason" required aria-label="Reason" /><label><input type="checkbox" name="restock" /> Put the items back in stock</label>
          <button className="btn">Request refund</button>
        </form>
      )}
      <h3 style={{ marginTop: 20 }}>History</h3>
      <Table head={['When', 'Status', 'Note', 'By']} count={hist.length}>{hist.map((h) => <tr key={h.id}><Td>{new Date(h.created_at).toLocaleString('en-ZA')}</Td><Td>{h.status}</Td><Td>{h.note}</Td><Td>{h.who || 'system'}</Td></tr>)}</Table>
    </>
  );
}
