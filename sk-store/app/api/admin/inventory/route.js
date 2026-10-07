import pool from '../../../../lib/db';
import { adminPost, int } from '../../../../lib/adminapi';
import { requirePerm, deny } from '../../../../lib/perms';
import { adjustVariant } from '../../../../lib/inventory';
import { audit } from '../../../../lib/audit';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const g = await requirePerm(req, 'inventory.view'); if (!g.user) return deny(g);
  const r = await pool.query('select v.id,p.name,v.size,v.colour,v.sku,v.qty from variants v join products p on p.id=v.product_id order by p.name,v.size limit 200');
  return Response.json({ variants: r.rows });
}
const REASONS = ['PURCHASE', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'CORRECTION', 'RETURN'];
export const POST = adminPost('inventory.edit', '/admin/dashboard/inventory', async ({ g, b, ok, err }) => {
  const vid = int(b.variant_id); const delta = int(b.delta); const reason = REASONS.includes(b.reason) ? b.reason : null;
  if (!vid || !delta) return err('Enter a stock change that is not zero.');
  if (!reason) return err('Choose a reason.');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = await adjustVariant(client, { variantId: vid, delta, reason, userId: g.user.id, note: String(b.note || '').slice(0, 200) || null });
    await client.query('commit');
    await audit('INVENTORY_ADJUSTED', { accountId: g.user.id, role: g.user.role, ip: g.ip, entity: 'variant', entityId: vid, oldValue: { qty: r.previous }, newValue: { qty: r.qty, reason } });
    return ok('Stock updated.');
  } catch (e) { await client.query('rollback').catch(() => {}); if (e.userFacing) return err(e.message === 'Not enough stock.' ? 'Stock cannot go below zero.' : e.message); throw e; } finally { client.release(); }
});
