-- Standard TREE transfers for casual continues; no Move deployment or signing key.
-- Existing identity binding, immutable snapshots, receipt claims and delivery persist.
-- This migration leaves sales and settlement paused.
BEGIN;
ALTER FUNCTION tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb) RENAME TO commerce_save_contract_order;
ALTER FUNCTION tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) RENAME TO commerce_settle_contract;
CREATE FUNCTION tree_continue_v1.commerce_save_order(p_account uuid,p_payer text,p_origin text,p_environment text,
 p_run uuid,p_terms jsonb,p_state text,p_envelope jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders; p tree_continue_v1.commerce_policy; clock_ms bigint;
 fields constant text[]:=ARRAY['kind','product','policyVersion','network','chainIdentifier','decimals','coinType','recipient','requiredRaw','quantity','restoreLives','orderId','accountId','runId','payer','paymentMethod','flightHash','issuedAtMs','expiresAtMs','quoteHash'];
BEGIN
 IF p_terms->>'paymentMethod' IS DISTINCT FROM 'tree-transfer-v1' THEN
  PERFORM tree_continue_v1.commerce_save_contract_order(p_account,p_payer,p_origin,p_environment,p_run,p_terms,p_state,p_envelope); RETURN;
 END IF;
 PERFORM tree_continue_v1.commerce_read(p_account,p_payer,p_origin,p_environment,p_run);
 IF jsonb_typeof(p_terms) IS DISTINCT FROM 'object' OR NOT(p_terms ?& fields) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(p_terms) x WHERE NOT(x=ANY(fields))) OR
  p_terms->>'quoteHash' IS DISTINCT FROM tree_continue_v1.commerce_flat_hash(p_terms-'quoteHash') OR p_envelope IS NOT NULL THEN
  RAISE EXCEPTION 'commerce_invalid_transfer_order'; END IF;
 IF NOT(p_terms @> jsonb_build_object('kind','direct-continue','product','treeforce89.continue.v1',
  'policyVersion','treeforce89-20000-tree-v1','network','sui:mainnet','chainIdentifier','35834a8a',
  'decimals',6,'requiredRaw','20000000000','quantity',1,'restoreLives',3,'paymentMethod','tree-transfer-v1',
  'coinType','0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  'recipient','0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f',
  'accountId',p_account::text,'runId',p_run::text,'payer',p_payer)) THEN RAISE EXCEPTION 'commerce_fixed_product_mismatch'; END IF;
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF o.order_id IS NOT NULL AND o.terms IS DISTINCT FROM p_terms THEN RAISE EXCEPTION 'commerce_order_immutable'; END IF;
 IF p_state='cancelled' THEN
  IF o.order_id IS NULL THEN RAISE EXCEPTION 'commerce_order_not_found'; END IF;
  IF o.state='ordered' THEN UPDATE tree_continue_v1.orders SET state='cancelled' WHERE order_id=o.order_id; END IF; RETURN;
 END IF;
 IF p_state IS DISTINCT FROM 'ordered' OR (o.order_id IS NOT NULL AND o.state<>'ordered') THEN RAISE EXCEPTION 'commerce_order_role_cannot_settle'; END IF;
 SELECT * INTO p FROM tree_continue_v1.commerce_policy WHERE singleton FOR UPDATE;
 IF NOT FOUND OR NOT p.new_orders_enabled THEN RAISE EXCEPTION 'commerce_sales_disabled'; END IF;
 IF (p_origin,p_environment,p_payer) IS DISTINCT FROM (p.auth_origin,p.environment,p.pilot_wallet) THEN RAISE EXCEPTION 'commerce_pilot_binding_mismatch'; END IF;
 IF p.deployment IS DISTINCT FROM '{"network":"sui:mainnet","paymentMethod":"tree-transfer-v1"}'::jsonb THEN RAISE EXCEPTION 'commerce_deployment_mismatch'; END IF;
 IF p_terms->>'flightHash' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_terms->'issuedAtMs') IS DISTINCT FROM 'number' OR
  jsonb_typeof(p_terms->'expiresAtMs') IS DISTINCT FROM 'number' OR p_terms->>'issuedAtMs' !~ '^[1-9][0-9]{0,15}$' OR
  p_terms->>'expiresAtMs' !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'commerce_invalid_order_fields'; END IF;
 clock_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 IF (p_terms->>'expiresAtMs')::bigint-(p_terms->>'issuedAtMs')::bigint<>900000 OR
  (p_terms->>'issuedAtMs')::bigint>clock_ms+5000 OR (p_terms->>'expiresAtMs')::bigint<clock_ms THEN RAISE EXCEPTION 'commerce_order_expired'; END IF;
 IF o.order_id IS NULL THEN
  IF p.total_limit_raw-p.reserved_raw<20000000000 THEN RAISE EXCEPTION 'commerce_pilot_cap_reached'; END IF;
  INSERT INTO tree_continue_v1.orders(account_id,run_id,order_id,terms,state)
   VALUES(p_account,p_run,(p_terms->>'orderId')::uuid,p_terms,'ordered');
  UPDATE tree_continue_v1.commerce_policy SET reserved_raw=reserved_raw+20000000000 WHERE singleton;
 END IF;
END $$;
CREATE FUNCTION tree_continue_v1.commerce_settle(p_account uuid,p_payer text,p_origin text,p_environment text,
 p_run uuid,p_order uuid,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o tree_continue_v1.orders; p tree_continue_v1.commerce_policy; rid text; claimed uuid; k text;
 fields constant text[]:=ARRAY['source','network','paymentMethod','finalized','status','digest','eventIndex','checkpoint','timestampMs','orderId','accountId','payer','recipient','coinType','amountRaw','quoteHash','paymentReference','evidenceHash'];
BEGIN
 PERFORM tree_continue_v1.commerce_read(p_account,p_payer,p_origin,p_environment,p_run);
 SELECT * INTO o FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run FOR UPDATE;
 IF o.terms->>'paymentMethod' IS DISTINCT FROM 'tree-transfer-v1' THEN
  PERFORM tree_continue_v1.commerce_settle_contract(p_account,p_payer,p_origin,p_environment,p_run,p_order,p_evidence); RETURN;
 END IF;
 IF o.order_id IS NULL OR p_order IS DISTINCT FROM o.order_id THEN RAISE EXCEPTION 'commerce_order_required'; END IF;
 SELECT * INTO p FROM tree_continue_v1.commerce_policy WHERE singleton FOR SHARE;
 IF NOT FOUND OR NOT p.settlement_enabled THEN RAISE EXCEPTION 'commerce_settlement_disabled'; END IF;
 IF (p_origin,p_environment) IS DISTINCT FROM (p.auth_origin,p.environment) OR
  p.deployment IS DISTINCT FROM '{"network":"sui:mainnet","paymentMethod":"tree-transfer-v1"}'::jsonb THEN RAISE EXCEPTION 'commerce_settlement_deployment_mismatch'; END IF;
 IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR NOT(p_evidence ?& fields) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(p_evidence) x WHERE NOT(x=ANY(fields))) OR
  p_evidence->>'evidenceHash' IS DISTINCT FROM tree_continue_v1.commerce_flat_hash(p_evidence-'evidenceHash') OR
  NOT(p_evidence @> '{"source":"chain-reader","status":"success","finalized":true,"paymentMethod":"tree-transfer-v1","eventIndex":"0"}'::jsonb) THEN RAISE EXCEPTION 'commerce_invalid_evidence'; END IF;
 FOREACH k IN ARRAY ARRAY['network','paymentMethod','orderId','accountId','payer','recipient','coinType','quoteHash'] LOOP
  IF p_evidence->k IS DISTINCT FROM o.terms->k THEN RAISE EXCEPTION 'commerce_receipt_order_mismatch'; END IF;
 END LOOP;
 IF p_evidence->'amountRaw' IS DISTINCT FROM o.terms->'requiredRaw' OR
  p_evidence->>'paymentReference' IS DISTINCT FROM 'TREE_FORCE_CONTINUE_V1:'||(o.terms->>'quoteHash') OR
  p_evidence->>'digest' !~ '^[1-9A-HJ-NP-Za-km-z]{43,44}$' OR
  jsonb_typeof(p_evidence->'checkpoint') IS DISTINCT FROM 'string' OR p_evidence->>'checkpoint' !~ '^(0|[1-9][0-9]{0,19})$' OR
  (p_evidence->>'checkpoint')::numeric>18446744073709551615 OR
  jsonb_typeof(p_evidence->'timestampMs') IS DISTINCT FROM 'number' OR p_evidence->>'timestampMs' !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'commerce_invalid_receipt_fields'; END IF;
 IF (p_evidence->>'timestampMs')::bigint < (o.terms->>'issuedAtMs')::bigint THEN RAISE EXCEPTION 'commerce_receipt_time_mismatch'; END IF;
 -- A whole standard-transfer transaction is one receipt; never vary eventIndex.
 rid:='sui:mainnet:'||(p_evidence->>'digest')||':0';
 IF o.evidence IS NOT NULL THEN
  IF o.evidence IS DISTINCT FROM p_evidence OR o.receipt_id IS DISTINCT FROM rid THEN RAISE EXCEPTION 'commerce_receipt_immutable'; END IF; RETURN;
 END IF;
 INSERT INTO tree_continue_v1.receipts(receipt_id,order_id) VALUES(rid,p_order) ON CONFLICT(receipt_id) DO NOTHING;
 SELECT order_id INTO claimed FROM tree_continue_v1.receipts WHERE receipt_id=rid;
 IF claimed IS DISTINCT FROM p_order THEN RAISE EXCEPTION 'commerce_receipt_already_used'; END IF;
 UPDATE tree_continue_v1.orders SET evidence=p_evidence,receipt_id=rid,state='verified' WHERE order_id=p_order;
END $$;
REVOKE EXECUTE ON FUNCTION tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb),
 tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tree_continue_v1.commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb) TO tree_continue_orders;
GRANT EXECUTE ON FUNCTION tree_continue_v1.commerce_settle(uuid,text,text,text,uuid,uuid,jsonb) TO tree_continue_settlement;

-- Transfer continues restore an owned casual snapshot, never a ranked score.
CREATE OR REPLACE FUNCTION tree_continue_v1.require_validated_checkpoint() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c tree_continue_v1.checkpoints; a tree_continue_v1.accounts;
BEGIN
  SELECT * INTO c FROM tree_continue_v1.checkpoints WHERE account_id=NEW.account_id AND run_id=NEW.run_id;
  SELECT * INTO a FROM tree_continue_v1.accounts WHERE account_id=NEW.account_id;
  IF c.checkpoint_id IS NULL OR a.account_id IS NULL OR
    NEW.terms->>'flightHash' IS DISTINCT FROM c.checkpoint_hash OR
    NEW.terms->>'payer' IS DISTINCT FROM a.payer OR
    (NEW.terms->>'paymentMethod' IS DISTINCT FROM 'tree-transfer-v1' AND NOT EXISTS(SELECT 1 FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id AND outcome='validated')) THEN
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
CREATE OR REPLACE FUNCTION tree_continue_v1.paid_delivery(
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
  (o.terms->>'paymentMethod' IS DISTINCT FROM 'tree-transfer-v1' AND NOT EXISTS(SELECT 1 FROM tree_continue_v1.checkpoint_reviews WHERE checkpoint_id=c.checkpoint_id AND outcome='validated')) THEN
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

COMMIT;
