# Footer, shop filters and customer messages - October 7, 2026

## Changed
- Footer: black with white text when the page body is white; white with black text when the body is black. Follows the visitor's light/dark setting, logo included.
- Shop filters: new Filters panel on /shop (price min/max in rand, size, colour, in stock only, on sale), working together with search, sort and category and kept across pages. Clear filters resets them. Before this, /shop only had search, sort and category buttons.
- Message customers: new "Message customers" tab in the Owner panel and in Store management (owner and administrators only, not staff). Send to all customers or one customer by email. Shows recent sends with recipient and opened counts. Each send is written to the audit log.
- Customer account: Messages & notifications now opens a separate inbox (All / Unread). Click a message to read it in full, like an email. Opening marks it read. Order updates appear in the same inbox. A small unread count shows by the account icon in the header.

## Notes
- Messages are in-app only. They are not emailed and are not phone push notifications. No new service, key, environment variable or database change is needed.
- Messages cannot be edited or recalled after sending.

## Tests
- Existing suite: 182 passed. tests/ui-inventory.test.mjs passed. New tests/messages-filter.test.mjs: 24 passed (run against a disposable test database only).
