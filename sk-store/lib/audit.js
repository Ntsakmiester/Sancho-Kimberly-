import pool from './db';
// Audit log. Secrets are scrubbed from any before/after values; never pass passwords, tokens, card data or payment secrets.
const SECRET = /pass|token|secret|card|cvv|cvc|signature|api_?key|hash/i;
const scrub = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(scrub);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) ? '[redacted]' : scrub(x)]));
  return v;
};
export async function audit(action, { accountId = null, record = null, ip = null, result = 'ok', role = null, entity = null, entityId = null, oldValue = null, newValue = null } = {}, client = pool) {
  try {
    await client.query('insert into audit_log(action,account_id,record,ip,result,role,entity,entity_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [action, accountId, record, ip, result, role, entity, entityId == null ? null : String(entityId),
        oldValue == null ? null : JSON.stringify(scrub(oldValue)), newValue == null ? null : JSON.stringify(scrub(newValue))]);
  } catch (e) { console.error('audit failed', action, e.message); }
}
