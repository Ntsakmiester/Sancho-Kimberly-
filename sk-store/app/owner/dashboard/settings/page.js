import { requirePageRole } from '../../../../lib/pageguard';
import { getSettings } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export default async function Settings({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  await requirePageRole('owner', '/owner/login');
  const s = await getSettings();
  return (<>
    <h3>System settings</h3>
    {searchParams.saved && <p style={{ color: '#146c2e' }}>Saved.</p>}
    <form method="post" action="/api/owner/settings" style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <label>Support email<input name="support_email" type="email" defaultValue={s.support_email || ''} /></label>
      <label>Store announcement<input name="store_announcement" defaultValue={s.store_announcement || ''} placeholder="Optional message shown to customers" /></label>
      <label>Store name<input name="store_name" type="text" defaultValue={s.store_name || ''} /></label>
      <label>Business email<input name="business_email" type="email" defaultValue={s.business_email || ''} /></label>
      <label>Business phone<input name="business_phone" type="text" defaultValue={s.business_phone || ''} /></label>
      <label>Business address<input name="business_address" type="text" defaultValue={s.business_address || ''} /></label>
      <label>VAT number<input name="vat_number" type="text" defaultValue={s.vat_number || ''} /></label>
      <label>VAT rate %<input name="vat_rate" type="text" defaultValue={s.vat_rate || ''} /></label>
      <label>VAT registered (true/false)<input name="vat_registered" type="text" defaultValue={s.vat_registered || ''} /></label>
      <label>Prices include VAT (true/false)<input name="prices_include_vat" type="text" defaultValue={s.prices_include_vat || ''} /></label>
      <label>Order prefix (letters/digits, max 6)<input name="order_prefix" type="text" defaultValue={s.order_prefix || ''} /></label>
      <label>Gateway fee % (estimate)<input name="gateway_fee_pct" type="text" defaultValue={s.gateway_fee_pct || ''} /></label>
      <label>Gateway fixed fee in cents (estimate)<input name="gateway_fee_fixed_cents" type="text" defaultValue={s.gateway_fee_fixed_cents || ''} /></label>
      <label>Instagram<input name="social_instagram" type="text" defaultValue={s.social_instagram || ''} /></label>
      <h4 style={{ margin: '18px 0 0' }}>Support assistant contact details</h4>
      <p style={{ margin: 0, color: '#6b6b6b', fontSize: '.9rem' }}>Shown when a customer asks the support assistant for contact options. Leave a field blank to hide it.</p>
      <label>WhatsApp number<input name="contact_whatsapp" type="text" defaultValue={s.contact_whatsapp || ''} placeholder="e.g. 082 123 4567" /></label>
      <label>Cellphone number<input name="contact_phone" type="text" defaultValue={s.contact_phone || ''} placeholder="e.g. 082 123 4567" /></label>
      <label>Contact email<input name="contact_email" type="email" defaultValue={s.contact_email || ''} placeholder="e.g. hello@sanchokimberly.co.za" /></label>
      <label>Instagram (assistant)<input name="contact_instagram" type="text" defaultValue={s.contact_instagram || ''} placeholder="Handle or link" /></label>
      <label>Facebook page<input name="contact_facebook" type="text" defaultValue={s.contact_facebook || ''} placeholder="Page link" /></label>
      <label>TikTok<input name="social_tiktok" type="text" defaultValue={s.social_tiktok || ''} /></label>
      <button className="btn">Save settings</button>
    </form>
  </>);
}
