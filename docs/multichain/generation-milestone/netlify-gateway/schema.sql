-- REVIEW PROPOSAL ONLY. Outside automatic migration directories.
-- Target: the existing pinned Netlify game database, not the site's default DB.
-- No native table, native grant or existing payment row is modified.
begin;
do $$ begin
 if current_user <> 'netlifydb_owner' then raise exception 'native_schema_owner_required'; end if;
end $$;
create schema private authorization netlifydb_owner;
revoke all on schema private from public,netlifydb_readonly;

-- Source: native-sui-session/schema.sql
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
create table private.arcade_native_paid_recoveries (
 id bigint generated always as identity primary key,
 payment_id uuid not null,
 from_session text not null,to_session text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.arcade_native_paid_recoveries enable row level security;



-- Source: shared-delivery/schema.sql
create table private.arcade_continue_payments_v2 (
 id uuid primary key,
 source text not null check(source in ('sui-tree','sui-native-tree','bnb-usdt')),
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


-- Source: native-sui-payments/schema.sql
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


-- Source: mixed-chain-store/schema.sql
create table private.arcade_bnb_continue_checkouts (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 session_hash text not null check(session_hash ~ '^[a-f0-9]{64}$'),
 account_id uuid not null, run_id uuid not null,
 payer text not null check(payer ~ '^0x[0-9a-f]{40}$'),
 sequence integer not null check(sequence>0),
 terms jsonb not null check(jsonb_typeof(terms)='object' and terms ?& array['id','sessionHash','accountId','runId','payer','suiWallet','sequence','deliveryProtocol','issuedAt','expiresAt','status']),
 payment_terms jsonb not null check(jsonb_typeof(payment_terms)='object'),
 issued_at timestamptz not null, expires_at timestamptz not null,
 status text not null default 'challenge' check(status in ('challenge','open','paid-review','consumed')),
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at and expires_at<=issued_at+interval '5 minutes'),
 check(terms->>'id'=id and terms->>'sessionHash'=session_hash and terms->>'accountId'=account_id::text and terms->>'runId'=run_id::text and terms->>'payer'=payer and (terms->>'sequence')::integer=sequence)
);
create unique index arcade_bnb_continue_one_payer on private.arcade_bnb_continue_checkouts(payer) where status in ('open','paid-review');
create unique index arcade_bnb_continue_one_run on private.arcade_bnb_continue_checkouts(account_id,run_id,sequence) where status in ('open','paid-review');
create index arcade_bnb_continue_challenges on private.arcade_bnb_continue_checkouts(session_hash,issued_at);
create table private.arcade_bnb_continue_receipts (
 checkout_id text primary key references private.arcade_bnb_continue_checkouts(id),
 payment_key text not null unique check(payment_key ~ '^56:0x[a-f0-9]{64}:[0-9]+$'),
 tx_hash text not null unique check(tx_hash ~ '^0x[a-f0-9]{64}$'),
 block_hash text not null check(block_hash ~ '^0x[a-f0-9]{64}$'),
 paid_at timestamptz not null check(isfinite(paid_at)), recorded_at timestamptz not null default clock_timestamp(),
 check(split_part(payment_key,':',2)=tx_hash)
);
create table private.arcade_bnb_continue_delivery_pending (
 checkout_id text primary key references private.arcade_bnb_continue_receipts(checkout_id),
 state text not null default 'pending-review' check(state='pending-review'),
 created_at timestamptz not null default clock_timestamp()
);
alter table private.arcade_bnb_continue_checkouts enable row level security;
alter table private.arcade_bnb_continue_receipts enable row level security;
alter table private.arcade_bnb_continue_delivery_pending enable row level security;
create function private.arcade_bnb_consumed_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='consumed' then raise exception 'consumed_checkout_immutable'; end if;
 if new.status='consumed' then
  if old.status<>'paid-review' then raise exception 'checkout_not_paid'; end if;
  if not exists(select 1 from private.arcade_continue_payments_v2 p
   join private.arcade_continue_claims_v2 c on c.payment_id=p.id
   where p.source='bnb-usdt' and p.source_id=old.id and c.state='started'
   and p.account_id=old.account_id and p.run_id=old.run_id and p.sequence=old.sequence) then
   raise exception 'shared_consumption_required';
  end if;
 end if;
 return new;
end $$;
create trigger arcade_bnb_consumed_guard before update on private.arcade_bnb_continue_checkouts for each row execute function private.arcade_bnb_consumed_guard();


-- Owner-role DML needs explicit guards previously supplied by column privileges.
create function private.reject_native_evidence_mutation() returns trigger language plpgsql as $$
begin raise exception 'native_payment_evidence_immutable'; end $$;
create trigger native_evidence_immutable before update or delete or truncate
on private.arcade_native_sui_payments for each statement
execute function private.reject_native_evidence_mutation();
-- The existing backend already uses this owner connection. Owner access is
-- broad and is NOT a sandbox; application validation and immutable triggers
-- remain required. No browser or public role receives private data access.
revoke all on all tables in schema private from public,netlifydb_readonly;
revoke all on all sequences in schema private from public,netlifydb_readonly;
revoke all on all functions in schema private from public,netlifydb_readonly;
commit;
