import { requestUrl } from '../../../../lib/request-url';
import pool from '../../../../lib/db';
import { requireRole, audit, ipOf } from '../../../../lib/auth';
import { getServiceState, SERVICE_STATES, PAYMENT_STATES } from '../../../../lib/service';
import { bodyOf } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
const deny = (s) => Response.json({ error: s === 401 ? 'Not authenticated.' : 'Forbidden.' }, { status: s });
export async function GET(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return deny(g.status);
  return Response.json({ state: await getServiceState() });
}
export async function POST(req) {
  const g = await requireRole(req, 'owner');
  if (!g.user) return deny(g.status);
  const b = await bodyOf(req);
  const cur = await getServiceState();
  const status = SERVICE_STATES.includes(b.status) ? b.status : cur.status;
  const payment = PAYMENT_STATES.includes(b.payment_status) ? b.payment_status : cur.payment_status;
  const next = /^\d{4}-\d{2}-\d{2}$/.test(String(b.next_payment_date || '')) ? b.next_payment_date : cur.next_payment_date;
  const note = String(b.note || '').slice(0, 500);
  await pool.query('update service_state set status=$1,payment_status=$2,next_payment_date=$3,notes=$4,updated_by=$5,updated_at=now() where id=true',
    [status, payment, next, note || cur.notes, g.user.id]);
  await pool.query('insert into service_history(status,payment_status,note,changed_by) values($1,$2,$3,$4)', [status, payment, note, g.user.id]);
  const ip = ipOf(req);
  if (status !== cur.status) await audit(status === 'SUSPENDED' ? 'SITE_SUSPENDED' : status === 'ACTIVE' ? 'SITE_REACTIVATED' : 'LICENCE_STATUS_CHANGED', { accountId: g.user.id, record: `${cur.status} -> ${status}`, ip });
  if (payment !== cur.payment_status) await audit('PAYMENT_STATUS_CHANGED', { accountId: g.user.id, record: `${cur.payment_status} -> ${payment}`, ip });
  const isForm = (req.headers.get('content-type') || '').includes('urlencoded');
  return isForm ? Response.redirect(new URL('/owner/dashboard/service?saved=1', requestUrl(req)), 303) : Response.json({ ok: true });
}
