import pool from './db';
// Transaction-scoped advisory locks serialize each budget across serverless workers.
// All requested budgets are checked and consumed together, or none are consumed.
export async function rateLimits(budgets) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const key of [...new Set(budgets.map(b => b.key))].sort()) {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
    for (const { key, max, windowSec } of budgets) {
      const n = (await client.query("select count(*)::int c from rate_events where key=$1 and created_at > now() - ($2||' seconds')::interval", [key, String(windowSec)])).rows[0].c;
      if (n >= max) { await client.query('rollback'); return false; }
    }
    for (const key of new Set(budgets.map(b => b.key))) await client.query('insert into rate_events(key) values($1)', [key]);
    await client.query('commit');
    if (Math.random() < 0.02) pool.query("delete from rate_events where created_at < now() - interval '1 day'").catch(() => {});
    return true;
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; }
  finally { client.release(); }
}
export const rateLimit = (key, max, windowSec) => rateLimits([{ key, max, windowSec }]);
