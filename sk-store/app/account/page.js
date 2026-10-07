import Link from 'next/link';
import pool from '../../lib/db';
import { requirePageRole } from '../../lib/pageguard';
import { money } from '../../lib/format';
import { PROVINCES } from '../../lib/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account | Sancho Kimberly', robots: { index: false, follow: false } };
export default async function Account({ searchParams: sp }) {
  const u = await requirePageRole('customer', '/login');
  const orders = (await pool.query('select ref,status,payment_status,total_cents,created_at from orders where user_id=$1 order by id desc limit 50', [u.id])).rows;
  const addrs = (await pool.query('select * from addresses where user_id=$1 order by id', [u.id])).rows;
  const notes = (await pool.query('select subject,body,created_at,read_at from notifications where user_id=$1 order by id desc limit 15', [u.id])).rows;
  const prof = (await pool.query('select name,phone from users where id=$1', [u.id])).rows[0] || {};
  return (
    <section className="wrap shop">
      <h2>My account</h2><p className="low">{u.email}</p>
      {sp?.saved && <p style={{ color: '#146c2e' }} role="status">{sp.saved === '1' ? 'Saved.' : sp.saved}</p>}{sp?.error && <p className="err" role="alert">{sp.error}</p>}
      <h3>Orders</h3>
      {orders.length ? orders.map((o) => <p key={o.ref}><Link href={`/account/orders/${o.ref}`}>{o.ref}</Link> &middot; {o.status} &middot; {money(o.total_cents)} &middot; {new Date(o.created_at).toLocaleDateString('en-ZA')}</p>) : <p className="low">No orders yet. <Link href="/shop">Start shopping</Link></p>}
      <h3 style={{ marginTop: 20 }}>Profile</h3>
      <form method="post" action="/api/account/profile" style={{ display: 'grid', gap: 8, maxWidth: 380 }}><input name="name" defaultValue={prof.name || ''} placeholder="Name" aria-label="Name" required /><input name="phone" defaultValue={prof.phone || ''} placeholder="Phone" aria-label="Phone" /><button className="btn">Save profile</button></form>
      <h3 style={{ marginTop: 20 }}>Change password</h3>
      <form method="post" action="/api/account/password" style={{ display: 'grid', gap: 8, maxWidth: 380 }}><input type="password" name="current" placeholder="Current password" autoComplete="current-password" required aria-label="Current password" /><input type="password" name="password" placeholder="New password (12+ characters)" autoComplete="new-password" required aria-label="New password" /><button className="btn">Change password</button></form>
      <h3 style={{ marginTop: 20 }}>Addresses</h3>
      {addrs.map((a) => <form key={a.id} method="post" action="/api/account/address" style={{ marginBottom: 6 }}>{a.address}, {a.suburb}, {a.city}, {a.province}, {a.postal} <input type="hidden" name="id" value={a.id} /><button className="btn" name="action" value="delete">Remove</button></form>)}
      <form method="post" action="/api/account/address" style={{ display: 'grid', gap: 8, maxWidth: 380 }}><input type="hidden" name="action" value="add" />
        <input name="address" placeholder="Street address" required aria-label="Street address" /><input name="suburb" placeholder="Suburb" aria-label="Suburb" /><input name="city" placeholder="City" required aria-label="City" />
        <select name="province" aria-label="Province" required>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select><input name="postal" placeholder="Postal code" inputMode="numeric" required aria-label="Postal code" /><input name="phone" placeholder="Phone" aria-label="Phone" /><button className="btn">Add address</button></form>
      <h3 style={{ marginTop: 20 }}>Notifications</h3>
      {notes.length ? notes.map((n, i) => <p key={i}>{n.read_at ? n.subject : <b>{n.subject}</b>} <span className="low">{new Date(n.created_at).toLocaleDateString('en-ZA')}</span></p>) : <p className="low">None.</p>}
      {notes.some((n) => !n.read_at) && <form method="post" action="/api/account/notifications"><button className="btn">Mark all read</button></form>}
      <form method="post" action="/api/auth/logout" style={{ marginTop: 20 }}><button className="btn">Log out</button></form>
    </section>
  );
}
