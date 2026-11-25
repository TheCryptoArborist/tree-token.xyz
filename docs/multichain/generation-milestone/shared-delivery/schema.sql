-- Source-only shared delivery tables. No live migration or role activation.
begin;
create table private.arcade_continue_payments_v2 (
 id uuid primary key,
 source text not null check(source in ('sui-tree','bnb-usdt')),
 source_id text not null,
 receipt_id text not null unique,
 account_id uuid not null, run_id uuid not null,
 sequence integer not null check(sequence>0),
 sui_wallet text not null check(sui_wallet ~ '^0x[a-f0-9]{64}$'),
 payment jsonb not null,
 unique(source,source_id)
);
create table private.arcade_continue_claims_v2 (
 account_id uuid not null, run_id uuid not null,
 sequence integer not null check(sequence>0),
 payment_id uuid not null unique references private.arcade_continue_payments_v2(id),
 checkpoint_hash text not null check(checkpoint_hash ~ '^[a-f0-9]{64}$'),
 snapshot_text text not null,
 client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'),
 lease_id uuid not null unique, lease_until timestamptz not null,
 state text not null check(state in ('prepared','started')),
 activation_id uuid,
 primary key(account_id,run_id,sequence),
 check((state='started')=(activation_id is not null)),
 check(checkpoint_hash=encode(sha256(convert_to(snapshot_text,'UTF8')),'hex'))
);
create table private.arcade_continue_events_v2 (
 id bigint generated always as identity primary key,
 account_id uuid not null,run_id uuid not null,payment_id uuid not null references private.arcade_continue_payments_v2(id),
 sequence integer not null check(sequence>0),
 event text not null check(event in ('prepared','reprepared','started')),
 lease_id uuid not null, created_at timestamptz not null default clock_timestamp()
);
create function private.arcade_continue_claim_guard_v2() returns trigger language plpgsql set search_path='' as $$
begin
 if old.state='started' or new.sequence<>old.sequence or new.account_id<>old.account_id or new.run_id<>old.run_id or new.payment_id<>old.payment_id or new.checkpoint_hash<>old.checkpoint_hash or new.snapshot_text<>old.snapshot_text then
  raise exception 'continue_claim_immutable'; end if;
 return new;
end $$;
create trigger arcade_continue_claim_guard_v2 before update on private.arcade_continue_claims_v2 for each row execute function private.arcade_continue_claim_guard_v2();
alter table private.arcade_continue_payments_v2 enable row level security;
alter table private.arcade_continue_claims_v2 enable row level security;
alter table private.arcade_continue_events_v2 enable row level security;
revoke all on private.arcade_continue_payments_v2,private.arcade_continue_claims_v2,private.arcade_continue_events_v2 from public,anon,authenticated,service_role;
revoke all on sequence private.arcade_continue_events_v2_id_seq from public,anon,authenticated,service_role;
revoke all on function private.arcade_continue_claim_guard_v2() from public,anon,authenticated,service_role;
grant select,insert on private.arcade_continue_payments_v2,private.arcade_continue_events_v2 to service_role;
grant select,insert on private.arcade_continue_claims_v2 to service_role;
grant update(client_hash,lease_id,lease_until,state,activation_id) on private.arcade_continue_claims_v2 to service_role;
grant usage on sequence private.arcade_continue_events_v2_id_seq to service_role;
commit;
