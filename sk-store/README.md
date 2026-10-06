# Sancho Kimberly store (stage 1: shop + database)
Next.js + Postgres. Set DATABASE_URL, then `npm install && npm run dev` (run `npm run setup` once to create tables and load the starter catalogue).
On Railway: add a Postgres service, set DATABASE_URL on the web service to the Postgres connection reference, and deploy. `npm start` creates the tables and seeds products on first boot.
