import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '../../../../lib/db';
import { requirePageRole } from '../../../../lib/pageguard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Message | Sancho Kimberly', robots: { index: false, follow: false } };
export default async function Message({ params: paramsPromise }) {
  const params = await paramsPromise;
  const u = await requirePageRole('customer', '/login');
  const id = /^\d{1,15}$/.test(params.id) ? params.id : null;
  if (!id) notFound();
  // Only the signed-in customer's own rows; opening marks it read.
  const r = await pool.query("update notifications set read_at=coalesce(read_at,now()) where id=$1 and user_id=$2 and audience='customer' returning subject,body,created_at,type", [id, u.id]);
  const n = r.rows[0];
  if (!n) notFound();
  return (
    <section className="wrap shop customer-inbox">
      <Link className="back" href="/account/messages">&larr; All messages</Link>
      <article className="msgview">
        <p className="eyebrow">{n.type === 'message' ? 'STORE MESSAGE' : 'ORDER UPDATE'}</p><h1 className="h2">{n.subject}</h1>
        <p className="low" style={{ margin: 0 }}>{n.type === 'message' ? 'From Sancho Kimberly' : 'Order update'} &middot; {new Date(n.created_at).toLocaleString('en-ZA')}</p>
        <div className="body">{n.body || 'No further details.'}</div>
      </article>
    </section>
  );
}
