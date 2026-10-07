import { verifyEvent, processEvent } from '../../../../lib/payments';
import pool from '../../../../lib/db';
export const dynamic = 'force-dynamic';
// Gateway notification (PayFast ITN format). The browser's return page is never trusted: only this verified, signed, server-to-server call marks an order paid.
export async function POST(req) {
  let fields;
  try { fields = Object.fromEntries(new URLSearchParams(await req.text())); } catch { return new Response('bad request', { status: 400 }); }
  const err = await verifyEvent(fields);
  if (err) {
    await pool.query("insert into system_events(kind,severity,message) values('webhook','warn',$1)", ['Rejected payment notification: ' + err]).catch(() => {});
    return new Response('rejected', { status: 400 });
  }
  try { const r = await processEvent(fields); return Response.json({ ok: true, result: r.result }); }
  catch (e) { console.error('webhook error', e.message); return new Response('error', { status: 500 }); }
}
