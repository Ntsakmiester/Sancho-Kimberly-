import Link from 'next/link';
import pool from '../../../lib/db';
import { requirePageRole } from '../../../lib/pageguard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Messages | Sancho Kimberly', robots: { index: false, follow: false } };
export default async function Inbox({ searchParams: sp }) {
  const u = await requirePageRole('customer', '/login');
  const only = sp?.show === 'unread';
  const rows = (await pool.query(`select id,type,subject,left(body,120) preview,created_at,read_at from notifications where user_id=$1 and audience='customer'${only ? ' and read_at is null' : ''} order by id desc limit 100`, [u.id])).rows;
  return (
    <section className="wrap shop">
      <Link className="back" href="/account">&larr; My account</Link>
      <h2>Messages &amp; notifications</h2>
      <div className="chips"><Link className={!only ? 'sel' : ''} href="/account/messages">All</Link><Link className={only ? 'sel' : ''} href="/account/messages?show=unread">Unread</Link></div>
      {rows.length ? <ul className="inbox">{rows.map((n) => (
        <li key={n.id} className={n.read_at ? 'read' : ''}><Link href={`/account/messages/${n.id}`}><span className="dot" aria-label={n.read_at ? 'Read' : 'Unread'} /><span className="subj">{n.subject}</span><span className="when">{new Date(n.created_at).toLocaleDateString('en-ZA')}</span><span className="prev">{n.preview}</span></Link></li>))}</ul>
        : <div className="empty"><b>{only ? 'No unread messages' : 'No messages yet'}</b>Messages from the store and order updates will show here.</div>}
    </section>
  );
}
