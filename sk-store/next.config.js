const csp = ["default-src 'self'", "img-src 'self' data: blob:", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "connect-src 'self'",
  "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za", "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"].join('; ');
module.exports = {
  eslint: { ignoreDuringBuilds: true }, poweredByHeader: false,
  // /owner/api/* and /admin/api/* are the documented API paths; they map onto the existing /api/owner/* and /api/admin/* handlers.
  async rewrites() { return [{ source: '/owner/api/:path*', destination: '/api/owner/:path*' }, { source: '/admin/api/:path*', destination: '/api/admin/:path*' }]; },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }, { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: csp }] : []),
    ] }];
  },
};
