import pool from '../../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../../lib/aipage';
import { Flash } from '../../../../../components/ui';
export const dynamic = 'force-dynamic';
const TOOLS = [['search_products', 'Product search'], ['product_details', 'Product details'], ['compare_products', 'Product comparison'], ['recommend_products', 'Recommendations'], ['check_availability', 'Availability checks'], ['own_orders', "Customer's own orders"], ['shipping_info', 'Shipping info'], ['knowledge_search', 'Knowledge base'], ['store_info', 'Store contact info'], ['create_ticket', 'Create support tickets']];
export default async function Bots({ searchParams: spPromise }) {
  const sp = await spPromise;
  const { perms } = await aiPagePerm('ai.bots');
  const rows = (await pool.query('select * from ai_bots order by position, id')).rows;
  const edit = sp.edit ? rows.find((r) => r.id === parseInt(sp.edit, 10)) : null;
  const editTools = edit ? (Array.isArray(edit.tools) ? edit.tools : []) : [];
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/bots" /><h3>AI bots</h3>
    <p className="low">Specialized assistants. The router picks one automatically from what the customer asks; inactive bots are never used.</p>
    <form method="post" action="/api/admin/ai/bots" className="office-form" style={{ maxWidth: 620 }}>
      <input type="hidden" name="id" value={edit?.id || ''} />
      <label className="label">Bot name<input name="name" required maxLength="80" defaultValue={edit?.name || ''} placeholder="e.g. Shopping Assistant" /></label>
      <label className="label">Description<input name="description" maxLength="300" defaultValue={edit?.description || ''} /></label>
      <label className="label">Personality<input name="personality" maxLength="300" defaultValue={edit?.personality || ''} placeholder="Warm, helpful, never pushy" /></label>
      <label className="label">Greeting<input name="greeting" maxLength="300" defaultValue={edit?.greeting || ''} /></label>
      <label className="label">System instructions<textarea name="system_instructions" rows="4" maxLength="2000" defaultValue={edit?.system_instructions || ''} placeholder="What this bot may do and how it should answer" /></label>
      <fieldset className="label" style={{ border: 'none', padding: 0 }}>Allowed tools<br />
        {TOOLS.map(([k, label]) => <label key={k} style={{ display: 'inline-block', marginRight: 12, fontWeight: 400 }}><input type="checkbox" name="tools" value={k} defaultChecked={edit ? editTools.includes(k) : ['search_products', 'knowledge_search', 'store_info'].includes(k)} /> {label}</label>)}
      </fieldset>
      <button className="btn">{edit ? 'Save bot' : 'Create bot'}</button>
      {edit && <a className="btn" style={{ marginLeft: 8 }} href="/admin/dashboard/ai/bots">Cancel</a>}
    </form>
    <div className="office-table-scroll"><table>
      <thead><tr><th>Bot</th><th>Status</th><th>Tools</th><th>Updated</th><th></th></tr></thead>
      <tbody>{rows.map((b) => <tr key={b.id}>
        <td><strong>{b.name}</strong>{b.built_in ? <span className="low"> (built-in)</span> : null}<br /><span className="low">{b.description}</span></td>
        <td><span className="status-pill">{b.status}</span></td>
        <td className="low">{(Array.isArray(b.tools) ? b.tools : []).join(', ') || 'none'}</td>
        <td>{new Date(b.updated_at).toLocaleString('en-ZA')}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <a className="btn" href={`/admin/dashboard/ai/bots?edit=${b.id}`}>Edit</a>{' '}
          {b.status !== 'ACTIVE' && <form method="post" action="/api/admin/ai/bots" style={{ display: 'inline' }}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="status" value="ACTIVE" /><button className="btn">Activate</button></form>}
          {b.status === 'ACTIVE' && <form method="post" action="/api/admin/ai/bots" style={{ display: 'inline' }}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="status" value="INACTIVE" /><button className="btn">Deactivate</button></form>}
        </td></tr>)}</tbody>
    </table></div>
  </>);
}
