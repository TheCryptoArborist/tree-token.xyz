-- Additive migration for the approved private tree_continue_v1 schema.
-- Apply after direct-continue-schema.sql. Does not enable checkout or create a login.
CREATE TABLE tree_continue_v1.accounts (
  account_id uuid PRIMARY KEY,
  payer text NOT NULL CHECK(payer ~ '^0x[0-9a-f]{64}$' AND payer <> '0x' || repeat('0',64)),
  auth_origin text NOT NULL CHECK(auth_origin ~ '^https://[a-z0-9.-]+(:[0-9]{1,5})?$'),
  environment text NOT NULL CHECK(environment IN ('release-candidate','mainnet')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(environment,auth_origin,payer)
);
CREATE TABLE tree_continue_v1.flights (
  run_id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES tree_continue_v1.accounts,
  ruleset text NOT NULL DEFAULT 'treeforce89.v1' CHECK(ruleset='treeforce89.v1'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(account_id,run_id)
);
CREATE TABLE tree_continue_v1.checkpoints (
  checkpoint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL, run_id uuid NOT NULL, request_id uuid NOT NULL,
  snapshot_text text NOT NULL CHECK(octet_length(snapshot_text) BETWEEN 2 AND 262144),
  checkpoint_hash text NOT NULL CHECK(checkpoint_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(account_id,run_id) REFERENCES tree_continue_v1.flights(account_id,run_id),
  UNIQUE(account_id,run_id), UNIQUE(account_id,request_id),
  CHECK(checkpoint_hash = encode(sha256(convert_to(snapshot_text,'UTF8')),'hex')),
  CHECK(jsonb_typeof(snapshot_text::jsonb) IS NOT DISTINCT FROM 'object'),
  CHECK(snapshot_text::jsonb->>'format' IS NOT DISTINCT FROM 'treeforce89.checkpoint.v1'),
  CHECK(snapshot_text::jsonb->>'ruleset' IS NOT DISTINCT FROM 'treeforce89.v1'),
  CHECK(snapshot_text::jsonb->>'runId' IS NOT DISTINCT FROM run_id::text),
  CHECK(snapshot_text::jsonb->'lives' IS NOT DISTINCT FROM '0'::jsonb),
  CHECK(snapshot_text::jsonb->'continuesUsed' IS NOT DISTINCT FROM '0'::jsonb),
  CHECK(jsonb_typeof(snapshot_text::jsonb->'scene') IS NOT DISTINCT FROM 'object'),
  CHECK(jsonb_typeof(snapshot_text::jsonb->'wave') IS NOT DISTINCT FROM 'number'
    AND (snapshot_text::jsonb->>'wave') ~ '^([1-9]|10)$'),
  CHECK(jsonb_typeof(snapshot_text::jsonb->'score') IS NOT DISTINCT FROM 'number'
    AND (snapshot_text::jsonb->>'score') ~ '^(0|[1-9][0-9]{0,9})$')
);
-- A saved browser snapshot is NOT trusted gameplay. Only a separately reviewed
-- validator may attest it. No validation writer is granted in this migration.
CREATE TABLE tree_continue_v1.checkpoint_reviews (
  checkpoint_id uuid PRIMARY KEY REFERENCES tree_continue_v1.checkpoints,
  outcome text NOT NULL CHECK(outcome IN ('validated','rejected')),
  validator_version text NOT NULL CHECK(length(validator_version) BETWEEN 1 AND 100),
  evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE tree_continue_v1.orders ADD CONSTRAINT direct_order_registered_flight
  FOREIGN KEY(account_id,run_id) REFERENCES tree_continue_v1.flights(account_id,run_id);

CREATE FUNCTION tree_continue_v1.require_validated_checkpoint() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c tree_continue_v1.checkpoints; a tree_continue_v1.accounts;
BEGIN
  SELECT * INTO c FROM tree_continue_v1.checkpoints WHERE account_id=NEW.account_id AND run_id=NEW.run_id;
  SELECT * INTO a FROM tree_continue_v1.accounts WHERE account_id=NEW.account_id;
  IF c.checkpoint_id IS NULL OR a.account_id IS NULL OR
    NEW.terms->>'flightHash' IS DISTINCT FROM c.checkpoint_hash OR
    NEW.terms->>'payer' IS DISTINCT FROM a.payer OR
    NOT EXISTS(SELECT 1 FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id AND outcome='validated') THEN
    RAISE EXCEPTION 'validated_flight_required';
  END IF;
  IF (NEW.state <> 'ordered' AND NOT EXISTS(SELECT 1 FROM tree_continue_v1.orders
      WHERE order_id=NEW.order_id AND account_id=NEW.account_id AND run_id=NEW.run_id)) OR NEW.terms->>'coinType' IS DISTINCT FROM
    '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE' OR
    NEW.terms->'decimals' IS DISTINCT FROM '6'::jsonb OR
    NEW.terms->'quantity' IS DISTINCT FROM '1'::jsonb OR
    NEW.terms->'restoreLives' IS DISTINCT FROM '3'::jsonb THEN RAISE EXCEPTION 'invalid_direct_product'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER direct_order_checkpoint BEFORE INSERT ON tree_continue_v1.orders
  FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.require_validated_checkpoint();

CREATE FUNCTION tree_continue_v1.assert_binding(p_account uuid,p_payer text,p_origin text,p_environment text)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.accounts WHERE account_id=p_account AND payer=p_payer
    AND auth_origin=p_origin AND environment=p_environment) THEN RAISE EXCEPTION 'flight_identity_mismatch'; END IF;
END $$;
CREATE FUNCTION tree_continue_v1.register_flight(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE owner_id uuid;
BEGIN
  IF p_account IS NULL OR p_run IS NULL THEN RAISE EXCEPTION 'flight_identifier_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_account::text || ':' || p_run::text,0));
  INSERT INTO tree_continue_v1.accounts(account_id,payer,auth_origin,environment)
    VALUES(p_account,p_payer,p_origin,p_environment) ON CONFLICT(account_id) DO NOTHING;
  PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
  INSERT INTO tree_continue_v1.flights(account_id,run_id) VALUES(p_account,p_run) ON CONFLICT(run_id) DO NOTHING;
  SELECT account_id INTO owner_id FROM tree_continue_v1.flights WHERE run_id=p_run;
  IF owner_id IS DISTINCT FROM p_account THEN RAISE EXCEPTION 'flight_identity_mismatch'; END IF;
  RETURN jsonb_build_object('runId',p_run,'registered',true,'paymentsEnabled',false);
END $$;
CREATE FUNCTION tree_continue_v1.store_checkpoint(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid,p_request uuid,p_snapshot text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c tree_continue_v1.checkpoints; payload jsonb;
BEGIN
  PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
  IF p_run IS NULL OR p_request IS NULL OR p_snapshot IS NULL OR p_hash IS NULL THEN RAISE EXCEPTION 'checkpoint_fields_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_account::text || ':' || p_run::text,0));
  IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.flights WHERE run_id=p_run AND account_id=p_account) THEN RAISE EXCEPTION 'flight_not_found'; END IF;
  SELECT * INTO c FROM tree_continue_v1.checkpoints WHERE account_id=p_account AND run_id=p_run;
  IF c.checkpoint_id IS NOT NULL THEN
    IF c.snapshot_text IS DISTINCT FROM p_snapshot OR c.checkpoint_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'flight_checkpoint_already_fixed'; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run) THEN RAISE EXCEPTION 'purchase_already_started'; END IF;
    IF octet_length(p_snapshot)>262144 THEN RAISE EXCEPTION 'checkpoint_too_large'; END IF;
    payload:=p_snapshot::jsonb;
    IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_checkpoint'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE k NOT IN ('format','ruleset','runId','wave','score','lives','continuesUsed','scene')) THEN RAISE EXCEPTION 'unexpected_checkpoint_field'; END IF;
    INSERT INTO tree_continue_v1.checkpoints(account_id,run_id,request_id,snapshot_text,checkpoint_hash)
      VALUES(p_account,p_run,p_request,p_snapshot,p_hash) RETURNING * INTO c;
  END IF;
  RETURN jsonb_build_object('runId',p_run,'checkpointId',c.checkpoint_id,'checkpointHash',c.checkpoint_hash,
    'stored',true,'validationRequired',NOT EXISTS(SELECT 1 FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id AND outcome='validated'));
END $$;
CREATE FUNCTION tree_continue_v1.read_recovery(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c tree_continue_v1.checkpoints; o tree_continue_v1.orders; review_state text;
BEGIN
  PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
  IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.flights WHERE account_id=p_account AND run_id=p_run) THEN RAISE EXCEPTION 'flight_not_found'; END IF;
  SELECT * INTO c FROM tree_continue_v1.checkpoints WHERE account_id=p_account AND run_id=p_run;
  SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run;
  SELECT outcome INTO review_state FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id;
  RETURN jsonb_build_object('runId',p_run,'snapshotText',c.snapshot_text,'checkpointHash',c.checkpoint_hash,
    'validation',coalesce(review_state,'unreviewed'),'orderId',o.order_id,'purchaseState',o.state,
    'receiptId',o.receipt_id,'restoreAuthorized',false,'paymentsEnabled',false);
END $$;
DO $$ DECLARE t text; r text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','flights','checkpoints','checkpoint_reviews'] LOOP
    EXECUTE format('ALTER TABLE tree_continue_v1.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE TRIGGER flight_immutable BEFORE UPDATE OR DELETE ON tree_continue_v1.%I FOR EACH ROW EXECUTE FUNCTION tree_continue_v1.immutable()',t);
    EXECUTE format('CREATE TRIGGER flight_no_truncate BEFORE TRUNCATE ON tree_continue_v1.%I FOR EACH STATEMENT EXECUTE FUNCTION tree_continue_v1.immutable()',t);
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tree_continue_storage') THEN RAISE EXCEPTION 'storage_role_already_exists'; END IF;
  CREATE ROLE tree_continue_storage NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  REVOKE ALL ON SCHEMA tree_continue_v1 FROM PUBLIC;
  REVOKE ALL ON ALL TABLES IN SCHEMA tree_continue_v1 FROM PUBLIC;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA tree_continue_v1 FROM PUBLIC;
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA tree_continue_v1 FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA tree_continue_v1 FROM %I',r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA tree_continue_v1 FROM %I',r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA tree_continue_v1 FROM %I',r);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA tree_continue_v1 FROM %I',r);
    END IF;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA tree_continue_v1 TO tree_continue_storage;
GRANT EXECUTE ON FUNCTION tree_continue_v1.register_flight(uuid,text,text,text,uuid),
  tree_continue_v1.store_checkpoint(uuid,text,text,text,uuid,uuid,text,text),
  tree_continue_v1.read_recovery(uuid,text,text,text,uuid) TO tree_continue_storage;
-- No memberships/passwords, browser policies, payment grants, or validation grants.
