import pool from './db';
export async function flag(key) {
  const r = await pool.query('select enabled from feature_flags where key=$1', [key]);
  return r.rows[0] ? r.rows[0].enabled : true;
}
export async function setting(key, def = '') {
  const r = await pool.query('select value from settings where key=$1', [key]);
  return r.rows[0] ? r.rows[0].value : def;
}
export async function allSettings() {
  const r = await pool.query('select key,value from settings');
  return Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
}
