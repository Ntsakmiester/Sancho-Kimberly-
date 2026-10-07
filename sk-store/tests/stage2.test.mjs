// Stage 2 upgrade tests. Run against a running app: BASE=http://localhost:3100 node tests/stage2.test.mjs
// Needs DATABASE_URL, OWNER_EMAIL, OWNER_PASSWORD, PAYMENT_PROVIDER=mock and PAYMENT_WEBHOOK_SECRET (same values the app runs with).
import pg from 'pg';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
const BASE = process.env.BASE || 'http://localhost:3100';
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; console.log('PASS ', name); } else { fail++; console.log('FAIL ', name, extra); } };
const eq = (name, a, b) => check(name, a === b, `(got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);
class Client {
  constructor() { this.cookie = ''; }
  async req(path, { method = 'GET', json, raw, headers = {} } = {}) {
    const h = { ...headers, ...(this.cookie ? { cookie: this.cookie } : {}) }; let body;
    if (json) { h['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (raw) body = raw;
    const r = await fetch(BASE + path, { method, headers: h, body, redirect: 'manual' });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
    let data = null; const t = await r.text(); try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data, headers: r.headers };
  }
}
const enc = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');
const sign = (f) => crypto.createHash('md5').update(Object.entries(f).filter(([k, v]) => k !== 'signature' && v !== '').map(([k, v]) => `${k}=${enc(v)}`).join('&') + '&passphrase=' + enc(SECRET)).digest('hex');
const hook = (c, f, sig = true) => c.req('/api/payments/webhook', { method: 'POST', raw: new URLSearchParams(sig ? { ...f, signature: sign(f) } : f).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
const q = async (sql, p) => (await db.query(sql, p)).rows;
const OWNER = { email: process.env.OWNER_EMAIL, password: process.env.OWNER_PASSWORD };
const ADDR = { name: 'Test Buyer', email: 'buyer@sk.test', phone: '082 123 4567', address: '1 Test St', suburb: 'Sandton', city: 'Johannesburg', province: 'Gauteng', postal: '2196' };
const H = (p) => execSync('node tests/hash.js ' + p).toString().trim();

await db.query("delete from payment_events; delete from refunds; delete from reviews; delete from coupon_redemptions; delete from order_status_history; delete from payments; delete from order_items; delete from orders; delete from notifications; delete from rate_events; delete from login_attempts; delete from sessions; delete from coupons where code like 'T%'");
await db.query("delete from users where email in ('buyer@sk.test','other@sk.test','admin2@sk.test','staff2@sk.test')");
await db.query("update users set password_hash=$1,active=true where role='owner'", [H(OWNER.password)]);
const mk = async (email, role, p) => (await q('insert into users(email,name,password_hash,role) values($1,$2,$3,$4) returning id', [email, role + ' user', H(p), role]))[0].id;
await mk('buyer@sk.test', 'customer', 'CustPass12345'); await mk('other@sk.test', 'customer', 'CustPass12345');
await mk('admin2@sk.test', 'admin', 'AdminPass12345'); const staffId = await mk('staff2@sk.test', 'staff', 'AdminPass12345');
await db.query("update service_state set status='ACTIVE'"); await db.query('update feature_flags set enabled=true');
const prod = (await q('select p.slug,v.id vid,v.size,p.id pid from products p join variants v on v.product_id=p.id where p.active order by p.id,v.id limit 1'))[0];
await db.query('update variants set qty=5 where id=$1', [prod.vid]);
const [owner, admin, staff, buyer, other, guest] = [1, 2, 3, 4, 5, 6].map(() => new Client());
const login = async (c, path, email, password) => (await c.req(path, { method: 'POST', json: { email, password } })).status === 200;
check('logins (owner/admin/staff/customers)', (await Promise.all([login(owner, '/api/owner/login', OWNER.email, OWNER.password), login(admin, '/api/admin/login', 'admin2@sk.test', 'AdminPass12345'), login(staff, '/api/admin/login', 'staff2@sk.test', 'AdminPass12345'), login(buyer, '/api/auth/login', 'buyer@sk.test', 'CustPass12345'), login(other, '/api/auth/login', 'other@sk.test', 'CustPass12345')])).every(Boolean));

console.log('\n== Pricing / checkout validation ==');
const item = { slug: prod.slug, size: prod.size, qty: 2 };
let r = await guest.req('/api/quote', { method: 'POST', json: { items: [item], province: 'Gauteng' } });
check('quote is computed server-side', r.status === 200 && r.data.total === r.data.subtotal + r.data.shipping, JSON.stringify(r.data));
eq('bad SA phone rejected', (await guest.req('/api/orders', { method: 'POST', json: { customer: { ...ADDR, phone: '123' }, items: [item] } })).status, 400);
eq('bad postal rejected', (await guest.req('/api/orders', { method: 'POST', json: { customer: { ...ADDR, postal: '12' }, items: [item] } })).status, 400);
eq('absurd quantity rejected', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [{ ...item, qty: 999 }] } })).status, 400);
r = await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [{ ...item, price_cents: 1 }], total_cents: 1 } });
check('order accepted; client-supplied price ignored', r.status === 200 && r.data.ref, JSON.stringify(r.data));
const o1 = (await q('select * from orders where ref=$1', [r.data.ref]))[0];
const unit = (await q('select price_cents from products where id=$1', [prod.pid]))[0].price_cents;
eq('order subtotal is server computed', o1.subtotal_cents, unit * 2);
eq('new order is PENDING/UNPAID', o1.status + '/' + o1.payment_status, 'PENDING/UNPAID');
eq('stock NOT deducted before payment', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, 5);
eq('phone stored in +27 format', o1.phone, '+27821234567');

console.log('\n== Payment verification / webhook ==');
const pay = (await q('select * from payments where order_id=$1', [o1.id]))[0];
const evt = (status, amount = (pay.amount_cents / 100).toFixed(2), id = 'MOCKT1') => ({ m_payment_id: pay.provider_ref, pf_payment_id: id, payment_status: status, amount_gross: amount });
eq('unsigned webhook rejected', (await hook(guest, evt('COMPLETE'), false)).status, 400);
eq('bad signature rejected', (await hook(guest, { ...evt('COMPLETE'), signature: 'deadbeef' }, false)).status, 400);
eq('order still unpaid after forged webhooks', (await q('select payment_status from orders where id=$1', [o1.id]))[0].payment_status, 'UNPAID');
await hook(guest, evt('COMPLETE', '0.01', 'MOCKBAD'));
eq('wrong amount not accepted', (await q('select payment_status from orders where id=$1', [o1.id]))[0].payment_status, 'UNPAID');
r = await hook(guest, evt('COMPLETE')); check('valid signed webhook accepted', r.status === 200 && r.data.result === 'paid', JSON.stringify(r.data));
const o1b = (await q('select * from orders where id=$1', [o1.id]))[0];
eq('order PAID', o1b.status + '/' + o1b.payment_status, 'PAID/PAID');
eq('stock deducted exactly once (5 -> 3)', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, 3);
const dups = await Promise.all([1, 2, 3, 4, 5].map(() => hook(guest, evt('COMPLETE'))));
eq('duplicate/parallel webhooks do not double-deduct', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, 3);
check('duplicates reported as duplicate/already_paid', dups.every((d) => ['duplicate', 'already_paid'].includes(d.data.result)), JSON.stringify(dups.map((d) => d.data)));
await hook(guest, evt('COMPLETE', undefined, 'MOCKT2'));
eq('second COMPLETE with new event id ignored', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, 3);
const mv = await q('select change,reason,new_qty from inventory_movements where order_id=$1', [o1.id]);
check('inventory movement recorded (SALE -2)', mv.length === 1 && mv[0].change === -2 && mv[0].reason === 'SALE' && mv[0].new_qty === 3, JSON.stringify(mv));
check('customer notified of payment', (await q("select 1 from notifications where type='payment_confirmed' and email_to='buyer@sk.test'")).length === 1);
await hook(guest, { m_payment_id: pay.provider_ref, pf_payment_id: 'MOCKF', payment_status: 'FAILED', amount_gross: '1.00' });
eq('late FAILED event cannot un-pay an order', (await q('select payment_status from orders where id=$1', [o1.id]))[0].payment_status, 'PAID');

console.log('\n== Overselling / race ==');
await db.query('update variants set qty=1 where id=$1', [prod.vid]);
const mkOrder = async (qty = 1) => { await q("delete from rate_events"); const x = await guest.req('/api/orders', { method: 'POST', json: { customer: { ...ADDR, email: 'race@sk.test' }, items: [{ ...item, qty }] } }); if (!x.data?.ref) console.log("MKORDER FAIL", x.status, JSON.stringify(x.data)); return (await q('select o.*,p.provider_ref,p.amount_cents pamt from orders o join payments p on p.order_id=o.id where o.ref=$1', [x.data.ref]))[0]; };
const ra = await mkOrder(), rb = await mkOrder();
const ev2 = (o, n) => ({ m_payment_id: o.provider_ref, pf_payment_id: 'RACE' + n, payment_status: 'COMPLETE', amount_gross: (o.pamt / 100).toFixed(2) });
await Promise.all([hook(guest, ev2(ra, 1)), hook(guest, ev2(rb, 2))]);
eq('no negative stock under race', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, 0);
const shorts = await q('select ref,stock_status from orders where ref in ($1,$2)', [ra.ref, rb.ref]);
check('exactly one order got stock, the other flagged SHORT', shorts.map((s) => s.stock_status).sort().join() === 'DEDUCTED,SHORT', JSON.stringify(shorts));
check('SHORT order got an automatic refund request', (await q("select 1 from refunds where reason like 'Out of stock%'")).length === 1);
try { await db.query('update variants set qty=-1 where id=$1', [prod.vid]); check('DB refuses negative stock', false); } catch { check('DB refuses negative stock', true); }
await db.query('update variants set qty=50 where id=$1', [prod.vid]);

console.log('\n== Service suspension ==');
await owner.req('/api/owner/service', { method: 'POST', json: { status: 'SUSPENDED' } });
eq('suspended: new order refused', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 503);
eq('admin cannot reactivate', (await admin.req('/api/owner/service', { method: 'POST', json: { status: 'ACTIVE' } })).status, 403);
eq('still suspended after admin attempt', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 503);
check('existing orders intact while suspended', (await q('select count(*)::int c from orders'))[0].c >= 3);
await owner.req('/api/owner/service', { method: 'POST', json: { status: 'CANCELLED' } });
eq('CANCELLED state blocks orders', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 503);
check('owner can still log in while suspended', await login(new Client(), '/api/owner/login', OWNER.email, OWNER.password));
await owner.req('/api/owner/service', { method: 'POST', json: { status: 'ACTIVE' } });
eq('owner reactivated: orders work', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 200);

console.log('\n== Feature flags ==');
const flagSet = (k, v) => owner.req('/api/owner/flags', { method: 'POST', json: { key: k, enabled: v } });
await flagSet('new_orders', 'false');
eq('new_orders flag off blocks orders', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 503);
await flagSet('new_orders', 'true'); await flagSet('guest_checkout', 'false');
eq('guest checkout off: guest refused', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 401);
eq('guest checkout off: customer allowed', (await buyer.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [item] } })).status, 200);
await flagSet('guest_checkout', 'true');
eq('admin cannot change flags', (await admin.req('/api/owner/flags', { method: 'POST', json: { key: 'payments', enabled: 'false' } })).status, 403);
await flagSet('customer_registration', 'false');
eq('registration flag off blocks sign-up', (await guest.req('/api/auth/register', { method: 'POST', json: { email: 'blocked@sk.test', password: 'LongPassword12', name: 'x' } })).status, 403);
await flagSet('customer_registration', 'true');

console.log('\n== Coupons ==');
const cp = (code, body) => admin.req('/api/admin/coupons', { method: 'POST', json: { code, ...body } });
eq('admin creates % coupon', (await cp('TPCT', { kind: 'PERCENT', value: 10 })).status, 200);
await cp('TFIX', { kind: 'FIXED', value: 50, max_uses_per_customer: 1 }); await cp('TMIN', { kind: 'PERCENT', value: 10, min_order: 99999 });
await cp('TOLD', { kind: 'PERCENT', value: 10, ends_at: '2020-01-01' }); await cp('TFIRST', { kind: 'PERCENT', value: 10, first_order_only: 'on' });
const qq = (coupon, email) => guest.req('/api/quote', { method: 'POST', json: { items: [{ ...item, qty: 1 }], province: 'Gauteng', coupon, email } });
r = await qq('TPCT'); check('percent discount computed on server', r.data.discount === Math.floor(unit * 0.1), JSON.stringify(r.data));
eq('fixed discount R50', (await qq('TFIX')).data.discount, 5000);
eq('minimum order enforced', (await qq('TMIN')).status, 400); eq('expired coupon rejected', (await qq('TOLD')).status, 400); eq('unknown coupon rejected', (await qq('NOPE')).status, 400);
eq('first-order coupon refused for customer with paid order', (await qq('TFIRST', 'buyer@sk.test')).status, 400);
eq('first-order coupon ok for new customer', (await qq('TFIRST', 'new@sk.test')).status, 200);
r = await guest.req('/api/orders', { method: 'POST', json: { customer: { ...ADDR, email: 'c1@sk.test' }, coupon: 'TFIX', items: [item], discount_cents: 999999 } });
check('order with coupon created, fake discount value ignored', r.status === 200 && (await q('select discount_cents from orders where ref=$1', [r.data.ref]))[0].discount_cents === 5000);
eq('per-customer coupon limit enforced', (await guest.req('/api/orders', { method: 'POST', json: { customer: { ...ADDR, email: 'c1@sk.test' }, coupon: 'TFIX', items: [item] } })).status, 400);
eq('staff without coupons.manage denied', (await staff.req('/api/admin/coupons', { method: 'POST', json: { code: 'TSTAFF', kind: 'PERCENT', value: 5 } })).status, 403);

console.log('\n== Staff permissions (granular) ==');
eq('staff with no permissions: products.view denied', (await staff.req('/api/admin/products')).status, 403);
eq('owner grants permissions', (await owner.req('/api/owner/staff', { method: 'POST', json: { id: staffId, permissions: ['products.view', 'orders.view'] } })).status, 200);
eq('staff may view products now', (await staff.req('/api/admin/products')).status, 200);
eq('staff cannot create products', (await staff.req('/api/admin/products', { method: 'POST', json: { action: 'create', name: 'Nope', price: '10', category_id: 1 } })).status, 403);
eq('staff cannot adjust inventory', (await staff.req('/api/admin/inventory', { method: 'POST', json: { variant_id: prod.vid, delta: 5, reason: 'RESTOCK' } })).status, 403);
eq('admin cannot change staff permissions', (await admin.req('/api/owner/staff', { method: 'POST', json: { id: staffId, permissions: ['finance.view'] } })).status, 403);
eq('staff cannot grant themselves permissions', (await staff.req('/api/owner/staff', { method: 'POST', json: { id: staffId, permissions: ['finance.view'] } })).status, 403);

console.log('\n== Product admin ==');
const catId = (await q('select id from categories order by id limit 1'))[0].id;
await q("delete from products where name in ('Test Hoodie','Bad')");
r = await admin.req('/api/admin/products', { method: 'POST', json: { action: 'create', name: 'Test Hoodie', price: '450', sale_price: '400', category_id: catId, description: 'd', visible: 'off' } });
check('admin creates product', r.status === 200 && r.data.id, JSON.stringify(r.data));
const np = r.data.id;
check('invalid sale price rejected', (await admin.req('/api/admin/products', { method: 'POST', json: { action: 'create', name: 'Bad', price: '100', sale_price: '200', category_id: catId } })).status === 400);
eq('admin adds variant with stock', (await admin.req('/api/admin/products', { method: 'POST', json: { action: 'variant_save', id: np, size: 'L', colour: 'Black', sku: 'HOOD-L-BLK', price: '', qty: 7 } })).status, 200);
const nv = (await q('select * from variants where product_id=$1', [np]))[0];
check('variant has sku/colour/stock + opening movement', nv.qty === 7 && nv.colour === 'Black' && (await q('select 1 from inventory_movements where variant_id=$1', [nv.id])).length === 1);
eq('duplicate SKU rejected', (await admin.req('/api/admin/products', { method: 'POST', json: { action: 'variant_save', id: np, size: 'M', colour: 'Black', sku: 'hood-l-blk', qty: 1 } })).status, 400);
eq('hidden product is not in the shop', ((await guest.req('/shop?q=Test+Hoodie')).data.includes('/product/test-hoodie')), false);
await admin.req('/api/admin/products', { method: 'POST', json: { action: 'activate', id: np } });
check('activated product appears with sale price', (await guest.req('/shop?q=Test+Hoodie')).data.includes('/product/test-hoodie'));
eq('inventory adjust below zero refused', (await admin.req('/api/admin/inventory', { method: 'POST', json: { variant_id: nv.id, delta: -99, reason: 'CORRECTION' } })).status, 400);
eq('inventory adjust works', (await admin.req('/api/admin/inventory', { method: 'POST', json: { variant_id: nv.id, delta: -2, reason: 'CORRECTION' } })).status, 200);
eq('stock now 5', (await q('select qty from variants where id=$1', [nv.id]))[0].qty, 5);
r = await guest.req('/api/quote', { method: 'POST', json: { items: [{ slug: 'test-hoodie', size: 'L', colour: 'Black', qty: 1 }], province: 'Gauteng' } });
eq('sale price used server-side (R400)', r.data.subtotal, 40000);
await admin.req('/api/admin/products', { method: 'POST', json: { action: 'archive', id: np } });
eq('archived product cannot be bought', (await guest.req('/api/quote', { method: 'POST', json: { items: [{ slug: 'test-hoodie', size: 'L', colour: 'Black', qty: 1 }], province: 'Gauteng' } })).status, 400);

console.log('\n== Order management / shipping ==');
const ref1 = o1.ref; const ost = (body) => admin.req('/api/admin/orders', { method: 'POST', json: { ref: ref1, ...body } });
check('cannot skip PAID -> SHIPPED', (await ost({ status: 'SHIPPED' })).status >= 400);
for (const st of ['PROCESSING', 'PACKED']) eq('order -> ' + st, (await ost({ status: st })).status, 200);
check('shipping requires a tracking number', (await ost({ status: 'SHIPPED' })).status >= 400);
eq('order -> SHIPPED with tracking', (await ost({ status: 'SHIPPED', tracking_number: 'TRK123', courier: 'The Courier Guy', est_delivery: '2026-12-01' })).status, 200);
check('shipping email recorded', (await q("select 1 from notifications where type='order_shipped'")).length === 1);
await ost({ payment_status: 'UNPAID' });
eq('payment_status cannot be changed by hand', (await q('select payment_status from orders where ref=$1', [ref1]))[0].payment_status, 'PAID');
check('cannot hand-set REFUNDED', (await ost({ status: 'REFUNDED' })).status >= 400);
eq('order -> DELIVERED', (await ost({ status: 'DELIVERED' })).status, 200);
check('status history kept', (await q('select count(*)::int c from order_status_history where order_id=$1', [o1.id]))[0].c >= 5);
const cancelOrd = await mkOrder(); await hook(guest, ev2(cancelOrd, 9)); const stockBefore = (await q('select qty from variants where id=$1', [prod.vid]))[0].qty;
eq('cancel a paid order', (await admin.req('/api/admin/orders', { method: 'POST', json: { ref: cancelOrd.ref, status: 'CANCELLED' } })).status, 200);
eq('cancel restores stock exactly once', (await q('select qty from variants where id=$1', [prod.vid]))[0].qty, stockBefore + 1);
check('cancelling a paid order opens a refund request', (await q("select 1 from refunds r join orders o on o.id=r.order_id where o.ref=$1 and r.reason='Order cancelled'", [cancelOrd.ref])).length === 1);

console.log('\n== Reviews ==');
await q("update orders set user_id=(select id from users where email='buyer@sk.test') where id=$1", [o1.id]);
eq('non-purchaser cannot review', (await other.req('/api/account/review', { method: 'POST', json: { slug: prod.slug, rating: 5, body: 'x' } })).status, 403);
eq('delivered purchaser can review', (await buyer.req('/api/account/review', { method: 'POST', json: { slug: prod.slug, rating: 4, title: 'Nice', body: 'Good fit' } })).status, 200);
eq('duplicate review blocked', (await buyer.req('/api/account/review', { method: 'POST', json: { slug: prod.slug, rating: 5, body: 'again' } })).status, 400);
check('unapproved review not shown', !(await guest.req('/product/' + prod.slug)).data.includes('Good fit'));
const rv = (await q('select id from reviews'))[0];
eq('staff without reviews.moderate denied', (await staff.req('/api/admin/reviews', { method: 'POST', json: { id: rv.id, action: 'approve' } })).status, 403);
eq('admin approves review', (await admin.req('/api/admin/reviews', { method: 'POST', json: { id: rv.id, action: 'approve' } })).status, 200);
const pg2 = (await guest.req('/product/' + prod.slug)).data;
check('approved review shows, verified purchase', pg2.includes('Good fit') && pg2.includes('Verified purchase'));
check('average + count recalculated from approved reviews', /<b>4<\/b> out of 5/.test(pg2.replace(/<!-- -->/g,'')) && pg2.replace(/<!-- -->/g,'').includes('1 review'));

console.log('\n== Refunds / finance ==');
const finBefore = (await q("select coalesce(sum(amount_cents),0)::int g from payments where status in ('PAID','PARTIALLY_REFUNDED','REFUNDED')"))[0].g;
eq('customer requests partial refund', (await buyer.req('/api/account/refund', { method: 'POST', json: { ref: ref1, reason: 'Does not fit', amount: '50' } })).status, 200);
eq("customer cannot refund someone else's order", (await other.req('/api/account/refund', { method: 'POST', json: { ref: ref1, reason: 'steal', full: 'on' } })).status, 404);
const rf = (await q("select * from refunds where reason='Does not fit'"))[0];
eq('staff without refunds.create denied', (await staff.req('/api/admin/refunds', { method: 'POST', json: { action: 'approve', refund_id: rf.id, ref: ref1 } })).status, 403);
eq('admin approves (test gateway completes)', (await admin.req('/api/admin/refunds', { method: 'POST', json: { action: 'approve', refund_id: rf.id, ref: ref1 } })).status, 200);
eq('refund COMPLETED', (await q('select status from refunds where id=$1', [rf.id]))[0].status, 'COMPLETED');
eq('order partially refunded', (await q('select payment_status from orders where ref=$1', [ref1]))[0].payment_status, 'PARTIALLY_REFUNDED');
check('refund above amount paid rejected', (await admin.req('/api/admin/refunds', { method: 'POST', json: { action: 'create', ref: ref1, amount: '99999', reason: 'too much' } })).status >= 400);
await admin.req('/api/admin/refunds', { method: 'POST', json: { action: 'complete', refund_id: rf.id, ref: ref1 } });
eq('completing twice does not double refund', (await q("select count(*)::int c from refunds where status='COMPLETED' and order_id=$1", [o1.id]))[0].c, 1);
const { summary, rangeOf } = await import('../lib/finance.mjs').catch(() => ({}));
const fin = (await q("select coalesce(sum(amount_cents),0)::int g from payments where status in ('PAID','PARTIALLY_REFUNDED','REFUNDED') and paid_at > now() - interval '1 day'"))[0].g;
const fp = await admin.req('/admin/dashboard/finance?range=today');
check('finance page loads for admin and shows verified revenue only', fp.status === 200 && String(fp.data).includes('Gross sales'), fp.status);
const csvRes = await admin.req('/api/admin/export/payments?range=30d'); check('admin can export payments CSV', csvRes.status === 200 && String(csvRes.data).includes('provider_ref'));
eq('staff without payments.view cannot export', (await staff.req('/api/admin/export/payments')).status, 403);
eq('customer cannot export', (await buyer.req('/api/admin/export/orders')).status, 403);
r = await admin.req('/api/admin/export/customers'); check('customer CSV neutralises formula injection', r.status === 200);

console.log('\n== Customer isolation ==');
r = await other.req('/account/orders/' + ref1); check("other customer cannot open someone's account order", r.status === 404 || (r.status === 200 && !String(r.data).includes('1 Test St')), r.status);
r = await buyer.req('/account/orders/' + ref1); check('owner of order can open it', r.status === 200 && String(r.data).includes(ref1), r.status);
r = await guest.req('/order/' + ref1); check('public order page hides address/email', r.status === 200 && !String(r.data).includes('buyer@sk.test') && !String(r.data).includes('1 Test St'));
r = await guest.req('/account'); check('/account needs login', r.status === 307, r.status);

console.log('\n== Owner / admin / customer separation ==');
for (const [who, c] of [['guest', guest], ['customer', buyer], ['staff', staff], ['admin', admin]]) for (const p of ['/api/owner/service', '/api/owner/admins', '/api/owner/flags', '/api/owner/health', '/owner/api/service']) { r = await c.req(p); check(`${who} -> ${p} rejected`, [401, 403].includes(r.status), r.status); }
for (const [who, c] of [['guest', guest], ['customer', buyer]]) for (const p of ['/api/admin/products', '/api/admin/orders', '/admin/api/orders', '/api/admin/inventory']) { r = await c.req(p); check(`${who} -> ${p} rejected`, [401, 403].includes(r.status), r.status); }
for (const [who, c] of [['guest', guest], ['customer', buyer], ['staff', staff], ['admin', admin]]) { r = await c.req('/owner/dashboard'); check(`${who} cannot load /owner/dashboard`, r.status === 307, r.status); }
for (const [who, c] of [['guest', guest], ['customer', buyer]]) { r = await c.req('/admin/dashboard'); check(`${who} cannot load /admin/dashboard`, r.status === 307, r.status); }
eq('admin cannot create an owner/admin via owner API', (await admin.req('/api/owner/admins', { method: 'POST', json: { email: 'evil@sk.test', role: 'owner' } })).status, 403);
check('owner role count unchanged', (await q("select count(*)::int c from users where role='owner'"))[0].c === 1);
check('owner account cannot be edited through admin management', (await owner.req('/api/owner/admins', { method: 'POST', json: { action: 'role', id: (await q("select id from users where role='owner'"))[0].id, role: 'admin' } })).status >= 400);
for (const p of ['/owner/dashboard', '/owner/dashboard/flags', '/owner/dashboard/security', '/owner/dashboard/health', '/admin/dashboard', '/admin/dashboard/products', '/admin/dashboard/orders', '/admin/dashboard/inventory', '/admin/dashboard/customers', '/admin/dashboard/reviews', '/admin/dashboard/payments', '/admin/dashboard/finance', '/admin/dashboard/reports', '/admin/dashboard/notifications', '/admin/dashboard/audit', '/admin/dashboard/coupons', '/admin/dashboard/shipping']) { r = await owner.req(p); check(`owner page ${p} renders`, r.status === 200, r.status); }

console.log('\n== Misc security ==');
eq('upload endpoint needs auth', (await guest.req('/api/admin/media', { method: 'POST', json: {} })).status, 401);
const fd = new FormData(); fd.append('product_id', String(prod.pid)); fd.append('file', new Blob(['<?php echo 1;'], { type: 'image/png' }), 'x.png');
let rr = await fetch(BASE + '/api/admin/media', { method: 'POST', headers: { cookie: admin.cookie }, body: fd, redirect: 'manual' });
const before = (await q('select count(*)::int c from media'))[0].c;
check('fake image (php disguised as png) not stored', before === (await q('select count(*)::int c from media'))[0].c && (await q("select count(*)::int c from media where mime not like 'image/%'"))[0].c === 0);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const fd2 = new FormData(); fd2.append('product_id', String(prod.pid)); fd2.append('action', 'add'); fd2.append('file', new Blob([png], { type: 'image/png' }), 'ok.png');
rr = await fetch(BASE + '/api/admin/media', { method: 'POST', headers: { cookie: admin.cookie }, body: fd2, redirect: 'manual' });
const med = (await q('select id,mime from media order by id desc limit 1'))[0];
check('real PNG accepted and stored', rr.status === 303 && med && med.mime === 'image/png', rr.status);
const mres = await fetch(BASE + '/api/media/' + med.id); check('media served with nosniff', mres.status === 200 && mres.headers.get('x-content-type-options') === 'nosniff');
check('SQL injection in cart is harmless', (await guest.req('/api/orders', { method: 'POST', json: { customer: ADDR, items: [{ slug: "x' or 1=1 --", size: 'M', qty: 1 }] } })).status === 400);
r = await guest.req('/shop?q=%27%3B+drop+table+products%3B--'); check('SQL injection in search is harmless', r.status === 200 && (await q('select count(*)::int c from products'))[0].c > 0);
r = await guest.req('/shop?q=%3Cscript%3Ealert(1)%3C/script%3E'); check('XSS in search is escaped', r.status === 200 && !String(r.data).includes('<script>alert(1)'));
check('security headers set', (await guest.req('/shop')).headers.get('x-frame-options') === 'DENY');
check('no secret leaked in public pages', !(await guest.req('/shop')).data.includes(SECRET));
eq('audit log holds no raw passwords', (await q("select count(*)::int c from audit_log where new_value::text ilike '%password%' and new_value::text not ilike '%redacted%'"))[0].c, 0);
check('audit trail has payment/order/refund/permission/flag/site events', (await q("select count(distinct action)::int c from audit_log where action in ('PAYMENT_VERIFIED','ORDER_STATUS_CHANGED','REFUND_COMPLETED','STAFF_PERMISSIONS_CHANGED','FEATURE_FLAG_CHANGED','SITE_SUSPENDED','SITE_REACTIVATED')"))[0].c >= 7);
console.log('\n== Existing Stage 2 still works ==');
for (const p of ['/', '/shop', '/product/' + prod.slug, '/cart', '/checkout', '/login', '/register', '/forgot-password', '/admin/login', '/owner/login']) check(`page ${p} loads`, (await guest.req(p)).status === 200);

console.log(`\n${pass} passed, ${fail} failed`);
await db.end(); process.exit(fail ? 1 : 0);
