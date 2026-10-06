import pool from './db';
// Owner/admin/security audit log. Never log passwords or reset tokens.
export async function audit(action, { accountId = null, record = null, ip = null, result = 'ok' } = {}) {
  try {
    await pool.query('insert into audit_log(action,account_id,record,ip,result) values($1,$2,$3,$4,$5)',
      [action, accountId, record, ip, result]);
  } catch (e) { console.error('audit failed', action, e.message); }
}
