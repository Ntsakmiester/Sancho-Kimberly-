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
