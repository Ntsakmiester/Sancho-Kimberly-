import pool from './db';
import { provider } from './payments';
// Owner-only health report. Reports configured/not-configured, never secrets or hostnames.
export async function healthReport() {
  let db = 'down'; let ms = null;
  try { const t = Date.now(); await pool.query('select 1'); ms = Date.now() - t; db = 'ok'; } catch {}
  const q = async (sql) => { try { return (await pool.query(sql)).rows; } catch { return []; } };
  const prov = provider();
  const email = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const [wh] = await q("select count(*)::int c from system_events where kind='webhook' and created_at > now() - interval '7 days'");
  const [em] = await q("select count(*)::int c from notifications where email_status='FAILED' and created_at > now() - interval '7 days'");
  const [stuck] = await q("select count(*)::int c from orders where payment_status='UNPAID' and created_at < now() - interval '1 day' and status='PENDING'");
  const [short] = await q("select count(*)::int c from orders where stock_status='SHORT'");
  return {
    database: { status: db, latency_ms: ms }, api: { status: 'ok' },
    payments: { provider: prov || 'not configured', status: prov === 'payfast' ? 'configured' : prov === 'mock' ? 'test mode (not real money)' : 'NOT CONFIGURED - checkout is disabled' },
    email: { provider: email || (process.env.NODE_ENV === 'production' ? 'not configured' : 'console'), status: email === 'resend' ? 'configured' : 'NOT SENDING REAL EMAIL' },
    webhook_failures_7d: wh?.c ?? null, failed_emails_7d: em?.c ?? null, stale_unpaid_orders: stuck?.c ?? null, orders_needing_attention: short?.c ?? null,
    recent_events: await q('select kind,severity,message,created_at from system_events order by id desc limit 15'),
    recent_security: await q("select action,record,result,ip,created_at from audit_log where result<>'ok' or action like '%LOGIN%' order by id desc limit 15"),
    service: (await q('select status,payment_status from service_state'))[0] || null,
  };
}
