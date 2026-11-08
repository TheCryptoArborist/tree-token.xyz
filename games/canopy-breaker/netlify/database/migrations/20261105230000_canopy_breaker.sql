-- Additive migration. No existing arcade tables are touched.
CREATE SCHEMA breaker;
REVOKE ALL ON SCHEMA breaker FROM PUBLIC;
CREATE TABLE breaker.accounts(wallet text PRIMARY KEY CHECK(wallet ~ '^0x[0-9a-f]{64}$'),current_run uuid);
CREATE TABLE breaker.runs(id uuid PRIMARY KEY,wallet text NOT NULL REFERENCES breaker.accounts(wallet),state jsonb NOT NULL,revision integer NOT NULL DEFAULT 0,updated_at bigint NOT NULL,credit integer NOT NULL DEFAULT 120,UNIQUE(id,wallet));
CREATE TABLE breaker.invoices(
 id uuid PRIMARY KEY,wallet text NOT NULL REFERENCES breaker.accounts(wallet),run_id uuid NOT NULL,
 recipient text NOT NULL CHECK(recipient='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f'),
 amount numeric(40,0) NOT NULL CHECK(amount>0),decimals integer NOT NULL CHECK(decimals BETWEEN 0 AND 18),
 created_at bigint NOT NULL,expires_at bigint NOT NULL CHECK(expires_at>created_at),
 status text NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','bound','paid','cancelled','expired')),
 expected_digest text UNIQUE,signed_bytes text,signed_signature text,bound_at bigint,paid_at bigint,
 FOREIGN KEY(run_id,wallet) REFERENCES breaker.runs(id,wallet)
);
CREATE UNIQUE INDEX one_pending_restart ON breaker.invoices(wallet,run_id) WHERE status IN ('quoted','bound');
CREATE TABLE breaker.receipts(digest text PRIMARY KEY,invoice_id uuid NOT NULL UNIQUE REFERENCES breaker.invoices(id),checkpoint text NOT NULL,timestamp_ms bigint NOT NULL);
CREATE TABLE breaker.restarts(invoice_id uuid PRIMARY KEY REFERENCES breaker.invoices(id),new_run uuid NOT NULL UNIQUE REFERENCES breaker.runs(id));
REVOKE ALL ON ALL TABLES IN SCHEMA breaker FROM PUBLIC;
