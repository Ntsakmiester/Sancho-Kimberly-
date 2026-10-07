import pool from '../../../../lib/db';
export const dynamic = 'force-dynamic';
export async function GET(_req, { params }) {
  const id = parseInt(params.id, 10);
  const m = id ? (await pool.query('select mime,data from media where id=$1', [id])).rows[0] : null;
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(m.data, { headers: { 'Content-Type': m.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
