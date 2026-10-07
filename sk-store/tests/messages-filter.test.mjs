// Run ONLY against an isolated test app/database: BASE=http://localhost:3100 DATABASE_URL=... OWNER_EMAIL=... OWNER_PASSWORD=... ADMIN=admin@sk.test:AdminPass123 STAFF=staff@sk.test:StaffPass123 CUST=c1@sk.test:CustPass12345 CUST2=c2@sk.test:CustPass12345 node tests/messages-filter.test.mjs
// Sends test messages to the customers in that database. Never run against a live store.
import pg from 'pg'; import assert from 'node:assert/strict';
const base = process.env.BASE || 'http://localhost:3100';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let pass = 0; const ok = (n) => { pass++; console.log('PASS', n); };
async function login(path, email, password) { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); assert.equal(r.status, 200, path); return r.headers.get('set-cookie').split(';')[0]; }
const get = (p, c) => fetch(base + p, { headers: c ? { cookie: c } : {}, redirect: 'manual' });
const post = (c, data) => fetch(base + '/api/admin/messages', { method: 'POST', headers: { 'content-type': 'application/json', cookie: c }, body: JSON.stringify(data), redirect: 'manual' });
const [ae, ap] = process.env.ADMIN.split(':'), [se, sp] = process.env.STAFF.split(':'), [ce, cp] = process.env.CUST.split(':'), [c2e, c2p] = process.env.CUST2.split(':');
const owner = await login('/api/owner/login', process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
const admin = await login('/api/admin/login', ae, ap), staff = await login('/api/admin/login', se, sp);
const c1 = await login('/api/auth/login', ce, cp), c2 = await login('/api/auth/login', c2e, c2p);
const tag = 'T' + Date.now();
try {
  // shop filters
  const html = async (q) => (await (await get('/shop' + q)).text());
  const names = (h) => [...h.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  const all = names(await html('')).length; assert.ok(all >= 4);
  const sale = names(await html('?sale=1')); assert.equal(sale.length, 1); ok('on-sale filter');
  const cheap = names(await html('?max=1')); assert.equal(cheap.length, 0); ok('price max below all products shows none, no crash');
  assert.equal(names(await html('?min=100000&max=0')).length, all); ok('swapped min/max treated as a range');
  const stock = names(await html('?stock=1')); assert.ok(stock.length >= 1); ok('in-stock filter');
  assert.equal(names(await html('?size=%27%3B%20drop%20table%20users--')).length, all); ok('invalid size ignored safely');
  const sz = names(await html('?size=M')); assert.ok(sz.length <= all); ok('size filter');
  assert.ok((await db.query('select 1 from users')).rowCount > 0);
  const col = names(await html('?colour=Black')); assert.ok(col.length >= 1 && col.length <= all); ok('colour filter');
  // permissions
  assert.equal((await post(staff, { to: 'all', subject: 's', body: 'b' })).status, 403); ok('staff cannot send');
  assert.equal((await post('', { to: 'all', subject: 's', body: 'b' })).status, 401); ok('guest cannot send');
  assert.equal((await post(c1, { to: 'all', subject: 's', body: 'b' })).status, 403); ok('customer cannot send');
  assert.equal((await get('/admin/dashboard/messages', staff)).status, 307); ok('staff page redirected');
  assert.equal((await get('/owner/dashboard/messages', admin)).status, 307); ok('admin cannot open owner page');
  // validation
  for (const d of [{ to: 'all', subject: '', body: 'x' }, { to: 'all', subject: 'x', body: '' }, { to: 'one', email: 'nobody@x.test', subject: 'x', body: 'y' }, { to: 'nope', subject: 'x', body: 'y' }, { to: 'all', subject: 'x'.repeat(121), body: 'y' }]) assert.equal((await post(owner, d)).status, 400);
  ok('validation errors');
  // send one
  let r = await post(admin, { to: 'one', email: c2e.toUpperCase(), subject: tag + ' one', body: 'Line1\nLine2 <b>not html</b>' }); assert.equal(r.status, 200);
  assert.equal((await db.query("select count(*)::int n from notifications where subject=$1", [tag + ' one'])).rows[0].n, 1); ok('send to one customer by email (case-insensitive)');
  r = await post(owner, { to: 'all', subject: tag + ' all', body: 'Hello everyone' }); assert.equal(r.status, 200);
  const n = (await db.query("select count(*)::int n from notifications where subject=$1", [tag + ' all'])).rows[0].n;
  assert.equal(n, (await db.query("select count(*)::int n from users where role='customer' and active")).rows[0].n); ok('broadcast reaches every active customer only');
  assert.equal((await db.query("select count(*)::int n from notifications where subject=$1 and (audience<>'customer' or type<>'message' or email_to is not null)", [tag + ' all'])).rows[0].n, 0); ok('not emailed, customer audience');
  assert.ok((await db.query("select 1 from audit_log where action='message.send' limit 1")).rowCount); ok('audit entry');
  // customer views
  let h = await (await get('/account/messages', c1)).text(); assert.ok(h.includes(tag + ' all')); assert.ok(!h.includes(tag + ' one')); ok('customer inbox shows own messages only');
  assert.ok((await (await get('/account', c1)).text()).includes('unread')); ok('profile shows unread count and link');
  const id = (await db.query("select n.id from notifications n join users u on u.id=n.user_id where u.email=$1 and n.subject=$2", [ce, tag + ' all'])).rows[0].id;
  const other = (await db.query("select n.id from notifications n join users u on u.id=n.user_id where u.email=$1 and n.subject=$2", [c2e, tag + ' one'])).rows[0].id;
  assert.equal((await get('/account/messages/' + other, c1)).status, 404); ok("cannot open another customer's message");
  assert.equal((await get('/account/messages/abc', c1)).status, 404); ok('bad id 404');
  assert.equal((await get('/account/messages/' + id)).status, 307); ok('guest redirected');
  h = await (await get('/account/messages/' + id, c1)).text(); assert.ok(h.includes('Hello everyone'));
  assert.ok((await db.query('select read_at from notifications where id=$1', [id])).rows[0].read_at); ok('opening shows full message and marks read');
  h = await (await get('/account/messages/' + other, c2)).text(); assert.ok(h.includes('&lt;b&gt;not html&lt;/b&gt;')); ok('message body escaped (no HTML injection)');
  console.log(`\n${pass} passed, 0 failed`);
} finally {
  await db.query("delete from notifications where subject like $1", [tag + '%']); await db.end();
}
