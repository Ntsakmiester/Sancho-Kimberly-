import { requestUrl } from '../../../../lib/request-url';
import { provider, pfSignature } from '../../../../lib/payments';
import pool from '../../../../lib/db';
import { baseUrl } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
// Test gateway used only when PAYMENT_PROVIDER=mock outside production. It sends a SIGNED notification to the real webhook, exactly like PayFast would.
export async function POST(req) {
  if (provider() !== 'mock') return new Response('Not found', { status: 404 });
  const form = await req.formData();
  const pid = parseInt(form.get('p'), 10); const outcome = String(form.get('outcome'));
  const pay = (await pool.query('select p.*,o.ref from payments p join orders o on o.id=p.order_id where p.id=$1', [pid])).rows[0];
  if (!pay) return new Response('Not found', { status: 404 });
  const fields = { m_payment_id: pay.provider_ref, pf_payment_id: 'MOCK' + pay.id + '-' + Date.now(), payment_status: outcome === 'success' ? 'COMPLETE' : outcome === 'cancel' ? 'CANCELLED' : 'FAILED', amount_gross: (pay.amount_cents / 100).toFixed(2) };
  fields.signature = pfSignature(fields, process.env.PAYMENT_WEBHOOK_SECRET || '');
  const base = baseUrl(req) || new URL(requestUrl(req)).origin;
  await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
  return Response.redirect(new URL(`/order/${pay.ref}?returned=1`, requestUrl(req)), 303);
}
