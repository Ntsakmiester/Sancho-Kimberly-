import pool from './db';
import { sendEmail } from './email';
import { flag } from './flags';
// In-app notification + best-effort email. NEVER throws: an email failure must not undo or block an order or payment.
export async function notify({ type, subject, body = '', userId = null, to = null, audience = 'customer' }, db = pool) {
  try {
    let status = 'NONE';
    let id;
    const ins = await db.query('insert into notifications(user_id,audience,type,subject,body,email_to) values($1,$2,$3,$4,$5,$6) returning id', [userId, audience, type, subject, body, to]);
    id = ins.rows[0].id;
    if (to && (await flag('notifications'))) {
      try { status = (await sendEmail({ to, subject, text: body })).status; }
      catch (e) { status = 'FAILED'; console.error('email failed:', type, e.message); await pool.query("insert into system_events(kind,severity,message) values('email','warn',$1)", [`Email failed (${type}): ${e.message}`]).catch(() => {}); }
      await db.query('update notifications set email_status=$1 where id=$2', [status, id]).catch(() => {});
    }
  } catch (e) { console.error('notify failed', type, e.message); }
}
export const notifyAdmins = (type, subject, body = '', db = pool) => notify({ type, subject, body, audience: 'admin' }, db);
