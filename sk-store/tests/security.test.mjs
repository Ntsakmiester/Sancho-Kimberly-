// Security regressions: isolated local database/app only.
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
const base = process.env.BASE || 'http://localhost:3100';
if (new URL(base).hostname !== 'localhost') throw new Error('Local only');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const post = (path, body, cookie, origin = base) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) }, body: JSON.stringify(body), redirect: 'manual' });
const login = async (path, email, password, code) => post(path, { email, password, code });
const src = await fs.readFile(new URL('../lib/totp.js', import.meta.url), 'utf8');
const standalone = src.slice(src.indexOf('const alphabet'), src.indexOf('export const recoveryHash'));
const { totp } = await import('data:text/javascript;base64,' + Buffer.from("import crypto from 'node:crypto';\n" + standalone).toString('base64'));
// RFC 6238 SHA1 vector (8-digit 94287082, truncated to 6 digits).
assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1), '287082');
let owner;
try {
 await db.query("delete from rate_events; delete from login_attempts; update users set totp_enabled=false,totp_secret=null,totp_pending=null,totp_last_step=null,totp_recovery_hashes='[]' where role='owner'");
 let r = await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD); assert.equal(r.status, 200); owner = r.headers.get('set-cookie').split(';')[0];
 for (const origin of ['http://evil.invalid', 'http://localhost:3201', 'null', null]) assert.equal((await post('/api/owner/settings', { store_announcement: 'bad' }, owner, origin)).status, 403);
 assert.equal((await post('/api/owner/settings', {}, owner)).status, 200); console.log('PASS hostile, sibling, null and missing Origin rejected; same-origin works');
 r = await post('/api/ai/chat', { text: 'shipping' }, 'sk_ai=attacker-chosen'); assert.equal(r.status, 200); const guest = r.headers.get('set-cookie').split(';')[0]; const d = await r.json();
 assert.ok(guest !== 'sk_ai=attacker-chosen'); assert.equal((await db.query("select count(*)::int n from ai_conversations where guest_key='attacker-chosen'")).rows[0].n, 0);
 assert.equal((await fetch(base + '/api/ai/conversations/' + d.conversationId, { headers: { cookie: guest } })).status, 200);
 assert.equal((await fetch(base + '/api/ai/conversations/' + d.conversationId, { headers: { cookie: 'sk_ai=attacker-chosen' } })).status, 404);
 const ipKey = (await db.query("select key from rate_events where key like 'ai:guest-ip:%' limit 1")).rows[0].key;
 await db.query('insert into rate_events(key) select $1 from generate_series(1,100)', [ipKey]);
 const before = (await db.query('select count(*)::int n from ai_conversations')).rows[0].n;
 const tokensBefore = (await db.query('select count(*)::int n from ai_guest_sessions')).rows[0].n;
 r = await post('/api/ai/chat', { text: 'fresh cookie attempt' }); assert.equal(r.status, 429); assert.equal((await db.query('select count(*)::int n from ai_conversations')).rows[0].n, before);
  assert.equal((await db.query('select count(*)::int n from ai_guest_sessions')).rows[0].n, tokensBefore);
 console.log('PASS random server guest tokens, raw-cookie IDOR denied, deleting cookie cannot reset IP quota; blocked call adds no conversation');
 await db.query('delete from rate_events');
 // Parallel quota claims tested directly through a local import of the same module.
 const rateSrc = (await fs.readFile(new URL('../lib/rate.js', import.meta.url), 'utf8')).replace("import pool from './db';", "const pool = globalThis.__securityTestPool;"); globalThis.__securityTestPool = db;
 const { rateLimit } = await import('data:text/javascript;base64,' + Buffer.from(rateSrc).toString('base64'));
 const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit('security:atomic', 3, 60))); assert.equal(results.filter(Boolean).length, 3); console.log('PASS atomic counter: 20 concurrent attempts, exactly 3 admitted');
 assert.equal((await login('/api/auth/login', 'no@local.test', 'x'.repeat(201))).status, 400);
 assert.equal((await post('/api/auth/register', { email: 'max@local.test', password: 'x'.repeat(201) })).status, 400); console.log('PASS login/register maximum password length');
 r = await post('/api/owner/mfa', { action: 'begin', password: process.env.OWNER_PASSWORD }, owner); assert.equal(r.status, 200); const setup = await r.json(); assert.match(setup.qr, /^data:image\/png/);
 assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD)).status, 200); // pending does not enable
 assert.equal((await post('/api/owner/mfa', { action: 'enable', password: process.env.OWNER_PASSWORD, code: 'bad' }, owner)).status, 400);
 r = await post('/api/owner/mfa', { action: 'enable', password: process.env.OWNER_PASSWORD, code: totp(setup.secret) }, owner); assert.equal(r.status, 200); const codes = (await r.json()).recovery_codes; assert.equal(codes.length, 10);
 const row = (await db.query("select totp_secret,totp_recovery_hashes from users where role='owner'")).rows[0]; assert.ok(!row.totp_secret.includes(setup.secret)); assert.ok(!JSON.stringify(row.totp_recovery_hashes).includes(codes[0]));
 assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD)).status, 401);
 assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD, totp(setup.secret))).status, 401); // replay of setup code
 await db.query("update users set totp_last_step=totp_last_step-1 where role='owner'");
 r = await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD, totp(setup.secret)); assert.equal(r.status, 200); owner = r.headers.get('set-cookie').split(';')[0];
 assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD, codes[0])).status, 200);
 assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD, codes[0])).status, 401);
 await db.query("delete from rate_events where key like 'mfa:%'");
 assert.equal((await post('/api/owner/mfa', { action: 'disable', password: process.env.OWNER_PASSWORD, code: codes[1] }, owner)).status, 200);
 await db.query('delete from login_attempts'); assert.equal((await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD)).status, 200);
 console.log('PASS optional MFA pending/enable, encrypted seed, hashed recovery, login challenge, replay prevention, recovery single-use, safe disable');
} finally { await db.query("update users set totp_enabled=false,totp_secret=null,totp_pending=null,totp_last_step=null,totp_recovery_hashes='[]' where role='owner'; delete from rate_events; delete from login_attempts"); await db.end(); }
