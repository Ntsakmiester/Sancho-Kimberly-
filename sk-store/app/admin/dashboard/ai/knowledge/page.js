import pool from '../../../../../lib/db';
import { aiPagePerm, AiTabs } from '../../../../../lib/aipage';
import { Flash } from '../../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Knowledge({ searchParams: sp }) {
  const { perms } = await aiPagePerm('ai.knowledge');
  const rows = (await pool.query('select k.*,u.email by_email from ai_knowledge k left join users u on u.id=k.updated_by order by k.position, k.id')).rows;
  const edit = sp.edit ? rows.find((r) => r.id === parseInt(sp.edit, 10)) : null;
  return (<>
    <Flash sp={sp} /><AiTabs perms={perms} active="/admin/dashboard/ai/knowledge" /><h3>Knowledge base</h3>
    <p className="low">Approved answers the assistant uses first. Keep them factual - the assistant repeats what is written here.</p>
    <form method="post" action="/api/admin/ai/knowledge" className="office-form" style={{ maxWidth: 620 }}>
      <input type="hidden" name="id" value={edit?.id || ''} />
      <label className="label">Title<input name="title" required maxLength="160" defaultValue={edit?.title || ''} /></label>
      <label className="label">Category<input name="category" required maxLength="60" defaultValue={edit?.category || 'General'} placeholder="Delivery, Returns, Payment, Sizing, Account..." /></label>
      <label className="label">Content<textarea name="content" rows="6" required maxLength="4000" defaultValue={edit?.content || ''} /></label>
      <button className="btn">{edit ? 'Save changes' : 'Add knowledge'}</button>
      {edit && <a className="btn" style={{ marginLeft: 8 }} href="/admin/dashboard/ai/knowledge">Cancel</a>}
    </form>
    <div className="office-table-scroll"><table>
      <thead><tr><th>Title</th><th>Category</th><th>Active</th><th>Updated</th><th></th></tr></thead>
      <tbody>{rows.map((k) => <tr key={k.id}>
        <td>{k.title}</td><td>{k.category}</td><td>{k.active ? 'Yes' : 'No'}</td>
        <td>{new Date(k.updated_at).toLocaleString('en-ZA')}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <a className="btn" href={`/admin/dashboard/ai/knowledge?edit=${k.id}`}>Edit</a>{' '}
          <form method="post" action="/api/admin/ai/knowledge" style={{ display: 'inline' }}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="action" value="toggle" /><button className="btn">{k.active ? 'Deactivate' : 'Activate'}</button></form>{' '}
          <form method="post" action="/api/admin/ai/knowledge" style={{ display: 'inline' }}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="action" value="delete" /><button className="btn">Delete</button></form>
        </td></tr>)}</tbody>
    </table></div>
  </>);
}
