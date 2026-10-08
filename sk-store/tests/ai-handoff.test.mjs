import './local-origin.mjs';
// Isolated test database only. Run BASE=... with OWNER_EMAIL/PASSWORD, ADMIN=... and DATABASE_URL.
import pg from 'pg';import assert from 'node:assert/strict';
const base=process.env.BASE||'http://localhost:3100';const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
async function login(path,email,password){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function post(path,data,cookie){return fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});}
try{
 await db.query("delete from rate_events where key like 'ai:%'");
 const owner=await login('/api/owner/login',process.env.OWNER_EMAIL,process.env.OWNER_PASSWORD);const [email,password]=process.env.ADMIN.split(':');const admin=await login('/api/admin/login',email,password);
 const adminId=(await db.query('select id from users where email=$1',[email])).rows[0].id;
 const old=(await db.query('select permission from user_permissions where user_id=$1',[adminId])).rows.map(x=>x.permission);
 const perms=[...new Set([...old,'ai.conversations','ai.tickets'])];assert.equal((await post('/api/owner/staff',{id:adminId,permissions:perms},owner)).status,200);
 const r=await post('/api/ai/chat',{text:'Talk to a human'});const d=await r.json();assert.equal(d.handoff,true);const guest=r.headers.get('set-cookie').split(';')[0];
 for(const path of ['/admin/dashboard/ai/conversations/'+d.conversationId,'/admin/dashboard/ai/tickets/'+d.ticketRef]) assert.equal((await fetch(base+path,{headers:{cookie:admin}})).status,200);
 assert.equal((await post('/api/admin/ai/conversations',{conversation_id:d.conversationId,action:'reply',body:'Admin conversation reply'},admin)).status,200);
 const ticket=(await db.query('select * from support_tickets where ref=$1',[d.ticketRef])).rows[0];
 assert.ok((await db.query("select id from ai_messages where conversation_id=$1 and role='staff' and content=$2",[ticket.conversation_id,'Admin conversation reply'])).rowCount);
 assert.equal((await post('/api/admin/ai/tickets',{ref:d.ticketRef,action:'reply',body:'Admin ticket reply'},admin)).status,200);
 const read=await(await fetch(base+'/api/ai/conversations/'+d.conversationId,{headers:{cookie:guest}})).json();assert.ok(read.messages.some(m=>m.content==='Admin conversation reply'));assert.ok(read.messages.some(m=>m.content==='Admin ticket reply'));console.log('PASS admin profile both reply paths -> stored -> customer API');
 const form=await fetch(base+'/api/admin/ai/tickets',{method:'POST',headers:{cookie:admin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ref:d.ticketRef,status:'ASSIGNED',assign:String(adminId),priority:'MEDIUM',category:'GENERAL'}),redirect:'manual'});assert.equal(form.status,303);assert.ok(form.headers.get('location').includes('saved='));const updated=(await db.query('select status,assigned_staff_id from support_tickets where ref=$1',[d.ticketRef])).rows[0];assert.equal(updated.status,'ASSIGNED');assert.equal(updated.assigned_staff_id,adminId);console.log('PASS ticket form status+assignment saves without duplicate SQL column');
 await post('/api/owner/staff',{id:adminId,permissions:old},owner);
}finally{await db.end()}
