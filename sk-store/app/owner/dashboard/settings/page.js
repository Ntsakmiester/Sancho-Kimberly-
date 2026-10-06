import { getSettings } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export default async function Settings({ searchParams }) {
  const s = await getSettings();
  return (<>
    <h3>System settings</h3>
    {searchParams.saved && <p style={{ color: '#146c2e' }}>Saved.</p>}
    <form method="post" action="/api/owner/settings" style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <label>Support email<input name="support_email" type="email" defaultValue={s.support_email || ''} /></label>
      <label>Store announcement<input name="store_announcement" defaultValue={s.store_announcement || ''} placeholder="Optional message shown to customers" /></label>
      <button className="btn">Save settings</button>
    </form>
  </>);
}
