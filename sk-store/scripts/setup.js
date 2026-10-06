// Creates tables and loads the starter catalogue the first time it runs.
const { Pool } = require('pg');
const seed = require('../data/seed.json');
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
      id serial primary key, product_id int references products(id) on delete cascade, size text not null, qty int not null default 0, unique(product_id,size));`);
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
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
