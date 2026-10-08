-- Encrypted owner-managed provider keys. Never put secrets in the settings table.
create table if not exists ai_provider_keys(
 id serial primary key, provider text not null check(provider in ('nvidia','gemini')),
 encrypted_value text not null, last4 text not null, fingerprint text not null,
 created_at timestamptz default now(), unique(provider,fingerprint));
