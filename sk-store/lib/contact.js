// Store contact details shown by the support assistant. Values are edited in the owner settings page
// (System settings) and the admin Contact page, stored in the settings table, and rendered here.
const digits = (v) => String(v || '').replace(/[^0-9]/g, '');
export const CONTACT_KEYS = ['contact_whatsapp', 'contact_phone', 'contact_email', 'contact_instagram', 'contact_facebook'];
export const CONTACT_RULES = {
  contact_whatsapp: /^$|^\+?[0-9][0-9\s-]{6,18}$/,
  contact_phone: /^$|^\+?[0-9][0-9\s-]{6,18}$/,
  contact_email: /^$|^\S+@\S+\.\S+$/,
  contact_instagram: /^$|^@?[A-Za-z0-9._]{1,30}$|^https:\/\/(www\.)?instagram\.com\/\S+$/,
  contact_facebook: /^$|^@?[A-Za-z0-9.]{1,50}$|^https:\/\/(www\.)?facebook\.com\/\S+$/,
};
// Builds the link rows the assistant shows. Empty settings stay hidden.
export function contactLinks(s) {
  const links = [];
  // Local SA numbers (0...) are shown as entered; links use international format (27...).
  const intl = (d) => (d.startsWith('0') ? '27' + d.slice(1) : d);
  const waRaw = String(s.contact_whatsapp || '').trim(); const wa = digits(waRaw);
  if (wa) links.push({ label: 'WhatsApp', text: waRaw, href: 'https://wa.me/' + intl(wa) });
  const phRaw = String(s.contact_phone || '').trim(); const ph = digits(phRaw);
  if (ph) links.push({ label: 'Call', text: phRaw, href: 'tel:+' + intl(ph) });
  const em = String(s.contact_email || '').trim();
  if (em) links.push({ label: 'Email', text: em, href: 'mailto:' + em });
  const ig = String(s.contact_instagram || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '').replace(/^@/, '');
  if (ig) links.push({ label: 'Instagram', text: '@' + ig, href: 'https://instagram.com/' + ig });
  const fb = String(s.contact_facebook || '').trim();
  if (fb) {
    const href = /^https?:\/\//.test(fb) ? fb : 'https://www.facebook.com/' + fb.replace(/^@/, '');
    links.push({ label: 'Facebook', text: href.replace(/^https?:\/\/(www\.)?facebook\.com\//, '@').replace(/\/$/, ''), href });
  }
  return links;
}
