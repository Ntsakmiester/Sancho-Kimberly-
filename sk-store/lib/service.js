import pool from './db';
export const SERVICE_STATES = ['ACTIVE', 'PAYMENT_DUE', 'SUSPENDED', 'MAINTENANCE'];
export const PAYMENT_STATES = ['PAID', 'PAYMENT_DUE', 'OVERDUE'];
export async function getServiceState() {
  const r = await pool.query('select * from service_state where id=true');
  return r.rows[0] || { status: 'ACTIVE', payment_status: 'PAID' };
}
export const storefrontBlocked = (s) => s.status === 'SUSPENDED' || s.status === 'MAINTENANCE';
export async function getSettings() {
  const r = await pool.query('select key,value from settings');
  return Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
}
