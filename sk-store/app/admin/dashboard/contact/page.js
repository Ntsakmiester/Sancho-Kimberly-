import pool from '../../../../lib/db';
import { pagePerm } from '../../../../lib/adminpage';
import { getSettings } from '../../../../lib/service';
import { Flash } from '../../../../components/ui';
export const dynamic = 'force-dynamic';
export default async function Contact({ searchParams: sp }) {
  await pagePerm('contact.manage');
  const s = await getSettings();
  return (
    <>
      <Flash sp={sp} /><h3>Contact details</h3>
      <p className="low">Shown when a customer asks the support assistant for contact options. Leave a field blank to hide it.</p>
      <form method="post" action="/api/admin/contact" className="office-form" style={{ maxWidth: 620 }}>
        <label className="label">WhatsApp number<input name="contact_whatsapp" defaultValue={s.contact_whatsapp || ''} placeholder="e.g. 082 123 4567" inputMode="tel" /></label>
        <label className="label">Cellphone number<input name="contact_phone" defaultValue={s.contact_phone || ''} placeholder="e.g. 082 123 4567" inputMode="tel" /></label>
        <label className="label">Email address<input name="contact_email" type="email" defaultValue={s.contact_email || ''} placeholder="e.g. hello@sanchokimberly.co.za" /></label>
        <label className="label">Instagram<input name="contact_instagram" defaultValue={s.contact_instagram || ''} placeholder="Handle or link" /></label>
        <label className="label">Facebook<input name="contact_facebook" defaultValue={s.contact_facebook || ''} placeholder="Page link" /></label>
        <button className="btn">Save contact details</button>
      </form>
    </>
  );
}
