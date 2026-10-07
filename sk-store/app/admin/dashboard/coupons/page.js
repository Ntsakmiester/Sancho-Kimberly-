import pool from '../../../../lib/db';
import { pagePerm } from '../../../../lib/adminpage';
import { Table, Td, Flash } from '../../../../components/ui';
import { money } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Coupons({ searchParams: sp }) {
  await pagePerm('coupons.manage');
  const rows = (await pool.query("select c.*,(select count(*)::int from coupon_redemptions r join orders o on o.id=r.order_id where r.coupon_id=c.id and o.payment_status='PAID') used from coupons c order by id desc limit 100")).rows;
  return (
    <>
      <Flash sp={sp} /><h3>Coupons</h3>
      <Table head={['Code', 'Discount', 'Min order', 'Valid', 'Used', 'Active', '']} count={rows.length} empty="No coupons yet.">
        {rows.map((c) => <tr key={c.id}><Td><b>{c.code}</b></Td><Td>{c.kind === 'PERCENT' ? c.value + '%' : money(c.value)}</Td><Td>{money(c.min_order_cents)}</Td><Td>{c.starts_at ? new Date(c.starts_at).toLocaleDateString('en-ZA') : 'now'} to {c.ends_at ? new Date(c.ends_at).toLocaleDateString('en-ZA') : 'no end'}</Td><Td>{c.used}{c.max_uses ? '/' + c.max_uses : ''}</Td><Td>{c.active ? 'Yes' : 'No'}</Td>
          <Td><form method="post" action="/api/admin/coupons"><input type="hidden" name="id" value={c.id} /><button className="btn" name="action" value="toggle">{c.active ? 'Turn off' : 'Turn on'}</button></form></Td></tr>)}
      </Table>
      <form method="post" action="/api/admin/coupons" style={{ maxWidth: 480, marginTop: 16 }}>
        <h3>New coupon</h3><input name="code" placeholder="CODE" required maxLength={30} aria-label="Code" />
        <select name="kind" aria-label="Type"><option value="PERCENT">Percent off</option><option value="FIXED">Fixed rand amount off</option></select>
        <input name="value" placeholder="Value (10 for 10%, or rand amount)" required inputMode="decimal" aria-label="Value" />
        <input name="min_order" placeholder="Minimum order in rand (optional)" inputMode="decimal" aria-label="Minimum order" />
        <label className="label">Starts<input type="date" name="starts_at" /></label><label className="label">Ends<input type="date" name="ends_at" /></label>
        <input name="max_uses" placeholder="Total uses allowed (optional)" inputMode="numeric" aria-label="Max uses" /><input name="max_uses_per_customer" placeholder="Uses per customer" defaultValue="1" inputMode="numeric" aria-label="Per customer" />
        <input name="product_ids" placeholder="Only these product IDs, comma separated (optional)" aria-label="Product IDs" /><input name="category_ids" placeholder="Only these category IDs (optional)" aria-label="Category IDs" />
        <label><input type="checkbox" name="first_order_only" /> First order only</label><button className="btn">Create coupon</button>
      </form>
    </>
  );
}
