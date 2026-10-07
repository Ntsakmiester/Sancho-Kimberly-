// Run only on an isolated database after setup: DATABASE_URL=... node tests/beanie-catalogue.test.cjs
const { Pool } = require('pg');
const assert = require('node:assert/strict');
const { applyBeanieCatalogue } = require('../scripts/beanie-catalogue');
const beanies = require('../data/beanies.json');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const rows = (await pool.query("select p.slug,p.name,p.price_cents,p.active,v.size,v.qty,(select count(*)::int from product_images where product_id=p.id) images from products p join variants v on v.product_id=p.id where p.slug=any($1) order by p.slug", [beanies.map(p => p.slug)])).rows;
  assert.equal(rows.length,8);
  for (const p of rows) { assert.equal(p.price_cents,24000); assert.equal(p.size,'One size'); assert.equal(p.qty,15); assert.equal(p.active,true); assert.equal(p.images,2); assert.equal(p.name,beanies.find(b => b.slug===p.slug).name); }
  // Exercise upgrade from the previous catalogue, then rerun after an inventory edit.
  await pool.query('delete from schema_migrations where name=$1',['003_named_beanies_v1']);
  await pool.query("insert into products(slug,name,category,price_cents) values('doodle-beanie','Doodle Beanie','Beanies',28000) on conflict(slug) do update set active=true,archived_at=null returning id");
  await applyBeanieCatalogue(pool);
  const old = (await pool.query("select active,archived_at from products where slug='doodle-beanie'")).rows[0];
  assert.equal(old.active,false); assert.ok(old.archived_at);
  await pool.query("update variants set qty=14 where product_id=(select id from products where slug='beanie-black-stars')");
  await applyBeanieCatalogue(pool);
  assert.equal((await pool.query("select qty from variants where product_id=(select id from products where slug='beanie-black-stars')")).rows[0].qty,14);
  assert.equal((await pool.query("select count(*)::int n from products where slug=any($1)",[beanies.map(p => p.slug)])).rows[0].n,8);
  assert.equal((await pool.query("select active,price_cents from products where slug='block-logo-beanie'")).rows[0].price_cents,28000);
  await pool.query("update variants set qty=15 where product_id=(select id from products where slug='beanie-black-stars')");
  console.log('PASS eight products/names, R240, One size, 15 stock, two photos, archive old Doodle, preserve stock edits, no duplicates, leave Block Logo untouched');
})().finally(() => pool.end());
