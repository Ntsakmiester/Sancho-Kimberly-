import { requirePageRole } from '../../../../lib/pageguard';
import pool from '../../../../lib/db';
import { Table, Td, Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Flags({ searchParams: spPromise }) {
  const sp = await spPromise;
  await requirePageRole('owner', '/owner/login');
  const rows = (await pool.query('select key,enabled,description from feature_flags order by key')).rows;
  return (<>
    <Flash sp={sp} /><h3>Feature flags</h3><p className="low">Turn parts of the store on or off without a deploy. Changes are audited.</p>
    <Table head={['Feature', 'What it does', 'State', '']} count={rows.length}>{rows.map((f) => <tr key={f.key}><Td><b>{f.key}</b></Td><Td>{f.description}</Td><Td>{f.enabled ? 'ON' : 'OFF'}</Td>
      <Td><form method="post" action="/api/owner/flags"><input type="hidden" name="key" value={f.key} /><input type="hidden" name="enabled" value={f.enabled ? 'false' : 'true'} /><button className="btn">{f.enabled ? 'Turn off' : 'Turn on'}</button></form></Td></tr>)}</Table>
  </>);
}
