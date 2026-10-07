# Store UI update - October 7, 2026

Built from the newly supplied store archive. The homepage design, hero, typography, header, logo, product photos, and existing working store flows were kept.

## Changed
- Admin and owner dashboards: grouped navigation, current-page indicators, calmer stat cards, clearer service status, responsive forms and tables, and dark-mode-safe surfaces.
- Products: subtle once-only scroll reveals, separate colour and size choices, keyboard-accessible selection, sold-out choices disabled, colour retained in the cart, and optional variant-specific product image selection.
- Add a product: select up to eight images with previews, 2 MB each (PNG/JPEG/WebP/GIF). Images and the hidden new product are saved together; an invalid upload leaves no partial product.
- Inventory: explicit Add stock / Remove stock and positive whole-number units. Removal lowers stock, writes a signed movement record, and cannot go below zero. Existing signed-delta API support stays available.
- Management form redirects stay on the current origin, avoiding a production CSP/redirect problem.
- Motion is restrained: short opacity/transform transitions, no sliding dashboard tabs or moving numbers. Reduced-motion preferences remove product movement and press scaling.
- Owner revenue now counts verified payments rather than unpaid order totals. It is labelled gross revenue before fees/refunds; Finance still shows net figures.

## How to use
1. In Store management > Products, add the product and choose its image files. It remains hidden until activated.
2. Open Edit. Under Sizes, colours and stock, create each size/colour combination with its stock quantity. Choose a product image for a variant when colours need different pictures.
3. In Inventory, pick Add stock or Remove stock, enter the number of units, choose a reason, and Apply. On a phone, swipe the table sideways to reach these controls.
4. In Edit, use Show in shop once images and variants are ready. Owner > Products & inventory links to these management tools.

## Verification
- Optimized production build completed successfully.
- Existing integration suite: 182 passed, 0 failed.
- Added tests/ui-inventory.test.mjs passed against an isolated local database.
- Browser checks passed on the production build: manual 10-to-7 stock removal and ledger; below-zero rejection; strict whole-number validation; image preview/create/serving; invalid upload rollback; keyboard colour/size selection; colour in cart; variant image selection; scroll reveals; reduced motion; phone layouts without document overflow; no client exceptions.
- Inspected actual before/after desktop (1440px) and phone (390px) screenshots of the homepage, shop, product page, admin and owner dashboards, inventory, product creation and editing. Dark owner dashboard inspected. Homepage hero pixels unchanged; the only intentional homepage effect is product scroll reveal.
- Screenshots use local test accounts/data. They do not show your live sales or stock.

## Limits
This is a tested code handoff, not a live deployment or a claim that the store is production ready. Real payment-provider and email delivery flows, live Vercel/database environment, domain/email setup and actual shipping rates remain outside this update and unverified. Payment tests used only the mock gateway in an isolated environment. No test payment override, test database or credentials are included in the zip.

The supplied animate-expo guidance was applied as web design principles only; no React Native or Expo code/dependencies were added. Physical-device performance and gesture feel have not been tested; desktop Chrome and phone-sized browser emulation were used.

Replace the previous source with this version and deploy through your existing process. No new database migration or package dependency is required. Keep your own environment values. Never run the regression tests against a live database: they are designed for disposable test data.
