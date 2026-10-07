export default function robots() {
  const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/owner', '/api', '/account', '/cart', '/checkout', '/order', '/pay'] }], sitemap: base + '/sitemap.xml' };
}
