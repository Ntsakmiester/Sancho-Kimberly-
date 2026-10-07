import pool from '../../../../lib/db';
import { adminPost } from '../../../../lib/adminapi';
export const dynamic = 'force-dynamic';
export const POST = adminPost('notifications.view', '/admin/dashboard/notifications', async ({ ok }) => {
  await pool.query("update notifications set read_at=now() where audience='admin' and read_at is null");
  return ok('All marked as read.');
});
