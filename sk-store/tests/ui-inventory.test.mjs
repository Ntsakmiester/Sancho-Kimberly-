import './local-origin.mjs';
// Run ONLY against an isolated test database/app: BASE=http://localhost:3100 DATABASE_URL=... OWNER_EMAIL=... OWNER_PASSWORD=... node tests/ui-inventory.test.mjs
// Creates disposable hidden products and stock movements. Never run against a live store.
import pg from 'pg';
const { Pool } = pg;
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.BASE || 'http://localhost:3100';
const prefix = 'ui-regression-' + Date.now();
let cookie;
const req = (path, init = {}) => fetch(base + path, { ...init, headers: { ...(init.headers || {}), cookie }, redirect: 'manual' });
const post = (path, data) => req(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
const q = async (sql, values) => (await db.query(sql, values)).rows;
try {
  const login = await fetch(base + '/api/owner/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({email:process.env.OWNER_EMAIL,password:process.env.OWNER_PASSWORD}) });
  assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0];
  const category = (await q('select id,name from categories order by id limit 1'))[0];
  const form = new FormData();for (const [k,v] of Object.entries({ action:'create',name:prefix,category_id:category.id,price:'100',visible:'off' })) form.set(k,String(v));
  form.append('images',new Blob([await readFile(new URL('../public/logo-mono.png',import.meta.url))],{type:'image/png'}),'photo.png');
  const created = await req('/api/admin/products',{method:'POST',body:form}); assert.equal(created.status,303);assert.ok(created.headers.get('location').startsWith('/admin/'));
  const p = (await q('select id,active from products where name=$1',[prefix]))[0];assert.ok(p);assert.equal(p.active,false);
  const image = (await q('select url,media_id from product_images where product_id=$1',[p.id]))[0];assert.ok(image.media_id);assert.equal((await req(image.url)).status,200);
  const v=(await q("insert into variants(product_id,size,colour,qty) values($1,'M','Black',10) returning id",[p.id]))[0];
  let r=await post('/api/admin/inventory',{variant_id:v.id,operation:'remove',quantity:3,reason:'CORRECTION'});assert.equal(r.status,200);
  assert.equal((await q('select qty from variants where id=$1',[v.id]))[0].qty,7);
  const m=(await q('select previous_qty,change,new_qty from inventory_movements where variant_id=$1 order by id desc limit 1',[v.id]))[0];assert.deepEqual(m,{previous_qty:10,change:-3,new_qty:7});
  r=await post('/api/admin/inventory',{variant_id:v.id,operation:'remove',quantity:99,reason:'CORRECTION'});assert.equal(r.status,400);assert.equal((await q('select qty from variants where id=$1',[v.id]))[0].qty,7);
  for(const quantity of ['1.2','-1','2junk','0']) assert.equal((await post('/api/admin/inventory',{variant_id:v.id,operation:'remove',quantity,reason:'CORRECTION'})).status,400);
  const bad=new FormData();for(const [k,v] of Object.entries({action:'create',name:prefix+'-bad',category_id:category.id,price:'100'}))bad.set(k,String(v));bad.append('images',new Blob(['not an image'],{type:'image/png'}),'fake.png');
  r=await req('/api/admin/products',{method:'POST',body:bad});assert.match(r.headers.get('location'),/error=/);assert.equal((await q('select count(*)::int n from products where name=$1',[prefix+'-bad']))[0].n,0);
  console.log('PASS create-time image storage/serving, invalid upload rollback, relative redirect, manual stock decrease, signed ledger, zero guard and strict whole-number validation');
} finally {
  const ps=await q('select id from products where name=$1 or name=$2',[prefix,prefix+'-bad']);
  for(const p of ps){const media=await q('select media_id from product_images where product_id=$1',[p.id]);await db.query('delete from inventory_movements where variant_id in (select id from variants where product_id=$1)',[p.id]);await db.query('delete from variants where product_id=$1',[p.id]);await db.query('delete from products where id=$1',[p.id]);for(const m of media)if(m.media_id)await db.query('delete from media where id=$1',[m.media_id]);}
  await db.end();
}
