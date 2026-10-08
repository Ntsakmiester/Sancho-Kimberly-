import pool from '../../../../../lib/db';
import { adminPost, int } from '../../../../../lib/adminapi';
import { audit } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
export const dynamic = 'force-dynamic';
const STATUSES = ['OPEN', 'AI_HANDLING', 'WAITING_FOR_CUSTOMER', 'ESCALATED', 'ASSIGNED', 'RESOLVED', 'CLOSED'];
export const POST = adminPost('ai.tickets', '/admin/dashboard/ai/tickets', async ({ g, b, ok, err }) => {
  const action = String(b.action || 'update');
  const ref = String(b.ref || '').slice(0, 20);
  const t = ref ? (await pool.query('select * from support_tickets where ref=$1', [ref])).rows[0] : null;
  if (!t) return err('Ticket not found.', 404);

  if (action === 'reply') {
    const body = String(b.body || '').trim().slice(0, 2000);
    if (!body) return err('Type a reply first.');
    await pool.query('insert into support_messages(ticket_id,author_id,author_role,body) values($1,$2,$3,$4)', [t.id, g.user.id, 'staff', body]);
    if (t.conversation_id) {
      await pool.query('insert into ai_messages(conversation_id,role,content) values($1,$2,$3)', [t.conversation_id, 'staff', body]);
      await pool.query('update ai_conversations set updated_at=now(), message_count=message_count+1 where id=$1', [t.conversation_id]);
    }
    if (t.user_id) await notify({ type: 'support_reply', userId: t.user_id, to: t.email, subject: `Support reply on ticket ${t.ref}`, body: `Hi${t.name ? ' ' + t.name.split(' ')[0] : ''},\nOur support team replied on ticket ${t.ref}:\n\n${body}` }).catch(() => {});
    await pool.query("update support_tickets set status=case when status in ('OPEN','ESCALATED','ASSIGNED') then 'WAITING_FOR_CUSTOMER' else status end, updated_at=now() where id=$1", [t.id]);
    await audit('TICKET_UPDATED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: ref, entity: 'support_ticket', entityId: t.id, newValue: { replied: true } });
    return ok('Reply sent.');
  }
  const sets = []; const args = [t.id]; const changes = {};
  if (b.status && STATUSES.includes(String(b.status))) { args.push(String(b.status)); sets.push('status=$' + args.length); changes.status = String(b.status); }
  if (b.priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(b.priority))) { args.push(String(b.priority)); sets.push('priority=$' + args.length); changes.priority = String(b.priority); }
  if (b.category) { args.push(String(b.category).slice(0, 40)); sets.push('category=$' + args.length); changes.category = String(b.category); }
  if (b.assign !== undefined) {
    const staffId = int(b.assign);
    if (staffId) {
      const s = (await pool.query("select id from users where id=$1 and role in ('owner','admin','staff') and active", [staffId])).rows[0];
      if (!s) return err('That staff member does not exist.');
      args.push(staffId); sets.push('assigned_staff_id=$' + args.length);
      if (t.status === 'OPEN' || t.status === 'ESCALATED') sets.push("status='ASSIGNED'");
      changes.assigned = staffId;
      if (t.conversation_id) await pool.query('update ai_conversations set assigned_staff_id=$2 where id=$1', [t.conversation_id, staffId]);
    } else { args.push(null); sets.push('assigned_staff_id=$' + args.length); changes.assigned = null; }
  }
  if (!sets.length) return err('Nothing to update.');
  await pool.query(`update support_tickets set ${sets.join(',')}, updated_at=now() where id=$1`, args);
  await audit('TICKET_UPDATED', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: ref, entity: 'support_ticket', entityId: t.id, oldValue: { status: t.status, priority: t.priority, category: t.category }, newValue: changes });
  return ok('Ticket updated.');
});
