import pool from '../../../lib/db';
export const dynamic = 'force-dynamic';
// Lets the order page poll for the verified status. Returns status only - no personal data.
export async function GET(req) {
  const ref = new URL(req.url).searchParams.get('ref') || '';
  const o = (await pool.query('select status,payment_status from orders where ref=$1', [ref])).rows[0];
  return o ? Response.json(o) : Response.json({ error: 'Not found' }, { status: 404 });
}
