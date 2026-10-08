// Browser writes must come from this exact origin, never a sibling subdomain.
export function validOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const url = new URL(req.url);
    const host = req.headers.get('host') || url.host;
    const protocol = process.env.NODE_ENV === 'production' && !host.startsWith('localhost') && !host.startsWith('127.0.0.1') ? 'https:' : url.protocol;
    return new URL(origin).origin === protocol + '//' + host;
  } catch { return false; }
}
export const rejectOrigin = () => Response.json({ error: 'Invalid request origin. Refresh the page and try again.' }, { status: 403 });
