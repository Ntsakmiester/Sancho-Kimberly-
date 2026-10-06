# Stage 2 rendered-screen QA

Checked on 6 October 2026 with a running Next.js app and an isolated local Postgres database containing test accounts only. No production account or service was changed.

## Screens checked
- Owner login, forgot password and reset password.
- Administrator and customer login, forgot password and reset password.
- Owner overview, admins/staff, inventory, service history, audit log, orders and customers.
- Suspended checkout notice and site banner.
- Desktop: 1440 x 1000; phone: 390 x 844; extra narrow-phone/dark-mode pass: 320 x 740.

## Visual fixes
- Service history and audit tables previously widened the whole phone page.
- Owner data tables now scroll inside their own container, with readable column spacing and a phone swipe hint. All columns and actions remain available.
- Narrow-phone wordmark/navigation spacing improved.
- No authentication, authorization, service-control or order logic changed.

## Results and limits
- Final automated layout checks: 51 screen/viewport combinations, no full-page horizontal overflow.
- Rendered screenshots inspected for the requested login/recovery screens, owner overview and populated tables, suspension notice, phone table scrolling and dark-mode narrow-phone header.
- tests/e2e.sh rerun after the final changes: 51 passed, 0 failed.
- npm run build succeeded; production-rendered service page also inspected.
- This is local Chrome rendering, not an exhaustive device/browser or security audit. Real email-provider delivery and production deployment were not tested.

## Security hardening pass (after review against the requirements spec)
- Staff accounts can now sign in to the admin area (still denied everything owner-only).
- No temporary passwords: admins/staff are invited by email and set their own password from a single-use link.
- Production fails closed if no email provider is configured (reset links are never written to logs).
- Reset emails limited per account and per IP; reset tokens are claimed atomically; disabled accounts cannot reset.
- Login lockout is per email+IP (a stranger cannot lock the owner out); minimum password length is 10.
- tests/e2e.sh is now re-runnable and covers the new checks: 62 passed, 0 failed (run twice).
