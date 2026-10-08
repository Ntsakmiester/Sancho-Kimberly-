import Link from 'next/link';
import pool from '../../lib/db';
import { requirePageRole } from '../../lib/pageguard';
import { money } from '../../lib/format';
import { unreadCount } from '../../lib/messages';
import { PROVINCES } from '../../lib/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account | Sancho Kimberly', robots: { index: false, follow: false } };
export default async function Account({ searchParams: sp }) {
  const u = await requirePageRole('customer', '/login');
  const orders = (await pool.query('select ref,status,payment_status,total_cents,created_at from orders where user_id=$1 order by id desc limit 50', [u.id])).rows;
  const addrs = (await pool.query('select * from addresses where user_id=$1 order by id', [u.id])).rows;
  const unread = await unreadCount(u.id);
  const prof = (await pool.query('select name,phone from users where id=$1', [u.id])).rows[0] || {};
  return (
    <section className="wrap shop customer-account">
      <header className="account-heading"><div><p className="eyebrow">YOUR SPACE</p><h1 className="h2">My account</h1><p className="low account-email">{u.email}</p></div><form method="post" action="/api/auth/logout"><button className="account-secondary">Log out</button></form></header>
      {sp?.saved && <p className="account-feedback" role="status">{sp.saved === '1' ? 'Saved.' : sp.saved}</p>}{sp?.error && <p className="err account-feedback" role="alert">{sp.error}</p>}
      <Link href="/account/messages" className="account-message-link"><span className="account-message-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16v12H8l-4 3V5Z"/><path d="M8 9h8M8 13h5"/></svg></span><span className="account-message-copy"><strong>Messages &amp; notifications</strong><span>{unread > 0 ? `${unread} unread. Open your inbox.` : 'Store messages and order updates, all in one place.'}</span></span>{unread > 0 && <span className="account-unread" aria-label={`${unread} unread messages`}>{unread}</span>}<span className="account-open">Open inbox</span></Link>
      <div className="account-grid">
        <section className="account-panel account-orders"><div className="account-panel-heading"><h2>Orders</h2><span className="low">{orders.length ? `${orders.length} recent` : 'Your purchases'}</span></div>
          {orders.length ? <ul className="account-order-list">{orders.map((o) => <li key={o.ref}><Link href={`/account/orders/${o.ref}`}><span><strong>{o.ref}</strong><span className="low">{new Date(o.created_at).toLocaleDateString('en-ZA')}</span></span><span className="account-order-summary"><strong>{money(o.total_cents)}</strong><span className="account-status">{o.status.replaceAll('_', ' ')}</span></span></Link></li>)}</ul> : <div className="account-empty"><p>No orders yet.</p><Link className="ul" href="/shop">Start shopping</Link></div>}
        </section>
        <section className="account-panel"><div className="account-panel-heading"><h2>Profile</h2></div><p className="low">Keep your contact details up to date.</p>
          <form method="post" action="/api/account/profile" className="account-form"><label>Name<input name="name" defaultValue={prof.name || ''} autoComplete="name" required /></label><label>Phone<input name="phone" defaultValue={prof.phone || ''} type="tel" autoComplete="tel" /></label><button className="btn">Save profile</button></form>
        </section>
        <section className="account-panel"><div className="account-panel-heading"><h2>Addresses</h2><span className="low">{addrs.length} saved</span></div>
          {addrs.length ? <ul className="account-address-list">{addrs.map((a) => <li key={a.id}><div><strong>{a.address}</strong><p>{[a.suburb,a.city,a.province,a.postal].filter(Boolean).join(', ')}</p></div><form method="post" action="/api/account/address"><input type="hidden" name="id" value={a.id} /><button className="account-secondary" name="action" value="delete" aria-label={`Remove address ${a.address}`}>Remove</button></form></li>)}</ul> : <p className="low">No saved addresses yet.</p>}
          <details className="account-details"><summary>Add an address</summary><form method="post" action="/api/account/address" className="account-form"><input type="hidden" name="action" value="add" />
            <label>Street address<input name="address" autoComplete="street-address" required /></label><label>Suburb<input name="suburb" autoComplete="address-level3" required /></label><div className="account-field-row"><label>City<input name="city" autoComplete="address-level2" required /></label><label>Province<select name="province" autoComplete="address-level1" required>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label></div><label>Postal code<input name="postal" inputMode="numeric" autoComplete="postal-code" required /></label><label>Phone<input name="phone" type="tel" autoComplete="tel" /></label><button className="btn">Add address</button></form></details>
        </section>
        <section className="account-panel"><div className="account-panel-heading"><h2>Security</h2></div><p className="low">Keep your account protected.</p><details className="account-details"><summary>Change password</summary><form method="post" action="/api/account/password" className="account-form"><label>Current password<input type="password" name="current" autoComplete="current-password" required /></label><label>New password<input type="password" name="password" autoComplete="new-password" required minLength={12} aria-describedby="password-help" /></label><p id="password-help" className="low">Use at least 12 characters.</p><button className="btn">Change password</button></form></details></section>
      </div>
    </section>
  );
}
