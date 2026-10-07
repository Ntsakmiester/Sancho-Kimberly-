import pool from './db';
// Simple DB-backed limiter (works across serverless instances). Returns true if the action is allowed.
export async function rateLimit(key, max, windowSec) {
  const c = (await pool.query("select count(*)::int c from rate_events where key=$1 and created_at > now() - ($2||' seconds')::interval", [key, String(windowSec)])).rows[0].c;
  if (c >= max) return false;
  await pool.query('insert into rate_events(key) values($1)', [key]);
  if (Math.random() < 0.02) pool.query("delete from rate_events where created_at < now() - interval '1 day'").catch(() => {});
  return true;
}
