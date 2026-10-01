-- Review migration; NEVER applied by a website build.
-- Prerequisites: direct-continue-schema, flight-storage-v1, paid-delivery-v1.
-- No login, password, public API grant, active deployment, or monetary enablement.
BEGIN;
CREATE ROLE tree_continue_orders NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE tree_continue_settlement NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE TABLE tree_continue_v1.commerce_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 new_orders_enabled boolean NOT NULL DEFAULT false,
 settlement_enabled boolean NOT NULL DEFAULT false,
 auth_origin text NOT NULL,
 environment text NOT NULL CHECK(environment IN ('release-candidate','mainnet')),
 admin_wallet text NOT NULL CHECK(admin_wallet ~ '^0x[0-9a-f]{64}$'),
 pilot_wallet text NOT NULL CHECK(pilot_wallet ~ '^0x[0-9a-f]{64}$'),
 deployment jsonb,
 total_limit_raw bigint NOT NULL DEFAULT 0 CHECK(total_limit_raw>=0),
 reserved_raw bigint NOT NULL DEFAULT 0 CHECK(reserved_raw>=0 AND reserved_raw<=total_limit_raw),
 CHECK(NOT new_orders_enabled OR (deployment IS NOT NULL AND total_limit_raw>=20000000000)),
 CHECK(NOT settlement_enabled OR deployment IS NOT NULL)
);
ALTER TABLE tree_continue_v1.commerce_policy ENABLE ROW LEVEL SECURITY;
INSERT INTO tree_continue_v1.commerce_policy(auth_origin,environment,admin_wallet,pilot_wallet) VALUES(
 'https://deploy-preview-48--tree-token.netlify.app','release-candidate',
 '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',
 '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6');

-- Terms/evidence are closed, flat objects. ASCII keys and integer values match
-- continue-product.mjs stable() without depending on jsonb's display spacing.
CREATE FUNCTION tree_continue_v1.commerce_flat_hash(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE text_value text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(v)
  WHERE jsonb_typeof(value) NOT IN ('string','number','boolean')) THEN RAISE EXCEPTION 'commerce_invalid_flat_object'; END IF;
 SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||value::text,',' ORDER BY key COLLATE "C"),'')||'}'
 INTO text_value FROM jsonb_each(v);
 RETURN encode(sha256(convert_to(text_value,'UTF8')),'hex');
END $$;
CREATE FUNCTION tree_continue_v1.commerce_policy_read() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('newOrdersEnabled',new_orders_enabled,'settlementEnabled',settlement_enabled,
  'authOrigin',auth_origin,'environment',environment,'adminWallet',admin_wallet,'pilotWallet',pilot_wallet,
  'deployment',deployment,'totalLimitRaw',total_limit_raw::text,'reservedRaw',reserved_raw::text)
 FROM tree_continue_v1.commerce_policy WHERE singleton
$$;
CREATE FUNCTION tree_continue_v1.commerce_read(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders;
BEGIN
 IF p_account IS NULL OR p_run IS NULL THEN RAISE EXCEPTION 'commerce_identity_required'; END IF;
 PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_account::text||':'||p_run::text,0));
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('terms',o.terms,'state',o.state,'envelope',o.envelope,'evidence',o.evidence,'receiptId',o.receipt_id);
END $$;

-- The order role has no parameter for payment evidence, receipts or delivery.
CREATE FUNCTION tree_continue_v1.commerce_save_order(p_account uuid,p_payer text,p_origin text,p_environment text,
 p_run uuid,p_terms jsonb,p_state text,p_envelope jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders; policy tree_continue_v1.commerce_policy; k text; clock_ms bigint;
 allowed constant text[]:=ARRAY['kind','product','policyVersion','network','chainIdentifier','decimals','coinType','recipient','requiredRaw','quantity','restoreLives','orderId','accountId','runId','payer','checkoutPackage','checkoutId','eventType','keyEpoch','flightHash','issuedAtMs','expiresAtMs','quoteHash'];
BEGIN
 PERFORM tree_continue_v1.commerce_read(p_account,p_payer,p_origin,p_environment,p_run);
 IF jsonb_typeof(p_terms) IS DISTINCT FROM 'object' OR NOT(p_terms ?& allowed) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(p_terms) x WHERE NOT(x=ANY(allowed))) OR
  p_terms->>'quoteHash' IS DISTINCT FROM tree_continue_v1.commerce_flat_hash(p_terms-'quoteHash') THEN
  RAISE EXCEPTION 'commerce_invalid_order_commitment'; END IF;
 IF NOT(p_terms @> jsonb_build_object('kind','direct-continue','product','treeforce89.continue.v1',
  'policyVersion','treeforce89-20000-tree-v1','network','sui:mainnet','chainIdentifier','35834a8a',
  'decimals',6,'requiredRaw','20000000000','quantity',1,'restoreLives',3,
  'coinType','0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  'recipient','0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f',
  'accountId',p_account::text,'runId',p_run::text,'payer',p_payer)) THEN RAISE EXCEPTION 'commerce_fixed_product_mismatch'; END IF;
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF o.order_id IS NOT NULL AND o.terms IS DISTINCT FROM p_terms THEN RAISE EXCEPTION 'commerce_order_immutable'; END IF;
 IF p_state='cancelled' THEN
  IF o.order_id IS NULL THEN RAISE EXCEPTION 'commerce_order_not_found'; END IF;
  IF p_envelope IS DISTINCT FROM o.envelope THEN RAISE EXCEPTION 'commerce_envelope_immutable'; END IF;
  IF o.state='ordered' THEN UPDATE tree_continue_v1.orders SET state='cancelled' WHERE order_id=o.order_id; END IF;
  RETURN;
 END IF;
 IF p_state IS DISTINCT FROM 'ordered' OR (o.order_id IS NOT NULL AND o.state<>'ordered') THEN RAISE EXCEPTION 'commerce_order_role_cannot_settle'; END IF;
 SELECT * INTO policy FROM tree_continue_v1.commerce_policy WHERE singleton FOR UPDATE;
 IF NOT FOUND OR NOT policy.new_orders_enabled OR policy.deployment IS NULL THEN RAISE EXCEPTION 'commerce_sales_disabled'; END IF;
 IF (p_origin,p_environment,p_payer) IS DISTINCT FROM (policy.auth_origin,policy.environment,policy.pilot_wallet) THEN RAISE EXCEPTION 'commerce_pilot_binding_mismatch'; END IF;
 IF p_terms->>'checkoutPackage' IS DISTINCT FROM policy.deployment->>'packageId' OR
  p_terms->>'checkoutId' IS DISTINCT FROM policy.deployment->>'checkoutId' OR
  p_terms->>'keyEpoch' IS DISTINCT FROM policy.deployment->>'keyEpoch' OR
  p_terms->>'eventType' IS DISTINCT FROM (policy.deployment->>'packageId')||'::checkout::Purchase' OR
  policy.deployment->>'network' IS DISTINCT FROM 'sui:mainnet' THEN RAISE EXCEPTION 'commerce_deployment_mismatch'; END IF;
 IF p_terms->>'checkoutPackage' !~ '^0x[0-9a-f]{64}$' OR p_terms->>'checkoutId' !~ '^0x[0-9a-f]{64}$' OR
  p_terms->>'checkoutPackage'=p_terms->>'checkoutId' OR p_terms->>'keyEpoch' !~ '^[1-9][0-9]{0,18}$' OR
  p_terms->>'flightHash' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_terms->'issuedAtMs') IS DISTINCT FROM 'number' OR
  jsonb_typeof(p_terms->'expiresAtMs') IS DISTINCT FROM 'number' OR p_terms->>'issuedAtMs' !~ '^[1-9][0-9]{0,15}$' OR
  p_terms->>'expiresAtMs' !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'commerce_invalid_order_fields'; END IF;
 clock_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 IF (p_terms->>'expiresAtMs')::bigint-(p_terms->>'issuedAtMs')::bigint<>45000 OR
  (p_terms->>'issuedAtMs')::bigint>clock_ms+5000 OR (p_terms->>'expiresAtMs')::bigint<clock_ms THEN RAISE EXCEPTION 'commerce_order_expired'; END IF;
 IF p_envelope IS NOT NULL THEN
  IF jsonb_typeof(p_envelope) IS DISTINCT FROM 'object' OR NOT(p_envelope ?& ARRAY['quoteBase64','signatureBase64','payable']) OR
   (SELECT count(*) FROM jsonb_object_keys(p_envelope))<>3 OR p_envelope->'payable' IS DISTINCT FROM 'false'::jsonb OR
   jsonb_typeof(p_envelope->'quoteBase64') IS DISTINCT FROM 'string' OR jsonb_typeof(p_envelope->'signatureBase64') IS DISTINCT FROM 'string' OR
   length(p_envelope->>'quoteBase64')>684 OR length(p_envelope->>'signatureBase64')<>88 THEN RAISE EXCEPTION 'commerce_invalid_envelope'; END IF;
  FOREACH k IN ARRAY ARRAY['quoteBase64','signatureBase64'] LOOP
   IF p_envelope->>k IS DISTINCT FROM replace(encode(decode(p_envelope->>k,'base64'),'base64'),E'\n','') THEN RAISE EXCEPTION 'commerce_noncanonical_envelope'; END IF;
  END LOOP;
  IF octet_length(decode(p_envelope->>'quoteBase64','base64')) NOT BETWEEN 1 AND 512 OR
   octet_length(decode(p_envelope->>'signatureBase64','base64'))<>64 THEN RAISE EXCEPTION 'commerce_invalid_envelope_length'; END IF;
 END IF;
 IF o.order_id IS NULL THEN
  -- Reserve the whole potential payment before returning a signature. Cancelled
  -- or expired quotes do not automatically free capacity: they are not proof of nonpayment.
  IF policy.total_limit_raw-policy.reserved_raw<20000000000 THEN RAISE EXCEPTION 'commerce_pilot_cap_reached'; END IF;
  INSERT INTO tree_continue_v1.orders(account_id,run_id,order_id,terms,state,envelope)
   VALUES(p_account,p_run,(p_terms->>'orderId')::uuid,p_terms,'ordered',p_envelope);
  UPDATE tree_continue_v1.commerce_policy SET reserved_raw=reserved_raw+20000000000 WHERE singleton;
 ELSE
  UPDATE tree_continue_v1.orders SET envelope=p_envelope WHERE order_id=o.order_id;
 END IF;
END $$;

-- Trusted settlement worker ONLY, after independent BCS/effects verification.
-- This function validates evidence consistency; Postgres does not query Sui.
CREATE FUNCTION tree_continue_v1.commerce_settle(p_account uuid,p_payer text,p_origin text,p_environment text,
 p_run uuid,p_order uuid,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders; policy tree_continue_v1.commerce_policy; rid text; claimed uuid; k text; expected text;
 fields constant text[]:=ARRAY['source','network','finalized','status','digest','eventIndex','checkpoint','timestampMs','eventType','orderId','accountId','payer','recipient','coinType','amountRaw','quoteHash','checkoutId','keyEpoch','checkpointTimestampMs','paymentTimeSource','evidenceHash'];
BEGIN
 PERFORM tree_continue_v1.commerce_read(p_account,p_payer,p_origin,p_environment,p_run);
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF o.order_id IS NULL OR p_order IS DISTINCT FROM o.order_id OR o.envelope IS NULL THEN RAISE EXCEPTION 'commerce_signed_order_required'; END IF;
 SELECT * INTO policy FROM tree_continue_v1.commerce_policy WHERE singleton FOR SHARE;
 IF NOT FOUND OR NOT policy.settlement_enabled OR policy.deployment IS NULL THEN RAISE EXCEPTION 'commerce_settlement_disabled'; END IF;
 IF (p_origin,p_environment) IS DISTINCT FROM (policy.auth_origin,policy.environment) OR
  o.terms->>'checkoutPackage' IS DISTINCT FROM policy.deployment->>'packageId' OR
  o.terms->>'checkoutId' IS DISTINCT FROM policy.deployment->>'checkoutId' OR
  (o.terms->>'keyEpoch')::numeric>(policy.deployment->>'keyEpoch')::numeric THEN RAISE EXCEPTION 'commerce_settlement_deployment_mismatch'; END IF;
 IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR NOT(p_evidence ?& fields) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(p_evidence) x WHERE NOT(x=ANY(fields))) OR
  p_evidence->>'evidenceHash' IS DISTINCT FROM tree_continue_v1.commerce_flat_hash(p_evidence-'evidenceHash') OR
  NOT(p_evidence @> '{"source":"chain-reader","status":"success","finalized":true,"paymentTimeSource":"checkout-clock"}'::jsonb) THEN RAISE EXCEPTION 'commerce_invalid_evidence'; END IF;
 FOREACH k IN ARRAY ARRAY['network','eventType','orderId','accountId','payer','recipient','coinType','quoteHash','checkoutId','keyEpoch'] LOOP
  IF p_evidence->k IS DISTINCT FROM o.terms->k THEN RAISE EXCEPTION 'commerce_receipt_order_mismatch'; END IF;
 END LOOP;
 IF p_evidence->'amountRaw' IS DISTINCT FROM o.terms->'requiredRaw' OR
  p_evidence->>'digest' !~ '^[1-9A-HJ-NP-Za-km-z]{43,44}$' OR
  jsonb_typeof(p_evidence->'eventIndex') IS DISTINCT FROM 'string' OR p_evidence->>'eventIndex' !~ '^(0|[1-9][0-9]{0,4})$' OR
  jsonb_typeof(p_evidence->'checkpoint') IS DISTINCT FROM 'string' OR p_evidence->>'checkpoint' !~ '^(0|[1-9][0-9]{0,19})$' OR
  (p_evidence->>'checkpoint')::numeric>18446744073709551615 OR
  jsonb_typeof(p_evidence->'timestampMs') IS DISTINCT FROM 'number' OR jsonb_typeof(p_evidence->'checkpointTimestampMs') IS DISTINCT FROM 'number' OR
  p_evidence->>'timestampMs' !~ '^[1-9][0-9]{0,15}$' OR p_evidence->>'checkpointTimestampMs' !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'commerce_invalid_receipt_fields'; END IF;
 IF (p_evidence->>'timestampMs')::bigint NOT BETWEEN (o.terms->>'issuedAtMs')::bigint AND (o.terms->>'expiresAtMs')::bigint OR
  (p_evidence->>'checkpointTimestampMs')::bigint<(p_evidence->>'timestampMs')::bigint THEN RAISE EXCEPTION 'commerce_receipt_time_mismatch'; END IF;
 rid:='sui:mainnet:'||(p_evidence->>'digest')||':'||(p_evidence->>'eventIndex');
 IF o.evidence IS NOT NULL THEN
  IF o.evidence IS DISTINCT FROM p_evidence OR o.receipt_id IS DISTINCT FROM rid THEN RAISE EXCEPTION 'commerce_receipt_immutable'; END IF;
  RETURN; -- Never change delivered back to verified.
 END IF;
 INSERT INTO tree_continue_v1.receipts(receipt_id,order_id) VALUES(rid,p_order) ON CONFLICT(receipt_id) DO NOTHING;
 SELECT order_id INTO claimed FROM tree_continue_v1.receipts WHERE receipt_id=rid;
 IF claimed IS DISTINCT FROM p_order THEN RAISE EXCEPTION 'commerce_receipt_already_used'; END IF;
 UPDATE tree_continue_v1.orders SET evidence=p_evidence,receipt_id=rid,state='verified' WHERE order_id=p_order;
END $$;

REVOKE ALL ON TABLE tree_continue_v1.commerce_policy FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION tree_continue_v1.commerce_flat_hash(jsonb),tree_continue_v1.commerce_policy_read(),
 tree_continue_v1.commerce_read(uuid,text,text,text,uuid),tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb),
 tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','tree_continue_storage','tree_continue_delivery','tree_continue_recovery'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON TABLE tree_continue_v1.commerce_policy FROM %I',r);
   EXECUTE format('REVOKE EXECUTE ON FUNCTION tree_continue_v1.commerce_flat_hash(jsonb),tree_continue_v1.commerce_policy_read(),tree_continue_v1.commerce_read(uuid,text,text,text,uuid),tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb),tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) FROM %I',r);
  END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA tree_continue_v1 TO tree_continue_orders,tree_continue_settlement;
GRANT EXECUTE ON FUNCTION tree_continue_v1.commerce_read(uuid,text,text,text,uuid),tree_continue_v1.commerce_policy_read()
 TO tree_continue_orders,tree_continue_settlement;
GRANT EXECUTE ON FUNCTION tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb) TO tree_continue_orders;
GRANT EXECUTE ON FUNCTION tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) TO tree_continue_settlement;
COMMIT;
