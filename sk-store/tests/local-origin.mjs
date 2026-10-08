// Node fetch has no browser Origin header. Give local test clients the same
// origin as browsers; hostile/missing Origin tests use raw fetch explicitly.
const raw = globalThis.fetch;
globalThis.fetch = (url, init = {}) => {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Tests are local-only.');
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase()) && !headers.has('origin')) headers.set('origin', target.origin);
  return raw(url, { ...init, headers });
};
