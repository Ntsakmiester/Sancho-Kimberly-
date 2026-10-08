import Link from 'next/link';
import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { money } from '../../../../lib/format';
import { Table, Td, Pager } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Payments({ searchParams: spPromise }) {
  const sp = await spPromise;
  await pagePerm('payments.view');
  const { page, size, offset } = pg(sp); const st = ['INITIATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(sp?.status) ? sp.status : '';
  const rows = (await pool.query(`select p.id,p.provider,p.provider_ref,p.status,p.amount_cents,p.fee_cents,p.paid_at,p.created_at,o.ref,count(*) over()::int total from payments p join orders o on o.id=p.order_id where ($1='' or p.status=$1) order by p.id desc limit $2 offset $3`, [st, size, offset])).rows;
  const ev = (await pool.query('select created_at,provider,event_id,outcome,detail from payment_events order by id desc limit 15')).rows;
  return (
    <>
      <h3>Payments</h3>
      <form method="get"><select name="status" defaultValue={st} aria-label="Status"><option value="">All</option>{['INITIATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((s) => <option key={s}>{s}</option>)}</select> <button className="btn">Filter</button> <a href="/api/admin/export/payments">Export CSV</a></form>
      <Table head={['Order', 'Provider', 'Amount', 'Est. fee', 'Status', 'Paid']} count={rows.length} empty="No payments yet.">
        {rows.map((p) => <tr key={p.id}><Td><Link href={`/admin/dashboard/orders/${p.ref}`}>{p.ref}</Link></Td><Td>{p.provider}</Td><Td>{money(p.amount_cents)}</Td><Td>{p.fee_cents != null ? money(p.fee_cents) : ''}</Td><Td>{p.status}</Td><Td>{p.paid_at ? new Date(p.paid_at).toLocaleString('en-ZA') : ''}</Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/payments?status=${st}`} page={page} size={size} total={rows[0]?.total} />
      <h3 style={{ marginTop: 20 }}>Gateway notifications (latest)</h3>
      <Table head={['When', 'Provider', 'Event', 'Outcome', 'Detail']} count={ev.length} empty="None yet.">{ev.map((e, i) => <tr key={i}><Td>{new Date(e.created_at).toLocaleString('en-ZA')}</Td><Td>{e.provider}</Td><Td>{e.event_id}</Td><Td>{e.outcome}</Td><Td>{e.detail}</Td></tr>)}</Table>
    </>
  );
}
