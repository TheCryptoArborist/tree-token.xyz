-- REVIEW ONLY. Apply to a separately approved database, never from a site build.
BEGIN;
CREATE SCHEMA tree_continue_v1;
REVOKE ALL ON SCHEMA tree_continue_v1 FROM PUBLIC;
CREATE TABLE tree_continue_v1.orders (
  account_id uuid NOT NULL, run_id uuid NOT NULL, order_id uuid UNIQUE NOT NULL,
  terms jsonb NOT NULL, state text NOT NULL CHECK(state IN ('ordered','cancelled','verified','delivered')),
  envelope jsonb, evidence jsonb, receipt_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(account_id,run_id),
  CHECK(jsonb_typeof(terms) IS NOT DISTINCT FROM 'object'),
  CHECK(terms->>'kind' IS NOT DISTINCT FROM 'direct-continue' AND terms->>'product' IS NOT DISTINCT FROM 'treeforce89.continue.v1'),
  CHECK(terms->>'requiredRaw' IS NOT DISTINCT FROM '20000000000' AND terms->>'network' IS NOT DISTINCT FROM 'sui:mainnet'),
  CHECK(terms->>'recipient' IS NOT DISTINCT FROM '0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f'),
  CHECK(terms->>'accountId' IS NOT DISTINCT FROM account_id::text AND terms->>'runId' IS NOT DISTINCT FROM run_id::text AND terms->>'orderId' IS NOT DISTINCT FROM order_id::text),
  CHECK(terms ?& ARRAY['kind','product','requiredRaw','network','recipient','accountId','runId','orderId']),
  CHECK((state IN ('verified','delivered')) = (evidence IS NOT NULL AND receipt_id IS NOT NULL))
);
CREATE TABLE tree_continue_v1.receipts (
  receipt_id text PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES tree_continue_v1.orders(order_id), UNIQUE(receipt_id,order_id)
);
ALTER TABLE tree_continue_v1.orders ADD CONSTRAINT direct_claim_matches_order FOREIGN KEY(receipt_id,order_id) REFERENCES tree_continue_v1.receipts(receipt_id,order_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE tree_continue_v1.journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES tree_continue_v1.orders(order_id),
  state text NOT NULL, receipt_id text, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION tree_continue_v1.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'direct_continue_immutable_history'; END $$;
CREATE FUNCTION tree_continue_v1.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.account_id<>OLD.account_id OR NEW.run_id<>OLD.run_id OR NEW.order_id<>OLD.order_id OR NEW.terms<>OLD.terms OR
    (OLD.envelope IS NOT NULL AND NEW.envelope IS DISTINCT FROM OLD.envelope) OR
    (OLD.evidence IS NOT NULL AND NEW.evidence IS DISTINCT FROM OLD.evidence) OR
    (OLD.receipt_id IS NOT NULL AND NEW.receipt_id IS DISTINCT FROM OLD.receipt_id) THEN RAISE EXCEPTION 'direct_continue_order_immutable'; END IF;
  IF NOT(NEW.state=OLD.state OR OLD.state='ordered' AND NEW.state IN ('cancelled','verified') OR
    OLD.state='cancelled' AND NEW.state='verified' OR OLD.state='verified' AND NEW.state='delivered') THEN
      RAISE EXCEPTION 'direct_continue_invalid_transition'; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION tree_continue_v1.record_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.state<>OLD.state THEN
    INSERT INTO tree_continue_v1.journal(order_id,state,receipt_id) VALUES(NEW.order_id,NEW.state,NEW.receipt_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER direct_order_guard BEFORE UPDATE ON tree_continue_v1.orders FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.guard_order();
CREATE TRIGGER direct_order_no_delete BEFORE DELETE ON tree_continue_v1.orders FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable();
CREATE TRIGGER direct_order_history AFTER INSERT OR UPDATE ON tree_continue_v1.orders FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.record_transition();
CREATE TRIGGER direct_journal_immutable BEFORE UPDATE OR DELETE ON tree_continue_v1.journal FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable();
CREATE TRIGGER direct_receipt_immutable BEFORE UPDATE OR DELETE ON tree_continue_v1.receipts FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['orders','receipts','journal'] LOOP
    EXECUTE format('CREATE TRIGGER direct_no_truncate BEFORE TRUNCATE ON tree_continue_v1.%I FOR EACH STATEMENT EXECUTE FUNCTION tree_continue_v1.immutable()',t);
  END LOOP;
END $$;
ALTER TABLE tree_continue_v1.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_continue_v1.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_continue_v1.journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA tree_continue_v1 FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA tree_continue_v1 FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA tree_continue_v1 FROM PUBLIC;
-- Deliberately no browser/API policies, login role, grants or production credentials.
COMMIT;
