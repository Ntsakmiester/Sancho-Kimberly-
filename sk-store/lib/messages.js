import pool from './db';
import { audit } from './audit';
// Staff-to-customer in-app messages. Stored as ordinary notifications rows (type 'message'), so no schema change. Never emailed from here.
export const SUBJECT_MAX = 120, BODY_MAX = 5000;
export async function sendMessage({ to, email, subject, body, by, ip }) {
  subject = String(subject || '').trim(); body = String(body || '').trim();
  const fail = (m) => { const e = new Error(m); e.userFacing = true; throw e; };
  if (!subject) fail('Add a subject.'); if (subject.length > SUBJECT_MAX) fail(`Subject is too long (max ${SUBJECT_MAX}).`);
  if (!body) fail('Write the message.'); if (body.length > BODY_MAX) fail(`Message is too long (max ${BODY_MAX}).`);
  let r;
  if (to === 'one') {
    const em = String(email || '').trim().toLowerCase();
    if (!em) fail('Enter the customer email.');
    r = await pool.query("insert into notifications(user_id,audience,type,subject,body) select id,'customer','message',$1,$2 from users where role='customer' and active and lower(email)=$3", [subject, body, em]);
    if (!r.rowCount) fail('No active customer account with that email.');
  } else if (to === 'all') {
    r = await pool.query("insert into notifications(user_id,audience,type,subject,body) select id,'customer','message',$1,$2 from users where role='customer' and active", [subject, body]);
    if (!r.rowCount) fail('There are no customer accounts yet.');
  } else fail('Choose who to send to.');
  await audit('message.send', { accountId: by.id, role: by.role, ip, record: `${to === 'all' ? 'all customers' : 'one customer'} (${r.rowCount})`, entity: 'notifications', newValue: { subject, recipients: r.rowCount } });
  return r.rowCount;
}
export async function recentMessages(limit = 15) {
  return (await pool.query("select subject, left(body,140) preview, count(*)::int recipients, max(created_at) sent_at, count(read_at)::int reads from notifications where type='message' and audience='customer' group by subject, body, date_trunc('second',created_at) order by max(created_at) desc limit $1", [limit])).rows;
}
export async function unreadCount(userId) {
  return (await pool.query("select count(*)::int n from notifications where user_id=$1 and audience='customer' and read_at is null", [userId])).rows[0].n;
}
