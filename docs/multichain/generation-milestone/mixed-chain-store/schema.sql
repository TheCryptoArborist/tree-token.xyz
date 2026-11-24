-- Proposed local-only schema. Not a deployable migration or live authorization.
begin;
create table private.arcade_bnb_continue_checkouts (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 session_hash text not null check(session_hash ~ '^[a-f0-9]{64}$'),
 account_id uuid not null, run_id uuid not null,
 payer text not null check(payer ~ '^0x[0-9a-f]{40}$'),
 sequence integer not null check(sequence>0),
 terms jsonb not null check(jsonb_typeof(terms)='object' and terms ?& array['id','sessionHash','accountId','runId','payer','suiWallet','sequence','deliveryProtocol','issuedAt','expiresAt','status']),
 payment_terms jsonb not null check(jsonb_typeof(payment_terms)='object'),
 issued_at timestamptz not null, expires_at timestamptz not null,
 status text not null default 'challenge' check(status in ('challenge','open','paid-review')),
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at and expires_at<=issued_at+interval '5 minutes'),
 check(terms->>'id'=id and terms->>'sessionHash'=session_hash and terms->>'accountId'=account_id::text and terms->>'runId'=run_id::text and terms->>'payer'=payer)
);
-- No expiry predicate: un-reconciled money must not silently allow another charge.
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
revoke all on private.arcade_bnb_continue_checkouts,private.arcade_bnb_continue_receipts,private.arcade_bnb_continue_delivery_pending from public,anon,authenticated,service_role;
grant select,insert on private.arcade_bnb_continue_checkouts to service_role;
grant update(status) on private.arcade_bnb_continue_checkouts to service_role;
grant select,insert on private.arcade_bnb_continue_receipts,private.arcade_bnb_continue_delivery_pending to service_role;
commit;
