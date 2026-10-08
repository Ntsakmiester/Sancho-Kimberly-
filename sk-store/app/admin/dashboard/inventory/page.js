import pool from '../../../../lib/db';
import { pagePerm, pg } from '../../../../lib/adminpage';
import { Table, Td, Pager, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
const REASONS = ['PURCHASE', 'RESTOCK', 'MANUAL_ADJUSTMENT', 'CORRECTION', 'RETURN'];
export default async function Inventory({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { perms } = await pagePerm('inventory.view');
  const { page, size, offset } = pg(sp, 30); const q = String(sp?.q || '').trim().slice(0, 60); const f = sp?.filter || '';
  const rows = (await pool.query(`select v.id,p.name,v.size,v.colour,v.sku,v.qty,coalesce(v.low_stock_threshold,p.low_stock_threshold) low,count(*) over()::int total from variants v join products p on p.id=v.product_id
    where p.archived_at is null and ($1='' or p.name ilike '%'||$1||'%' or v.sku ilike '%'||$1||'%') and ($2='' or ($2='low' and v.qty>0 and v.qty<=coalesce(v.low_stock_threshold,p.low_stock_threshold)) or ($2='out' and v.qty=0)) order by v.qty,p.name limit $3 offset $4`, [q, f, size, offset])).rows;
  const hist = (await pool.query(`select m.*,p.name,v.size,u.email who from inventory_movements m join variants v on v.id=m.variant_id join products p on p.id=v.product_id left join users u on u.id=m.user_id order by m.id desc limit 20`)).rows;
  const can = perms.has('inventory.edit');
  return (
    <>
      <Flash sp={sp} /><h3>Inventory</h3><p className="lead">Add or remove units. Every adjustment is recorded; stock cannot go below zero.</p>
      <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Product or SKU" aria-label="Search" /> <select name="filter" defaultValue={f} aria-label="Filter"><option value="">All</option><option value="low">Low stock</option><option value="out">Out of stock</option></select> <button className="btn">Filter</button> <a href="/api/admin/export/inventory">Export CSV</a></form>
      <p className="low">On phones, swipe the table sideways to reach Add / Remove controls.</p>
      <Table head={['Product', 'Size', 'SKU', 'Stock', 'Status', 'Adjust']} count={rows.length} empty="No items match.">
        {rows.map((v) => <tr key={v.id}><Td>{v.name}</Td><Td>{v.size}{v.colour ? ' / ' + v.colour : ''}</Td><Td>{v.sku}</Td><Td><b>{v.qty}</b></Td><Td>{v.qty === 0 ? 'Out of stock' : v.qty <= v.low ? 'Low' : ''}</Td>
          <Td>{can && <form method="post" action="/api/admin/inventory" className="stock-adjust"><input type="hidden" name="variant_id" value={v.id} /><select name="operation" aria-label="Stock action"><option value="add">Add stock</option><option value="remove">Remove stock</option></select><input type="number" name="quantity" min="1" step="1" placeholder="Units" inputMode="numeric" required aria-label="Units" /><select name="reason" aria-label="Reason">{REASONS.map((r) => <option key={r}>{r}</option>)}</select><input name="note" placeholder="Note" size={10} aria-label="Note" /><button className="btn">Apply</button></form>}</Td></tr>)}
      </Table>
      <Pager base={`/admin/dashboard/inventory?q=${encodeURIComponent(q)}&filter=${f}`} page={page} size={size} total={rows[0]?.total} />
      <h3 style={{ marginTop: 20 }}>Recent stock changes</h3>
      <Table head={['When', 'Item', 'Before', 'Change', 'After', 'Reason', 'By']} count={hist.length}>{hist.map((m) => <tr key={m.id}><Td>{new Date(m.created_at).toLocaleString('en-ZA')}</Td><Td>{m.name} ({m.size})</Td><Td>{m.previous_qty}</Td><Td>{m.change > 0 ? '+' + m.change : m.change}</Td><Td>{m.new_qty}</Td><Td>{m.reason}</Td><Td>{m.who || 'system'}</Td></tr>)}</Table>
    </>
  );
}
