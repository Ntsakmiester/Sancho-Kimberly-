# Sancho Kimberly store

Next.js + Postgres. Roles: owner, admin, staff, customer. See `.env.example` for settings.

## Deploying (Vercel + Neon)
1. Set DATABASE_URL, OWNER_EMAIL, OWNER_PASSWORD, APP_BASE_URL, EMAIL_PROVIDER=resend, EMAIL_API_KEY and EMAIL_FROM (a domain verified in Resend) in Vercel.
2. Deploy. The build creates the tables, loads the starter products and creates the owner account once.
3. Delete OWNER_PASSWORD from Vercel. Sign in at /owner/login.

## Owner service control
The owner can set the storefront to ACTIVE, PAYMENT_DUE, SUSPENDED or MAINTENANCE from /owner/dashboard/service. SUSPENDED and MAINTENANCE block new orders on the server; administrators cannot override it, and the owner can always sign in. This is a documented feature: put it in the service agreement with the store owner.

## Tests
`tests/e2e.sh` needs the app running on $BASE with EMAIL_PROVIDER=console and its log in /tmp/next.log, plus $PSQL, $OWNER_EMAIL and $OWNER_PASSWORD set. It resets its own test accounts, so it can be re-run.

## Stage 2 (commerce upgrade)
See `docs/OPERATIONS.md`, `.env.example` and `scripts/migrations/002_foundation.sql`. Admin dashboard: `/admin/dashboard`. Owner panel: `/owner/dashboard`. Customer account: `/account`.

### AI keys and diagnostics

Keep `AI_PROVIDER=nvidia` for NVIDIA primary with optional Gemini backup. Environment-only setup uses comma-separated NVIDIA keys in `AI_API_KEYS` and Google keys in `GEMINI_API_KEYS`.

Owner > AI assistant also supports adding/removing keys. Before saving dashboard keys, generate 32 random bytes as 64 hex characters and set `AI_KEY_ENCRYPTION_SECRET` on the server, then redeploy. Example generation: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep this secret stable and backed up. It is not an API key and never uses a `NEXT_PUBLIC_` prefix. Database keys use AES-256-GCM encryption; responses/pages show only last four characters. A database administrator with both database access and the server encryption secret can decrypt them. Changing/losing that secret makes stored keys unreadable; remove/re-add them after correcting configuration.

Dashboard NVIDIA keys replace the NVIDIA environment pool; dashboard Gemini keys replace the backup environment pool independently. If a dashboard pool is empty/unreadable, the environment pool remains the fallback. Removing the last dashboard key restores environment keys, not disables the provider. Environment keys cannot be removed in the dashboard. Save changes invalidate the current server's config cache; other instances refresh within 30 seconds. Only NVIDIA-primary and Gemini-backup dashboard pools are supported; alternative primary providers still use environment keys.

The owner-only Test AI button makes one short request with the first effective primary key, then one backup request only if the primary fails. It shows provider/model, HTTP status and the provider's error message with secret values redacted, or a timeout/network/configuration result. It tests connectivity, not every key in the pool. It bypasses customer cooldown state and is limited to two tests per minute. Tests consume provider quota and may incur charges under the connected project's pricing. No customer conversations are sent. Nothing runs until the owner clicks.

## Security maintenance (October 2026)

Next.js is pinned to 15.5.27, with React 18 retained and PostCSS 8.5.29 overridden for its security patches. VS Code works as before. Use Node 20.9+ (Node 22 LTS recommended), then `npm install`, `npm run dev` locally or `npm run build` for production. Update the lockfile with the project, not only package.json. No layout redesign.

The build applies `005_security.sql` automatically. Guest AI cookies are now random bearer tokens registered on the server; old unsigned guest cookies cannot access earlier anonymous chats. Signed-in customer chat history stays unchanged. Per-IP minute/day budgets and a shared rolling daily guest ceiling (`AI_GUEST_DAILY_MAX`, default 1000 messages) prevent deleting cookies from resetting the budget. Customers on the same shared network share the guest IP budget. Server rate checks are atomic. Only accepted chat calls create conversation/token rows. Rate limits count attempts admitted to processing, including provider failures, not just successful answers.

All state-changing API calls require the exact same Origin as the store. Browser forms/fetch send it automatically. External API test clients must explicitly send the store's `Origin` header. The signed payment webhook is exempt because the payment gateway is a server client; existing signature/postback checks still apply. Missing, null, hostile and sibling origins are rejected. Set `APP_BASE_URL` to the real HTTPS deployment URL.

Owner > Security now offers optional two-step login. It is off by default and does not enable until a six-digit authenticator code is confirmed. `AI_KEY_ENCRYPTION_SECRET` (the existing 64-hex server secret) must be configured first, and must stay stable. Scan the QR in your authenticator app or enter its manual setup key, confirm the code, then download/save all recovery codes privately. Each recovery code works once in place of an authenticator code. Codes are shown only at enrollment. Password resets do not bypass MFA. Disable requires your current password plus a fresh authenticator code or unused recovery code. Enabling revokes other owner sessions but preserves the current working session. Previously unused `totp_secret` values do not silently enable MFA.

Login, registration and reset passwords are capped at 200 characters. Staff need `ai.conversations` to see recent customer chat titles. No CSP inline-script change, payment provider configuration change, email provider change or deployment was made. See `docs/SECURITY-VERIFICATION.md` for verification and remaining limits.
