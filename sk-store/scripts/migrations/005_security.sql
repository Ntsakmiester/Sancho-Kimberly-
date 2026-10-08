create table if not exists ai_guest_sessions (
 token_hash text primary key, guest_key text unique not null, expires_at timestamptz not null
);
alter table users add column if not exists totp_last_step bigint;
alter table users add column if not exists totp_pending text;
alter table users add column if not exists totp_pending_until timestamptz;
alter table users add column if not exists totp_recovery_hashes jsonb default '[]';

alter table users add column if not exists totp_enabled boolean not null default false;
