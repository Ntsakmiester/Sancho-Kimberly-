# Security maintenance verification

Built on sk-store-stage3-owner-ai-tools-overlap. Fixes were tested against an isolated local Postgres database with synthetic accounts, mock payments and fake/offline AI providers. No real deployment or customer account was changed.

- Next 15.5.27 + React 18.3.1 + PostCSS 8.5.29: production build passed. Awaited request APIs/route props; same-origin redirect handling updated for Next 15's bind-address behavior.
- Guest AI: server-generated 256-bit random token, only hash stored; conversation ownership uses a separate server key. Tampered/raw cookies cannot resume history. Deleting cookies cannot reset independent per-IP budgets or shared daily guest ceiling. Blocked calls create no conversation/token rows. Global and identity daily counters are atomic.
- CSRF: hostile, sibling, missing and null Origins rejected; same-origin browser forms work. Actual browser form on another localhost port returned 403 despite an owner session. Payment webhooks retain their signature-based exemption.
- AI overview: knowledge-only staff see no recent chat title section; adding ai.conversations restores it. Signed-in history isolation, staff/admin permissions and reply/handoff paths still pass.
- MFA: optional setup/QR/manual key, ten-minute setup expiry, code confirmation, encrypted seed, hashed ten single-use recovery codes, login challenge, code replay rejection, disable, and enrollment session revocation tested. RFC 6238 SHA1 vector tested. Desktop and mobile setup pages inspected; QR/key hidden in shared screenshots because they are enrollment secrets.
- Password maximum and atomic limiter tested: 20 concurrent quota claims with budget three admitted exactly three.

Remaining limits: IP address reliability depends on trusted reverse-proxy header handling. A distributed attacker can exhaust the shared guest ceiling and temporarily deny guest chat; it is a spending bound, not bot detection. Message budgets are not a currency cap; set provider-side spend limits too. Customer sign-ups remain without email verification, and existing email-enumeration behavior remains. CSP still allows inline scripts, and media validation is magic-byte/size checking rather than full decode. Those larger changes were outside this maintenance scope.

Deployment configuration still matters: set PAYMENT_WEBHOOK_SECRET, disable mock payment mode/test-payment flags, keep PayFast postback verification on, and use a real email provider rather than console. MFA recovery requires an authenticator, saved unused recovery code, or deliberate database-admin recovery. Losing both is not a password-reset bypass. Keep server encryption secrets backed up.

For local integration tests, browser-equivalent Origin headers are supplied explicitly. Tests reset synthetic fixtures and must never be run against a live store database.
