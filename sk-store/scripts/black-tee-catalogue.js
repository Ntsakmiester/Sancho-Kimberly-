// Add the black colourway once, on both new and existing stores. Preserve later edits.
const product = require('../data/black-tee.json');
const migration = '004_black_street_club_tee_v1';
async function applyBlackTeeCatalogue(pool) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query("select pg_advisory_xact_lock(hashtext('sk-black-street-club-tee-v1'))");
    if ((await c.query('select 1 from schema_migrations where name=$1', [migration])).rowCount) { await c.query('commit'); return false; }
    await c.query("insert into categories(slug,name,position) values('tees','Tees',1) on conflict do nothing");
    const category = (await c.query("select id from categories where name='Tees'")).rows[0];
    const p = product;
    const inserted = await c.query('insert into products(slug,name,category,category_id,price_cents,description) values($1,$2,$3,$4,$5,$6) on conflict(slug) do nothing returning id', [p.slug,p.name,p.category,category.id,p.price_cents,p.description]);
    if (inserted.rowCount) {
      const id = inserted.rows[0].id;
      for (let j = 0; j < p.images.length; j++) { const im = p.images[j]; await c.query('insert into product_images(product_id,url,bg,alt,position) values($1,$2,$3,$4,$5)', [id,im.url,im.bg,im.alt,j]); }
      for (const size of p.sizes) await c.query('insert into variants(product_id,size,qty) values($1,$2,$3)', [id,size,p.stock]);
    }
    await c.query('update products set category_id=$1 where slug=$2 and category_id is null', [category.id,p.slug]);
    await c.query('insert into schema_migrations(name) values($1)', [migration]);
    await c.query('commit');
    return true;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; }
  finally { c.release(); }
}
module.exports = { applyBlackTeeCatalogue };
