-- Stage 3 AI customer assistance, migration 003. Additive only: no existing table is dropped or rebuilt, existing rows are kept.

-- permissions (contact.manage is backfilled: it was granted before without a seed row)
insert into permissions(key,description) values
 ('contact.manage','Manage support contact details'),
 ('ai.view','View AI assistant overview'),
 ('ai.conversations','View AI conversations'),
 ('ai.tickets','Manage support tickets'),
 ('ai.knowledge','Manage AI knowledge base'),
 ('ai.bots','Manage AI bots'),
 ('ai.analytics','View AI analytics'),
 ('ai.settings','Manage AI settings')
 on conflict do nothing;

create table if not exists ai_bots(
  id serial primary key, key text unique not null, name text not null, description text default '',
  personality text default '', system_instructions text default '', greeting text default '',
  tools jsonb not null default '[]', knowledge_categories jsonb not null default '[]',
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','MAINTENANCE')),
  position int not null default 0, built_in boolean not null default false,
  created_by int references users(id) on delete set null, updated_by int references users(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table if not exists ai_conversations(
  id bigserial primary key, public_id text unique not null,
  user_id int references users(id) on delete cascade,
  guest_key text,
  title text not null default 'New conversation',
  status text not null default 'OPEN' check(status in ('OPEN','HUMAN','CLOSED')),
  bot_key text, language text not null default 'en',
  category text not null default 'GENERAL',
  priority text not null default 'LOW' check(priority in ('LOW','MEDIUM','HIGH','URGENT')),
  last_intent text, summary text,
  assigned_staff_id int references users(id) on delete set null,
  message_count int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists ai_conv_user_idx on ai_conversations(user_id, updated_at desc);
create index if not exists ai_conv_status_idx on ai_conversations(status, updated_at desc);

create table if not exists ai_messages(
  id bigserial primary key, conversation_id bigint not null references ai_conversations(id) on delete cascade,
  role text not null check(role in ('customer','assistant','staff','system')),
  content text not null, intent text, bot_key text,
  products jsonb, orders jsonb, links jsonb,
  feedback smallint check(feedback in (-1,1)), feedback_note text,
  tokens_in int, tokens_out int, response_ms int,
  mode text default 'fallback',
  created_at timestamptz default now());
create index if not exists ai_messages_conv_idx on ai_messages(conversation_id, id);
create index if not exists ai_messages_created_idx on ai_messages(created_at);

create table if not exists ai_knowledge(
  id serial primary key, title text not null, category text not null default 'General',
  content text not null, active boolean not null default true, position int not null default 0,
  created_by int references users(id) on delete set null, updated_by int references users(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists ai_knowledge_active_idx on ai_knowledge(active, category);

create table if not exists support_tickets(
  id bigserial primary key, ref text unique not null,
  conversation_id bigint references ai_conversations(id) on delete set null,
  user_id int references users(id) on delete set null,
  email text, name text,
  subject text not null, category text not null default 'GENERAL',
  priority text not null default 'MEDIUM' check(priority in ('LOW','MEDIUM','HIGH','URGENT')),
  status text not null default 'OPEN' check(status in ('OPEN','AI_HANDLING','WAITING_FOR_CUSTOMER','ESCALATED','ASSIGNED','RESOLVED','CLOSED')),
  summary text, assigned_staff_id int references users(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists support_tickets_status_idx on support_tickets(status, updated_at desc);
create index if not exists support_tickets_user_idx on support_tickets(user_id);

create table if not exists support_messages(
  id bigserial primary key, ticket_id bigint not null references support_tickets(id) on delete cascade,
  author_id int references users(id) on delete set null,
  author_role text not null check(author_role in ('customer','staff','ai')),
  body text not null, created_at timestamptz default now());
create index if not exists support_messages_ticket_idx on support_messages(ticket_id, id);

create table if not exists ai_usage(
  id bigserial primary key,
  conversation_id bigint references ai_conversations(id) on delete set null,
  user_id int references users(id) on delete set null,
  provider text, model text, feature text not null default 'chat',
  tokens_in int not null default 0, tokens_out int not null default 0, ms int not null default 0,
  ok boolean not null default true,
  created_at timestamptz default now());
create index if not exists ai_usage_created_idx on ai_usage(created_at);

-- Built-in bots: intent routing picks one; owner can edit or add more.
insert into ai_bots(key,name,description,personality,system_instructions,tools,knowledge_categories,position,built_in) values
 ('shopping','Shopping Assistant','Helps customers find, compare and choose products.','Warm, helpful, never pushy.','You help customers find products in this store. Only recommend products that appear in the supplied store data, and never claim an unavailable size or colour is in stock.', '["search_products","product_details","compare_products","recommend_products","check_availability"]','["Products","Sizing"]',1,true),
 ('orders','Order Assistant','Order status and tracking for signed-in customers.','Calm, precise.','You answer questions about the signed-in customer''s own orders using only the supplied order data. Never invent tracking numbers or delivery dates.', '["own_orders"]','["Orders","Delivery"]',2,true),
 ('delivery','Delivery Assistant','Shipping methods, costs and delivery times.','Clear, reassuring.','You explain shipping using only the supplied shipping rates and knowledge. If an exact date is not confirmed, say so.', '["shipping_info"]','["Delivery","Shipping"]',3,true),
 ('payments','Payment Assistant','Payment and checkout questions.','Careful, security-conscious.','You explain checkout and payment. Never ask for card numbers, CVV, banking passwords or OTPs. Payment happens only inside the store''s secure checkout.', '[]','["Payment","Checkout"]',4,true),
 ('support','General Support','Everything else: policies, account help, escalation.','Patient, professional.','You answer store questions from the approved knowledge base. If you cannot confirm something, say you are not able to confirm it and offer human support.', '["knowledge_search","store_info","create_ticket"]','["General","Returns","Refunds","Account","Store info"]',5,true)
 on conflict (key) do nothing;

-- Starter knowledge; the owner edits these in the dashboard.
insert into ai_knowledge(title,category,content,position) select * from (values
 ('Returns and exchanges','Returns','Changed your mind? Returns are free within 7 days of delivery. To start a return or exchange, the customer contacts the store through the contact details shown in the assistant. Refunds are processed by the store team - the assistant never promises a refund before the store confirms it.',1),
 ('Delivery','Delivery','Standard delivery is available anywhere in South Africa. The exact fee and estimated working days are shown at checkout and come from the store''s shipping settings. Free delivery applies when the order reaches the free-shipping threshold in those settings.',2),
 ('Payment','Payment','Payment is made online at checkout through the store''s secure payment step. The available payment methods are shown on the payment step before anything is charged. The assistant never asks for card numbers, CVV codes, banking passwords or OTPs.',3),
 ('Sizing','Sizing','Tees come in S, M, L and XL. Beanies are one size. Colour and size are picked on the product page before adding to cart. Stock shown by the assistant comes straight from the store inventory.',4),
 ('Order tracking','Orders','Right after checkout the customer gets an order page link with live status. Customers who shopped while signed in can also find every order under Account, then Orders. Order statuses: PENDING, PAID, PROCESSING, PACKED, SHIPPED, DELIVERED, CANCELLED, REFUNDED.',5),
 ('Account help','Account','Customers sign in or create an account from the person icon at the top right of the store. A reset link on the sign-in page handles forgotten passwords.',6)
) as v(title,category,content,position)
 where not exists (select 1 from ai_knowledge);
