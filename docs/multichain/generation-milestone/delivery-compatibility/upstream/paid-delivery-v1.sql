-- Additive, private delivery protocol. Apply after flight-storage-v1.sql.
-- No active application role, browser, or service_role receives access here.
-- Receipt verification and checkpoint review remain prerequisites, not bypasses.
BEGIN;
CREATE TABLE tree_continue_v1.paid_deliveries (
  order_id uuid PRIMARY KEY REFERENCES tree_continue_v1.orders(order_id),
  receipt_id text UNIQUE NOT NULL REFERENCES tree_continue_v1.receipts(receipt_id),
  lease_id uuid UNIQUE NOT NULL,
  client_hash text NOT NULL CHECK(client_hash ~ '^[a-f0-9]{64}$'),
  checkpoint_hash text NOT NULL CHECK(checkpoint_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('prepared','started')),
  lease_until timestamptz NOT NULL,
  activation_request uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((state='started')=(activation_request IS NOT NULL))
);
CREATE TABLE tree_continue_v1.paid_delivery_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES tree_continue_v1.orders(order_id),
  lease_id uuid NOT NULL,
  event text NOT NULL CHECK(event IN ('prepared','reprepared','started')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION tree_continue_v1.guard_paid_delivery() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.state='started' OR NEW.order_id<>OLD.order_id OR NEW.receipt_id<>OLD.receipt_id OR
   NEW.checkpoint_hash<>OLD.checkpoint_hash THEN RAISE EXCEPTION 'paid_delivery_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paid_delivery_guard BEFORE UPDATE ON tree_continue_v1.paid_deliveries
 FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.guard_paid_delivery();
CREATE TRIGGER paid_delivery_no_delete BEFORE DELETE ON tree_continue_v1.paid_deliveries
 FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable();
CREATE TRIGGER paid_delivery_history_immutable BEFORE UPDATE OR DELETE ON tree_continue_v1.paid_delivery_events
 FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['paid_deliveries','paid_delivery_events'] LOOP
  EXECUTE format('ALTER TABLE tree_continue_v1.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE TRIGGER paid_no_truncate BEFORE TRUNCATE ON tree_continue_v1.%I FOR EACH STATEMENT EXECUTE FUNCTION tree_continue_v1.immutable()',t);
 END LOOP;
END $$;

-- Only a server-verified identity may call this via a dedicated backend role.
-- p_client_hash is SHA-256 of a per-page 32-byte random key, never a wallet key.
-- Preparing does NOT authorize gameplay. Activation consumes one authorization
-- before the browser restores lives. Ambiguous post-activation crashes require
-- review, not a new payment or an automatically replayed three-life grant.
CREATE FUNCTION tree_continue_v1.paid_delivery(
 p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid,p_action text,
 p_client_hash text DEFAULT NULL,p_lease uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders; c tree_continue_v1.checkpoints; d tree_continue_v1.paid_deliveries;
 result jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 IF p_account IS NULL OR p_run IS NULL OR p_action IS NULL OR p_action NOT IN ('status','prepare','activate') THEN
  RAISE EXCEPTION 'invalid_paid_delivery_command'; END IF;
 PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_account::text||':'||p_run::text,0));
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'paid_order_not_found'; END IF;
 result:=jsonb_build_object('protocol','tree-paid-delivery.v1','runId',p_run,'orderId',o.order_id,
  'requiresPayment',false,'restoreAuthorized',false);
 IF o.state NOT IN ('verified','delivered') THEN
  RETURN result||jsonb_build_object('status','awaiting-verification'); END IF;
 SELECT * INTO c FROM tree_continue_v1.checkpoints WHERE account_id=p_account AND run_id=p_run;
 IF c.checkpoint_id IS NULL OR o.terms->>'flightHash' IS DISTINCT FROM c.checkpoint_hash OR
  o.terms->>'payer' IS DISTINCT FROM p_payer OR o.terms->>'requiredRaw' IS DISTINCT FROM '20000000000' OR
  o.terms->>'network' IS DISTINCT FROM 'sui:mainnet' OR o.terms->>'recipient' IS DISTINCT FROM
  '0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f' OR
  o.evidence->>'source' IS DISTINCT FROM 'chain-reader' OR o.evidence->>'status' IS DISTINCT FROM 'success' OR
  o.evidence->'finalized' IS DISTINCT FROM 'true'::jsonb OR
  NOT EXISTS(SELECT 1 FROM tree_continue_v1.receipts WHERE order_id=o.order_id AND receipt_id=o.receipt_id) OR
  NOT EXISTS(SELECT 1 FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id AND outcome='validated') THEN
  RAISE EXCEPTION 'paid_delivery_prerequisite_failed'; END IF;
 result:=result||jsonb_build_object('checkpointHash',c.checkpoint_hash,'receiptId',o.receipt_id);
 SELECT * INTO d FROM tree_continue_v1.paid_deliveries WHERE order_id=o.order_id FOR UPDATE;
 -- A legacy delivery or a different page cannot reacquire consumed gameplay.
 IF o.state='delivered' AND d.order_id IS NULL THEN
  RETURN result||jsonb_build_object('status','review-required'); END IF;
 IF p_action='status' THEN
  RETURN result||jsonb_build_object('status',CASE WHEN d.state='started' THEN 'review-required'
   WHEN d.state='prepared' AND d.lease_until>clock_timestamp() THEN 'in-use' ELSE 'available' END);
 END IF;
 IF p_client_hash IS NULL OR p_client_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'delivery_client_required'; END IF;
 IF p_action='prepare' THEN
  IF d.state='started' THEN RETURN result||jsonb_build_object('status','review-required'); END IF;
  IF d.order_id IS NOT NULL AND d.lease_until>clock_timestamp() AND d.client_hash<>p_client_hash THEN
   RETURN result||jsonb_build_object('status','in-use'); END IF;
  IF d.order_id IS NULL OR d.lease_until<=clock_timestamp() THEN
   stamp:=clock_timestamp();
   INSERT INTO tree_continue_v1.paid_delivery_events(order_id,lease_id,event)
    VALUES(o.order_id,gen_random_uuid(),CASE WHEN d.order_id IS NULL THEN 'prepared' ELSE 'reprepared' END)
    RETURNING lease_id INTO d.lease_id;
   INSERT INTO tree_continue_v1.paid_deliveries(order_id,receipt_id,lease_id,client_hash,checkpoint_hash,state,lease_until)
    VALUES(o.order_id,o.receipt_id,d.lease_id,p_client_hash,c.checkpoint_hash,'prepared',stamp+interval '120 seconds')
    ON CONFLICT(order_id) DO UPDATE SET lease_id=EXCLUDED.lease_id,client_hash=EXCLUDED.client_hash,lease_until=EXCLUDED.lease_until
    RETURNING * INTO d;
  END IF;
  RETURN result||jsonb_build_object('status','prepared','leaseId',d.lease_id,
   'leaseExpiresAt',floor(extract(epoch from d.lease_until)*1000)::bigint,'snapshotText',c.snapshot_text);
 END IF;
 IF p_lease IS NULL OR p_request IS NULL OR p_hash IS NULL OR p_hash<>c.checkpoint_hash THEN
  RAISE EXCEPTION 'delivery_checkpoint_mismatch'; END IF;
 IF d.state='started' THEN
  IF d.client_hash=p_client_hash AND d.lease_id=p_lease AND d.activation_request=p_request THEN
   RETURN result||jsonb_build_object('status','started','leaseId',d.lease_id,'activationId',d.activation_request,'lives',3,'restoreAuthorized',true,'replay',true);
  END IF;
  RETURN result||jsonb_build_object('status','review-required');
 END IF;
 IF d.order_id IS NULL OR d.client_hash<>p_client_hash OR d.lease_id<>p_lease THEN RAISE EXCEPTION 'delivery_lease_mismatch'; END IF;
 IF d.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'delivery_lease_expired'; END IF;
 UPDATE tree_continue_v1.paid_deliveries SET state='started',activation_request=p_request WHERE order_id=o.order_id;
 -- The entitlement consumption and its existing order journal commit atomically.
 UPDATE tree_continue_v1.orders SET state='delivered' WHERE order_id=o.order_id;
 INSERT INTO tree_continue_v1.paid_delivery_events(order_id,lease_id,event) VALUES(o.order_id,d.lease_id,'started');
 RETURN result||jsonb_build_object('status','started','leaseId',d.lease_id,'activationId',p_request,'lives',3,'restoreAuthorized',true,'replay',false);
END $$;
CREATE ROLE tree_continue_delivery NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE ALL ON TABLE tree_continue_v1.paid_deliveries,tree_continue_v1.paid_delivery_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE tree_continue_v1.paid_delivery_events_id_seq FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION tree_continue_v1.guard_paid_delivery(),tree_continue_v1.paid_delivery(uuid,text,text,text,uuid,text,text,uuid,uuid,text) FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','tree_continue_storage'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON TABLE tree_continue_v1.paid_deliveries,tree_continue_v1.paid_delivery_events FROM %I',r);
   EXECUTE format('REVOKE ALL ON SEQUENCE tree_continue_v1.paid_delivery_events_id_seq FROM %I',r);
   EXECUTE format('REVOKE EXECUTE ON FUNCTION tree_continue_v1.guard_paid_delivery(),tree_continue_v1.paid_delivery(uuid,text,text,text,uuid,text,text,uuid,uuid,text) FROM %I',r);
  END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA tree_continue_v1 TO tree_continue_delivery;
GRANT EXECUTE ON FUNCTION tree_continue_v1.paid_delivery(uuid,text,text,text,uuid,text,text,uuid,uuid,text) TO tree_continue_delivery;
-- No login, role membership, public RPC, payment activation or verification grant.
COMMIT;
