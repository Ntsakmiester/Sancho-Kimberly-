// Runs once after starter seeding. Preserves old products/order history and later stock edits.
const beanies = require('../data/beanies.json');
const migration = '003_named_beanies_v1';
async function applyBeanieCatalogue(pool) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query("select pg_advisory_xact_lock(hashtext('sk-named-beanies-v1'))");
    if ((await c.query('select 1 from schema_migrations where name=$1', [migration])).rowCount) { await c.query('commit'); return false; }
    await c.query("insert into categories(slug,name,position) values('beanies','Beanies',2) on conflict do nothing");
    const category = (await c.query("select id from categories where name='Beanies'")).rows[0];
    for (const p of beanies) {
      const inserted = await c.query('insert into products(slug,name,category,category_id,price_cents,description) values($1,$2,$3,$4,$5,$6) on conflict(slug) do nothing returning id', [p.slug,p.name,p.category,category.id,p.price_cents,p.description]);
      if (!inserted.rowCount) continue; // Never overwrite an existing product or its inventory.
      const id = inserted.rows[0].id;
      for (let j = 0; j < p.images.length; j++) { const im = p.images[j]; await c.query('insert into product_images(product_id,url,bg,alt,position) values($1,$2,$3,$4,$5)', [id,im.url,im.bg,im.alt,j]); }
      await c.query("insert into variants(product_id,size,qty) values($1,'One size',15)", [id]);
    }
    await c.query("update products set active=false,archived_at=coalesce(archived_at,now()) where slug='doodle-beanie'");
    await c.query('insert into schema_migrations(name) values($1)', [migration]);
    await c.query('commit');
    return true;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; }
  finally { c.release(); }
}
module.exports = { applyBeanieCatalogue };
