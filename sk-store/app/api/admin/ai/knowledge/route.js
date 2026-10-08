import pool from '../../../../../lib/db';
import { adminPost, int } from '../../../../../lib/adminapi';
import { audit } from '../../../../../lib/auth';
export const dynamic = 'force-dynamic';
// Knowledge base CRUD. The assistant prioritizes these approved entries when answering.
export const POST = adminPost('ai.knowledge', '/admin/dashboard/ai/knowledge', async ({ g, b, form, ok, err }) => {
  const action = String(b.action || 'save');
  const id = int(b.id);
  if (action === 'delete') {
    if (!id) return err('Missing entry.');
    await pool.query('delete from ai_knowledge where id=$1', [id]);
    await audit('AI_KNOWLEDGE_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_knowledge', entityId: id, result: 'ok', newValue: { deleted: true } });
    return ok('Knowledge entry deleted.');
  }
  if (action === 'toggle') {
    if (!id) return err('Missing entry.');
    await pool.query('update ai_knowledge set active = not active, updated_at=now(), updated_by=$2 where id=$1', [id, g.user.id]);
    await audit('AI_KNOWLEDGE_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_knowledge', entityId: id });
    return ok('Saved.');
  }
  const title = String(b.title || '').trim().slice(0, 160);
  const category = String(b.category || 'General').trim().slice(0, 60);
  const content = String(b.content || '').trim().slice(0, 4000);
  if (!title || !content) return err('A title and content are required.');
  if (id) {
    const old = (await pool.query('select title,category,content,active from ai_knowledge where id=$1', [id])).rows[0];
    if (!old) return err('Entry not found.');
    await pool.query('update ai_knowledge set title=$2,category=$3,content=$4,updated_at=now(),updated_by=$5 where id=$1', [id, title, category, content, g.user.id]);
    await audit('AI_KNOWLEDGE_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_knowledge', entityId: id, oldValue: old, newValue: { title, category, content } });
    return ok('Knowledge entry updated.');
  }
  const r = await pool.query('insert into ai_knowledge(title,category,content,created_by,updated_by) values($1,$2,$3,$4,$4) returning id', [title, category, content, g.user.id]);
  await audit('AI_KNOWLEDGE_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_knowledge', entityId: r.rows[0].id, newValue: { title, category } });
  return ok('Knowledge entry added.');
});
