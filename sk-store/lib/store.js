import pool from './db';
// Store name comes from Owner > Settings (settings.store_name), then STORE_NAME, never from code.
export async function storeName() {
  try {
    const r = await pool.query("select value from settings where key='store_name'");
    const v = (r.rows[0]?.value || '').trim();
    if (v) return v;
  } catch {}
  return process.env.STORE_NAME || 'Our store';
}
