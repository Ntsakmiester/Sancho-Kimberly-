// Creates tables and loads the starter catalogue the first time it runs.
// Stage 2 additions: users/sessions/roles, owner service control, audit log,
// password-reset tokens and settings. Existing tables are never dropped or rebuilt.
const { Pool } = require('pg');
const crypto = require('node:crypto');
const seed = require('../data/seed.json');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
    create table if not exists products(
      id serial primary key, slug text unique not null, name text not null, category text not null,
      price_cents int not null, description text default '', active boolean default true, created_at timestamptz default now());
    create table if not exists product_images(
      id serial primary key, product_id int references products(id) on delete cascade, url text not null, bg text default '#f3f3f3', position int default 0);
    create table if not exists variants(
      id serial primary key, product_id int references products(id) on delete cascade, size text not null, qty int not null default 0, unique(product_id,size));
    create table if not exists orders(
      id serial primary key, ref text unique not null, status text not null default 'pending',
      name text, email text, phone text, address text, suburb text, city text, province text, postal text,
      subtotal_cents int, shipping_cents int, total_cents int, created_at timestamptz default now());
    create table if not exists order_items(
      id serial primary key, order_id int references orders(id) on delete cascade, product_id int references products(id),
      name text, size text, qty int, price_cents int);
    create table if not exists users(
      id serial primary key, email text unique not null, name text default '',
      password_hash text not null, role text not null check(role in ('owner','admin','staff','customer')),
      active boolean default true, totp_secret text, created_at timestamptz default now());
    create table if not exists sessions(
      id serial primary key, user_id int references users(id) on delete cascade,
      token_hash text unique not null, expires_at timestamptz not null,
      ip text, user_agent text, created_at timestamptz default now());
    create table if not exists password_reset_tokens(
      id serial primary key, user_id int references users(id) on delete cascade,
      token_hash text not null, expires_at timestamptz not null,
      used_at timestamptz, created_at timestamptz default now());
    create table if not exists login_attempts(
      id serial primary key, email text, ip text, success boolean default false, created_at timestamptz default now());
    create table if not exists service_state(
      id boolean primary key default true check(id),
      status text not null default 'ACTIVE' check(status in ('ACTIVE','PAYMENT_DUE','SUSPENDED','MAINTENANCE')),
      payment_status text not null default 'PAID',
      next_payment_date date, notes text default '',
      updated_by int, updated_at timestamptz default now());
    create table if not exists service_history(
      id serial primary key, status text not null, payment_status text, note text,
      changed_by int, created_at timestamptz default now());
    create table if not exists audit_log(
      id serial primary key, action text not null, account_id int, record text,
      ip text, result text default 'ok', created_at timestamptz default now());
    create table if not exists settings(key text primary key, value text);
    insert into service_state(id) values(true) on conflict do nothing;
    insert into settings(key,value) values('support_email','hello@sanchokimberly.co.za') on conflict do nothing;
  `);
  await pool.query('create table if not exists schema_migrations(name text primary key, applied_at timestamptz default now())');
  const first = !(await pool.query("select 1 from schema_migrations where name='002_foundation.sql'")).rowCount;
  const dir = require('node:path').join(__dirname, 'migrations');
  for (const f of require('node:fs').readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if ((await pool.query('select 1 from schema_migrations where name=$1', [f])).rowCount) continue;
    const c = await pool.connect();
    try { await c.query('begin'); await c.query(require('node:fs').readFileSync(require('node:path').join(dir, f), 'utf8')); await c.query('insert into schema_migrations(name) values($1)', [f]); await c.query('commit'); console.log('Applied migration', f); }
    catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  }
  const { rows } = await pool.query('select count(*)::int c from products');
  if (!rows[0].c) {
    for (const p of seed) {
      const r = await pool.query('insert into products(slug,name,category,price_cents,description) values($1,$2,$3,$4,$5) returning id', [p.slug, p.name, p.category, p.price_cents, p.description]);
      const id = r.rows[0].id;
      for (let i = 0; i < p.images.length; i++) await pool.query('insert into product_images(product_id,url,bg,position) values($1,$2,$3,$4)', [id, p.images[i].url, p.images[i].bg, i]);
      for (const s of p.sizes) await pool.query('insert into variants(product_id,size,qty) values($1,$2,$3)', [id, s, p.stock]);
    }
    console.log('Seeded', seed.length, 'products');
  }
  // Owner bootstrap: the owner account is created ONLY from environment variables,
  // once, when no owner exists. No credentials are ever hard-coded or committed.
  const owners = await pool.query("select count(*)::int c from users where role='owner'");
  if (!owners.rows[0].c && process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD && process.env.OWNER_PASSWORD.length < 10) {
    console.error('OWNER_PASSWORD must be at least 10 characters. Owner account NOT created.');
  } else if (!owners.rows[0].c && process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
    await pool.query('insert into users(email,name,password_hash,role) values($1,$2,$3,$4)',
      [process.env.OWNER_EMAIL.trim().toLowerCase(), process.env.OWNER_NAME || 'Store Owner', hashPassword(process.env.OWNER_PASSWORD), 'owner']);
    console.log('Owner account created for', process.env.OWNER_EMAIL.trim().toLowerCase(), '- now DELETE OWNER_PASSWORD from your environment settings; it is only needed once.');
  } else if (!owners.rows[0].c) {
    console.log('NOTE: no owner yet. Set OWNER_EMAIL and OWNER_PASSWORD and run `npm run setup` to create the owner account.');
  }
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
