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

## October 8 update: customer account, black tee and swipe-only gallery

- Circular previous/next gallery buttons removed from the shared gallery; native touch/trackpad swiping, keyboard arrows/Home/End, thumbnails and photo counts remain. Regular back and pagination links are unchanged.
- Street Club Tee - Black: R450, Tees, S/M/L/XL, initial quantity 25 per size. Three supplied PNGs in front/back/combined order. Existing white tee stays unchanged. Setup adds the new product once to existing catalogues without overwriting later inventory edits.
- Customer account now uses grouped Orders/Profile/Addresses/Security panels, with Messages & notifications at the top. Inbox and message pages have clearer titles, read/unread state, previews, dates and spacing. Existing account APIs and ownership checks are unchanged.
- Visible form labels, keyboard focus, native disclosure controls, scoped mobile layout, dark mode and reduced-motion handling. Motion is limited to 150ms colour/border feedback; no entrance animation or animated form layout.
- Production build passed. 182 foundation tests, 24 messaging/filter checks, inventory/image checks, new and existing catalogue checks passed in isolated databases. Chromium desktop and 390px touch-emulated browser checks passed, including real touch event swipes, cart data, profile saving, address adding, read-on-open and unread filters. No production database writes.
- Inspected final desktop/phone profile, dark phone profile, inbox, message, full product page and shop screenshots. Fixed a phone inbox badge collision and scoped wordmark spacing on customer account pages. Not tested on physical phones and not deployed.
