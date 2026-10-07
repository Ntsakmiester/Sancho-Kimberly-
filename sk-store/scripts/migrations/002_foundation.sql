-- Stage 2 production upgrade, migration 002. Additive only: no existing table is dropped or rebuilt, existing rows are kept.

-- service control: add CANCELLED
alter table service_state drop constraint if exists service_state_status_check;
alter table service_state add constraint service_state_status_check check(status in ('ACTIVE','PAYMENT_DUE','SUSPENDED','CANCELLED','MAINTENANCE'));

-- categories
create table if not exists categories(
  id serial primary key, slug text unique not null, name text unique not null, position int default 0, active boolean default true, created_at timestamptz default now());
insert into categories(slug,name,position)
  select lower(regexp_replace(category,'[^a-zA-Z0-9]+','-','g')), category, row_number() over (order by category) from (select distinct category from products) c
  on conflict do nothing;
alter table products add column if not exists category_id int references categories(id) on delete set null;
update products p set category_id=c.id from categories c where c.name=p.category and p.category_id is null;
alter table products add column if not exists sale_price_cents int check(sale_price_cents is null or sale_price_cents>=0);
alter table products add column if not exists featured boolean not null default false;
alter table products add column if not exists sku text;
alter table products add column if not exists low_stock_threshold int not null default 3 check(low_stock_threshold>=0);
alter table products add column if not exists meta_title text;
alter table products add column if not exists meta_description text;
alter table products add column if not exists archived_at timestamptz;
alter table products add column if not exists updated_at timestamptz default now();
create index if not exists products_category_idx on products(category_id);
create index if not exists products_active_idx on products(active) where archived_at is null;

-- media (images are stored in the database because Vercel's filesystem is read-only/ephemeral)
create table if not exists media(
  id serial primary key, mime text not null, bytes int not null, data bytea not null, created_by int references users(id) on delete set null, created_at timestamptz default now());
alter table product_images add column if not exists alt text default '';
alter table product_images add column if not exists media_id int references media(id) on delete set null;
alter table product_images add column if not exists variant_id int;

-- variants: sku, colour, own price, image, availability
alter table variants add column if not exists colour text not null default '';
alter table variants add column if not exists sku text;
alter table variants add column if not exists price_cents int check(price_cents is null or price_cents>=0);
alter table variants add column if not exists image_url text;
alter table variants add column if not exists active boolean not null default true;
alter table variants add column if not exists low_stock_threshold int check(low_stock_threshold is null or low_stock_threshold>=0);
alter table variants add column if not exists updated_at timestamptz default now();
alter table variants drop constraint if exists variants_qty_nonneg;
alter table variants add constraint variants_qty_nonneg check(qty>=0);
alter table variants drop constraint if exists variants_product_id_size_key;
create unique index if not exists variants_product_size_colour_uq on variants(product_id,size,colour);
create unique index if not exists variants_sku_uq on variants(lower(sku)) where sku is not null and sku<>'';
update variants v set sku=upper(substr(p.slug,1,12))||'-'||upper(regexp_replace(v.size,'[^a-zA-Z0-9]','','g'))||'-'||v.id from products p where p.id=v.product_id and v.sku is null;

-- inventory movements (immutable ledger)
create table if not exists inventory_movements(
  id bigserial primary key, variant_id int not null references variants(id) on delete cascade,
  previous_qty int not null, change int not null, new_qty int not null check(new_qty>=0),
  reason text not null check(reason in ('PURCHASE','MANUAL_ADJUSTMENT','SALE','CANCELLATION','REFUND','RETURN','RESTOCK','CORRECTION','INITIAL')),
  order_id int, user_id int references users(id) on delete set null, note text, created_at timestamptz default now());
create index if not exists inv_mov_variant_idx on inventory_movements(variant_id, created_at desc);
-- the same order can only deduct (or restore) a given variant once
create unique index if not exists inv_mov_order_once on inventory_movements(variant_id, order_id, reason) where order_id is not null and reason in ('SALE','CANCELLATION','REFUND','RETURN');
insert into inventory_movements(variant_id,previous_qty,change,new_qty,reason,note) select id,0,qty,qty,'INITIAL','Opening stock at upgrade' from variants
  where not exists (select 1 from inventory_movements m where m.variant_id=variants.id);

-- orders
alter table orders add column if not exists user_id int references users(id) on delete set null;
alter table orders add column if not exists payment_status text not null default 'UNPAID';
alter table orders add column if not exists discount_cents int not null default 0;
alter table orders add column if not exists vat_cents int not null default 0;
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists shipping_method text;
alter table orders add column if not exists courier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists est_delivery date;
alter table orders add column if not exists stock_status text not null default 'NONE' check(stock_status in ('NONE','DEDUCTED','RESTORED','SHORT'));
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists shipped_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists updated_at timestamptz default now();
-- orders placed before this upgrade already had stock deducted at order time
update orders set stock_status='DEDUCTED' where stock_status='NONE' and status in ('pending','PENDING') and created_at < now() and not exists (select 1 from schema_migrations where name='002_foundation.sql');
update orders set status=upper(status) where status<>upper(status);
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check(status in ('PENDING','PAID','PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED','REFUNDED'));
alter table orders alter column status set default 'PENDING';
create index if not exists orders_user_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status, created_at desc);
create index if not exists orders_email_idx on orders(lower(email));
alter table order_items add column if not exists variant_id int references variants(id) on delete set null;
alter table order_items add column if not exists colour text default '';
alter table order_items add column if not exists sku text;
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_items_product_idx on order_items(product_id);
create table if not exists order_status_history(
  id bigserial primary key, order_id int not null references orders(id) on delete cascade, status text not null, note text, user_id int references users(id) on delete set null, created_at timestamptz default now());
create index if not exists osh_order_idx on order_status_history(order_id);

-- payments
create table if not exists payments(
  id serial primary key, order_id int not null references orders(id) on delete restrict, provider text not null,
  provider_ref text, amount_cents int not null check(amount_cents>=0),
  status text not null default 'INITIATED' check(status in ('INITIATED','PAID','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED')),
  fee_cents int, paid_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists payments_order_idx on payments(order_id);
create index if not exists payments_status_idx on payments(status, created_at desc);
create unique index if not exists payments_provider_ref_uq on payments(provider, provider_ref) where provider_ref is not null;
create table if not exists payment_events(
  id bigserial primary key, provider text not null, event_id text not null, payment_id int references payments(id) on delete set null,
  outcome text not null, detail text, payload jsonb, created_at timestamptz default now(), unique(provider,event_id));
create index if not exists payment_events_created_idx on payment_events(created_at desc);

-- refunds
create table if not exists refunds(
  id serial primary key, order_id int not null references orders(id) on delete restrict, payment_id int references payments(id) on delete restrict,
  amount_cents int not null check(amount_cents>0), reason text not null default '',
  status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED','REJECTED','FAILED')),
  restock boolean not null default false, requested_by int references users(id) on delete set null, decided_by int references users(id) on delete set null,
  note text, created_at timestamptz default now(), updated_at timestamptz default now(), completed_at timestamptz);
create index if not exists refunds_order_idx on refunds(order_id);
create index if not exists refunds_status_idx on refunds(status);

-- reviews
create table if not exists reviews(
  id serial primary key, product_id int not null references products(id) on delete cascade, user_id int not null references users(id) on delete cascade,
  order_id int references orders(id) on delete set null, rating int not null check(rating between 1 and 5), title text default '', body text default '',
  verified boolean not null default false, status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
  moderated_by int references users(id) on delete set null, created_at timestamptz default now(), unique(product_id,user_id));
create index if not exists reviews_product_idx on reviews(product_id, status);

-- notifications
create table if not exists notifications(
  id bigserial primary key, user_id int references users(id) on delete cascade, audience text not null default 'customer' check(audience in ('customer','admin')),
  type text not null, subject text not null, body text default '', email_to text, email_status text not null default 'NONE' check(email_status in ('NONE','SENT','FAILED','LOGGED')),
  read_at timestamptz, created_at timestamptz default now());
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create index if not exists notifications_aud_idx on notifications(audience, created_at desc);

-- shipping
create table if not exists shipping_rates(
  id serial primary key, zone text not null, provinces text[] not null default '{}', method text not null default 'Standard delivery', courier text default '',
  fee_cents int not null check(fee_cents>=0), free_over_cents int check(free_over_cents is null or free_over_cents>=0), est_days_min int default 2, est_days_max int default 5,
  active boolean not null default true, created_at timestamptz default now());
insert into shipping_rates(zone,provinces,method,fee_cents,free_over_cents,est_days_min,est_days_max)
  select 'South Africa (all provinces)', array['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'],'Standard delivery',9900,100000,3,7
  where not exists (select 1 from shipping_rates);

-- coupons
create table if not exists coupons(
  id serial primary key, code text not null, kind text not null check(kind in ('PERCENT','FIXED')), value int not null check(value>0),
  product_ids int[], category_ids int[], min_order_cents int not null default 0, starts_at timestamptz, ends_at timestamptz,
  max_uses int, max_uses_per_customer int default 1, first_order_only boolean not null default false, active boolean not null default true, created_at timestamptz default now());
create unique index if not exists coupons_code_uq on coupons(upper(code));
create table if not exists coupon_redemptions(
  id serial primary key, coupon_id int not null references coupons(id) on delete cascade, order_id int not null references orders(id) on delete cascade, user_id int references users(id) on delete set null,
  email text, amount_cents int not null, created_at timestamptz default now(), unique(coupon_id,order_id));

-- customers
create table if not exists addresses(
  id serial primary key, user_id int not null references users(id) on delete cascade, label text default '', name text, phone text, address text not null, suburb text, city text, province text, postal text,
  is_default boolean not null default false, created_at timestamptz default now());
create index if not exists addresses_user_idx on addresses(user_id);
create table if not exists customer_notes(
  id serial primary key, user_id int not null references users(id) on delete cascade, note text not null, author_id int references users(id) on delete set null, created_at timestamptz default now());
alter table users add column if not exists phone text;
alter table users add column if not exists updated_at timestamptz default now();

-- permissions
create table if not exists permissions(key text primary key, description text not null);
create table if not exists user_permissions(
  user_id int not null references users(id) on delete cascade, permission text not null references permissions(key) on delete cascade, granted_by int references users(id) on delete set null, created_at timestamptz default now(),
  primary key(user_id, permission));
insert into permissions(key,description) values
 ('products.view','View products'),('products.create','Create products'),('products.edit','Edit products'),('products.delete','Archive/delete products'),
 ('inventory.view','View inventory'),('inventory.edit','Adjust stock'),('orders.view','View orders'),('orders.update','Update orders and shipping'),
 ('customers.view','View customers'),('reviews.view','View reviews'),('reviews.moderate','Moderate reviews'),
 ('payments.view','View payments'),('refunds.create','Request and process refunds'),('finance.view','View finance'),('reports.view','View reports and exports'),
 ('notifications.view','View notifications'),('coupons.manage','Manage coupons'),('shipping.manage','Manage shipping rates')
 on conflict do nothing;

-- feature flags + licence history already exists
create table if not exists feature_flags(key text primary key, enabled boolean not null, description text default '', updated_by int references users(id) on delete set null, updated_at timestamptz default now());
insert into feature_flags(key,enabled,description) values
 ('customer_registration',true,'Customers can create accounts'),('guest_checkout',true,'Checkout without an account'),('reviews',true,'Product reviews'),
 ('coupons',true,'Coupon codes at checkout'),('payments',true,'Start new payments'),('new_orders',true,'Accept new orders'),('notifications',true,'Send email notifications')
 on conflict do nothing;

-- audit log: richer columns, same table
alter table audit_log add column if not exists role text;
alter table audit_log add column if not exists entity text;
alter table audit_log add column if not exists entity_id text;
alter table audit_log add column if not exists old_value jsonb;
alter table audit_log add column if not exists new_value jsonb;
create index if not exists audit_created_idx on audit_log(created_at desc);
create index if not exists audit_action_idx on audit_log(action);

-- misc
create table if not exists rate_events(id bigserial primary key, key text not null, created_at timestamptz default now());
create index if not exists rate_events_key_idx on rate_events(key, created_at desc);
create table if not exists system_events(id bigserial primary key, kind text not null, severity text not null default 'info', message text not null, created_at timestamptz default now());
create index if not exists system_events_created_idx on system_events(created_at desc);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists login_attempts_created_idx on login_attempts(created_at desc);
insert into settings(key,value) values
 ('store_name','Sancho Kimberly'),('business_email','hello@sanchokimberly.co.za'),('business_phone',''),('business_address',''),('currency','ZAR'),
 ('vat_rate','15'),('vat_registered','false'),('prices_include_vat','true'),('order_prefix','SK'),('store_description','Streetwear from the kasi, delivered nationwide.'),
 ('social_tiktok','https://www.tiktok.com/@sancho.kimberlyco'),('gateway_fee_pct','2.9'),('gateway_fee_fixed_cents','100'),('vat_number','')
 on conflict do nothing;
