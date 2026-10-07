import pool from '../../../../lib/db';
import { pagePerm } from '../../../../lib/adminpage';
import { PROVINCES } from '../../../../lib/config';
import { Table, Td, Flash } from '../../../../components/ui';
import { money, rands } from '../../../../lib/format';
export const dynamic = 'force-dynamic';
export default async function Shipping({ searchParams: sp }) {
  await pagePerm('shipping.manage');
  const rows = (await pool.query('select * from shipping_rates order by id')).rows;
  const F = ({ r }) => (
    <form method="post" action="/api/admin/shipping" style={{ maxWidth: 520 }}>
      {r && <><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="update" /></>}
      <input name="zone" placeholder="Zone name" defaultValue={r?.zone} required aria-label="Zone" /><input name="method" placeholder="Delivery method" defaultValue={r?.method || 'Standard delivery'} aria-label="Method" /><input name="courier" placeholder="Courier" defaultValue={r?.courier || ''} aria-label="Courier" />
      <input name="fee" placeholder="Fee in rand" defaultValue={r ? rands(r.fee_cents) : ''} required inputMode="decimal" aria-label="Fee" /><input name="free_over" placeholder="Free delivery over (rand, optional)" defaultValue={r?.free_over_cents != null ? rands(r.free_over_cents) : ''} inputMode="decimal" aria-label="Free over" />
      <input name="est_min" defaultValue={r?.est_days_min ?? 3} size={3} aria-label="Min days" /> to <input name="est_max" defaultValue={r?.est_days_max ?? 7} size={3} aria-label="Max days" /> working days
      <fieldset><legend className="low">Provinces</legend>{PROVINCES.map((p) => <label key={p} style={{ display: 'inline-block', marginRight: 10 }}><input type="checkbox" name="provinces" value={p} defaultChecked={r ? r.provinces.includes(p) : false} /> {p}</label>)}</fieldset>
      <button className="btn">{r ? 'Save' : 'Add rate'}</button>
    </form>
  );
  return (
    <>
      <Flash sp={sp} /><h3>Shipping rates</h3><p className="low">Fees are not hard-coded. If a province has no active rate, orders to it are refused. The starter rate (R 99, free over R 1 000) is a placeholder: set your real courier prices.</p>
      <Table head={['Zone', 'Method', 'Fee', 'Free over', 'Days', 'Active', '']} count={rows.length}>{rows.map((r) => <tr key={r.id}><Td>{r.zone}<br /><span className="low">{r.provinces.length} provinces</span></Td><Td>{r.method}</Td><Td>{money(r.fee_cents)}</Td><Td>{r.free_over_cents != null ? money(r.free_over_cents) : '-'}</Td><Td>{r.est_days_min}-{r.est_days_max}</Td><Td>{r.active ? 'Yes' : 'No'}</Td>
        <Td><form method="post" action="/api/admin/shipping"><input type="hidden" name="id" value={r.id} /><button className="btn" name="action" value="toggle">{r.active ? 'Turn off' : 'Turn on'}</button></form></Td></tr>)}</Table>
      {rows.map((r) => <details key={r.id} style={{ marginTop: 8 }}><summary>Edit {r.zone}</summary><F r={r} /></details>)}
      <h3 style={{ marginTop: 16 }}>Add a rate</h3><F />
    </>
  );
}
