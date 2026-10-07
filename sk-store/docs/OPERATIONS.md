# Operations, backup and limitations

## Migrations
`npm run build` runs `scripts/setup.js`, which applies each file in `scripts/migrations/` once (tracked in `schema_migrations`). Migrations are additive. Take a Neon branch/backup before deploying a new migration.

## Backup and recovery
- Neon keeps point-in-time history (check your plan's window). Before risky changes create a Neon branch.
- Restore: create a branch at the earlier time, point `DATABASE_URL` at it, redeploy.
- Product images are stored in the database (`media` table), so a DB backup also covers images.
- Export CSVs (orders, customers, products, payments, finance) from the admin dashboard as an extra copy.
- Disaster recovery: redeploy the code to Vercel, set the env vars from `.env.example`, point `DATABASE_URL` at the restored database. The owner account is only created if none exists.

## Owner / licence control
The owner can set the store to ACTIVE, MAINTENANCE, SUSPENDED or CANCELLED and set a payment status. This closes the storefront to customers; admins cannot override it; the owner keeps access. Every change is recorded in service history and the audit log. Nothing is hidden: it is a visible control in the owner panel.

## Testing
`node tests/stage2.test.mjs` (needs a running server and a Postgres, `PAYMENT_PROVIDER=mock`, `ALLOW_TEST_PAYMENTS=yes_no_real_money`, `PAYMENT_WEBHOOK_SECRET`) and `tests/e2e.sh` (auth/reset regression).

## Known limits
See the report delivered with this build: PayFast untested against real PayFast; manual PayFast refunds; no image resizing; no PDF reports; no 2FA; no stock reservation at checkout; DB-based rate limiting.
