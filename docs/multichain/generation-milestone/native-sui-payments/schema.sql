-- Source proposal only; payment evidence is separate from native redemption.
begin;
create table private.arcade_native_sui_payments (
 offer_id text primary key check(offer_id ~ '^[a-f0-9]{48}$'),
 digest text not null unique check(digest ~ '^[1-9A-HJ-NP-Za-km-z]{32,64}$'),
 account_id uuid not null,run_id uuid not null,sequence integer not null check(sequence>0),
 native_session_id text not null,native_run_id text not null,
 wallet text not null,amount text not null,received text not null,
 checkpoint text not null check(checkpoint ~ '^[0-9]+$'),
 timestamp_ms bigint not null,snapshot jsonb not null,
 unique(account_id,run_id,sequence)
);
alter table private.arcade_native_sui_payments enable row level security;
revoke all on private.arcade_native_sui_payments from public,anon,authenticated,service_role;
grant select,insert on private.arcade_native_sui_payments to service_role;
commit;
