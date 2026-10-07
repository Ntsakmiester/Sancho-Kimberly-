# Beanie products and swipe galleries

This zip updates the previous UI update 2 code. It does not deploy the store.

- Eight products in Beanies: Black stars, Red crosses, Pink hearts, Blue flowers, Brown flames, White black lines, Grey arrows, Cream black flames.
- R240 each, One size, initial stock 15 each.
- Each gallery starts with its own edited product photo. The supplied labelled contact sheet is the second photo for comparison. Switching photos does not switch the purchased product.
- The previous Doodle Beanie is hidden and archived, not deleted, so old order history remains. Block Logo Beanie is unchanged.
- Swipe on touch screens, horizontal trackpad scroll, arrows, keyboard arrows/Home/End and full-page thumbnails. No dots or autoplay. Listing cards and full product pages use the same gallery. Tap a photo or name to open a product; swiping does not open it.
- Native scroll snapping follows the finger without an animation lock. Buttons use the existing short press-feedback curve. Keyboard and reduced-motion navigation are instant. Existing shop/header/footer/hero styles are preserved.

## Install

Replace the old project files with this project and redeploy as usual. `npm run build` runs the existing setup plus a one-time catalogue update. It works for both an empty database and an already-seeded store. It inserts missing named products and archives the old Doodle listing. Later builds do not reset stock, names, prices or images edited in management. No database or environment secrets are included.

Back up the database before deployment as usual. Once deployed, check Beanies in the shop and the new products in management. There is no need to manually recreate these products.

## Verified locally

Production Next build; 182 foundation regression checks; product-image upload and inventory regression checks; messaging/filter regression checks; catalogue insert/upgrade/idempotence tests; desktop arrows/keyboard/cart; mobile touch swipe, no accidental card navigation, reduced motion, no horizontal overflow or browser errors. Reviewed desktop and phone screenshots of the list, product photo and contact sheet.

The initial database stock is 15 per new product. Stock changes from future sales or management are preserved. Supplied photographs were small originals, so consistent layout does not add genuine image detail. Manual swipe feel was tested in Chromium touch emulation, not on a physical phone.
