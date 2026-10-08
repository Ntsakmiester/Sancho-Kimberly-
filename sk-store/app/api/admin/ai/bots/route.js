import pool from '../../../../../lib/db';
import { adminPost, int } from '../../../../../lib/adminapi';
import { audit } from '../../../../../lib/auth';
export const dynamic = 'force-dynamic';
const TOOL_CHOICES = ['search_products', 'product_details', 'compare_products', 'recommend_products', 'check_availability', 'own_orders', 'shipping_info', 'knowledge_search', 'store_info', 'create_ticket'];
export const POST = adminPost('ai.bots', '/admin/dashboard/ai/bots', async ({ g, b, ok, err }) => {
  const action = String(b.action || 'save');
  const id = int(b.id);
  if (action === 'status') {
    const status = String(b.status || '');
    if (!id || !['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(status)) return err('Missing bot or status.');
    await pool.query('update ai_bots set status=$2, updated_at=now(), updated_by=$3 where id=$1', [id, status, g.user.id]);
    await audit('AI_BOT_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_bot', entityId: id, newValue: { status } });
    return ok('Bot ' + status.toLowerCase() + '.');
  }
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) return err('A bot name is required.');
  const fields = {
    description: String(b.description || '').trim().slice(0, 300),
    personality: String(b.personality || '').trim().slice(0, 300),
    system_instructions: String(b.system_instructions || '').trim().slice(0, 2000),
    greeting: String(b.greeting || '').trim().slice(0, 300),
    tools: JSON.stringify([].concat(b.tools || []).filter((t) => TOOL_CHOICES.includes(t))),
    knowledge_categories: JSON.stringify([].concat(b.knowledge_categories || []).map((x) => String(x).slice(0, 60)).slice(0, 10)),
  };
  if (id) {
    const old = (await pool.query('select name,status from ai_bots where id=$1', [id])).rows[0];
    if (!old) return err('Bot not found.');
    await pool.query('update ai_bots set name=$2,description=$3,personality=$4,system_instructions=$5,greeting=$6,tools=$7,knowledge_categories=$8,updated_at=now(),updated_by=$9 where id=$1',
      [id, name, fields.description, fields.personality, fields.system_instructions, fields.greeting, fields.tools, fields.knowledge_categories, g.user.id]);
    await audit('AI_BOT_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_bot', entityId: id, oldValue: old, newValue: { name } });
    return ok('Bot updated.');
  }
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'bot';
  try {
    const r = await pool.query('insert into ai_bots(key,name,description,personality,system_instructions,greeting,tools,knowledge_categories,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) returning id',
      [key, name, fields.description, fields.personality, fields.system_instructions, fields.greeting, fields.tools, fields.knowledge_categories, g.user.id]);
    await audit('AI_BOT_CHANGED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'ai_bot', entityId: r.rows[0].id, newValue: { key, name } });
  } catch { return err('A bot with a similar name already exists.'); }
  return ok('Bot created.');
});
