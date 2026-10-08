// Next 15's internal Request URL may use the bind address. Redirects must use
// the visible Host, not 0.0.0.0, so browser forms stay on the same origin.
export function requestUrl(req) {
  const url = new URL(req.url);
  const host = req.headers.get('host');
  if (host && /^[a-zA-Z0-9.\-\[\]:]+$/.test(host)) url.host = host;
  if (process.env.NODE_ENV === 'production' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.protocol = 'https:';
  return url.toString();
}
