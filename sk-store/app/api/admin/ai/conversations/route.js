import pool from '../../../../../lib/db';
import { adminPost } from '../../../../../lib/adminapi';
import { audit } from '../../../../../lib/auth';
export const dynamic = 'force-dynamic';
// Staff conversation actions: take over from the AI, or hand the conversation back to it.
export const POST = adminPost('ai.conversations', '/admin/dashboard/ai/conversations', async ({ g, b, ok, err }) => {
  const publicId = String(b.conversation_id || '').slice(0, 40);
  const conv = publicId ? (await pool.query('select * from ai_conversations where public_id=$1', [publicId])).rows[0] : null;
  if (!conv) return err('Conversation not found.', 404);
  const action = String(b.action || '');
  if (action === 'takeover') {
    await pool.query("update ai_conversations set status='HUMAN', assigned_staff_id=$2, updated_at=now() where id=$1", [conv.id, g.user.id]);
    await pool.query('insert into ai_messages(conversation_id,role,content) values($1,$2,$3)', [conv.id, 'system', 'A member of our support team has joined this chat.']);
    await audit('HUMAN_TAKEOVER', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: publicId, entity: 'ai_conversation', entityId: conv.id });
    return ok('You have taken over the conversation.');
  }
  if (action === 'return_to_ai') {
    await pool.query("update ai_conversations set status='OPEN', assigned_staff_id=null, updated_at=now() where id=$1", [conv.id]);
    await pool.query('insert into ai_messages(conversation_id,role,content) values($1,$2,$3)', [conv.id, 'system', 'You are chatting with the assistant again.']);
    await pool.query("update support_tickets set status='RESOLVED', updated_at=now() where conversation_id=$1 and status not in ('RESOLVED','CLOSED')", [conv.id]);
    await audit('AI_RETURNED_TO_AI', { accountId: g.user.id, role: g.user.role, ip: g.ip, record: publicId, entity: 'ai_conversation', entityId: conv.id });
    return ok('Conversation returned to the assistant.');
  }
  if (action === 'reply') {
    const body = String(b.body || '').trim().slice(0, 2000);
    if (!body) return err('Type a reply first.');
    await pool.query('insert into ai_messages(conversation_id,role,content) values($1,$2,$3)', [conv.id, 'staff', body]);
    await pool.query('update ai_conversations set updated_at=now(), message_count=message_count+1 where id=$1', [conv.id]);
    const ticket = (await pool.query('select id,ref,user_id,email,name from support_tickets where conversation_id=$1 order by id desc limit 1', [conv.id])).rows[0];
    if (ticket) await pool.query('insert into support_messages(ticket_id,author_id,author_role,body) values($1,$2,$3,$4)', [ticket.id, g.user.id, 'staff', body]);
    return ok('Reply sent.');
  }
  return err('Unknown action.');
});
