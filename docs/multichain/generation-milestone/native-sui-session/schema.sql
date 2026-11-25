-- Proposed mapping only; not a hosted migration. Native sessions stay authoritative.
begin;
create table private.arcade_native_sui_accounts (
 id uuid primary key,
 database_identity text not null check(database_identity ~ '^[a-f0-9]{64}$'),
 wallet text not null check(wallet ~ '^0x[a-f0-9]{64}$'),
 unique(database_identity,wallet),unique(id,database_identity)
);
create table private.arcade_native_sui_runs (
 id uuid primary key, account_id uuid not null,
 database_identity text not null,
 native_run_id text not null check(native_run_id ~ '^grove-[a-f0-9]{32}$'),
 unique(database_identity,native_run_id),
 foreign key(account_id,database_identity) references private.arcade_native_sui_accounts(id,database_identity)
);
alter table private.arcade_native_sui_accounts enable row level security;
alter table private.arcade_native_sui_runs enable row level security;
revoke all on private.arcade_native_sui_accounts,private.arcade_native_sui_runs from public,anon,authenticated,service_role;
grant select,insert on private.arcade_native_sui_accounts,private.arcade_native_sui_runs to service_role;
-- No privilege changes on native tables. Runtime/session authority remains a release gate.
-- Recovery journal contains no raw credential or credential hash.
create table private.arcade_native_paid_recoveries (
 id bigint generated always as identity primary key,
 payment_id uuid not null,
 from_session text not null,to_session text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.arcade_native_paid_recoveries enable row level security;
revoke all on private.arcade_native_paid_recoveries from public,anon,authenticated,service_role;
revoke all on sequence private.arcade_native_paid_recoveries_id_seq from public,anon,authenticated,service_role;
grant select,insert on private.arcade_native_paid_recoveries to service_role;
grant usage on sequence private.arcade_native_paid_recoveries_id_seq to service_role;

commit;
