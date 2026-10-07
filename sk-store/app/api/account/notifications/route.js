import pool from '../../../../lib/db';
import { customerPost } from '../../../../lib/accountapi';
export const dynamic = 'force-dynamic';
export const POST = customerPost('/account', async ({ u, ok }) => { await pool.query('update notifications set read_at=now() where user_id=$1 and read_at is null', [u.id]); return ok('Marked as read.'); });
