// Reusable email service: customer, admin and owner password-reset / invitation email.
// Credentials come from environment variables only - never hard-code or commit them.
//   EMAIL_PROVIDER  'resend' (production) or 'console' (local testing only: prints links in the server log)
//   EMAIL_FROM      e.g. 'Sancho Kimberly <no-reply@yourdomain.co.za>' (a domain verified with the provider)
//   EMAIL_API_KEY   provider API key
//   APP_BASE_URL    public site URL used in links, e.g. https://shop.example.co.za
// In production with no provider configured, sending FAILS CLOSED (no link is logged or sent).
const ROLE_LABEL = { customer: 'customer', admin: 'administrator', owner: 'owner' };
export function resetEmailHtml({ name, role, url, minutes, invite = false }) {
  const who = ROLE_LABEL[role] || 'account';
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
  <h2 style="margin-bottom:4px">Sancho Kimberly</h2>
  <p>Hi${name ? ' ' + name : ''},</p>
  <p>${invite ? `An ${who} account has been created for you. Use the button below to set your password.` : `We received a request to reset the password for your ${who} account.`}</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">${invite ? 'Set your password' : 'Reset your password'}</a>
  </p>
  <p>This link expires in ${minutes} minutes and can only be used once.</p>
  <p>If you did not expect this email, you can ignore it - nothing will change. Never share this link with anyone.</p>
  <p style="color:#666;font-size:13px">Need help? Reply to this email and the Sancho Kimberly team will assist you.</p>
</div>`;
}
export async function sendPasswordResetEmail({ to, name, role, url, minutes = 30, invite = false }) {
  const subject = invite ? 'Your Sancho Kimberly account' : 'Reset your Sancho Kimberly password';
  const html = resetEmailHtml({ name, role, url, minutes, invite });
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const provider = explicit || (process.env.NODE_ENV === 'production' ? '' : 'console');
  if (provider === 'resend') {
    if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) throw new Error('EMAIL_API_KEY and EMAIL_FROM must be set for Resend');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
    });
    if (!res.ok) throw new Error('Email provider rejected the message: ' + res.status);
    return { provider };
  }
  if (provider === 'console') {
    console.log(`[email:console] to=${to} subject="${subject}" reset_url=${url}`);
    return { provider };
  }
  throw new Error('Email provider is not configured (set EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM)');
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// General transactional email (order, payment, shipping, refund, alerts). Throws on failure: callers (lib/notify.js) catch it so email can never break an order.
export async function sendEmail({ to, subject, text }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="margin-bottom:4px">Sancho Kimberly</h2>${String(text).split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const provider = explicit || (process.env.NODE_ENV === 'production' ? '' : 'console');
  if (provider === 'resend') {
    if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) throw new Error('EMAIL_API_KEY and EMAIL_FROM must be set for Resend');
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }) });
    if (!res.ok) throw new Error('Email provider rejected the message: ' + res.status);
    return { provider, status: 'SENT' };
  }
  if (provider === 'console') { console.log(`[email:console] to=${to} subject="${subject}"`); return { provider, status: 'LOGGED' }; }
  throw new Error('Email provider is not configured');
}
