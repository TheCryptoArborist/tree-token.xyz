-- REVIEW/STAGING MIGRATION ONLY. Never run automatically during site deploy.
-- Postgres 17+. No public/Supabase API schema or existing tables are modified.
BEGIN;
CREATE SCHEMA canopy_credits_v1;
REVOKE ALL ON SCHEMA canopy_credits_v1 FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='canopy_cc_runtime') THEN CREATE ROLE canopy_cc_runtime NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='canopy_cc_ingest') THEN CREATE ROLE canopy_cc_ingest NOLOGIN; END IF;
END $$;
CREATE TABLE canopy_credits_v1.accounts (
  id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE canopy_credits_v1.skus (
  id text PRIMARY KEY, cost bigint NOT NULL CHECK(cost>0), enabled boolean NOT NULL DEFAULT false,
  recovery_seconds integer NOT NULL CHECK(recovery_seconds BETWEEN 30 AND 600)
);
-- Configuration is intentionally disabled. No activation path is exposed here.
INSERT INTO canopy_credits_v1.skus VALUES ('treeforce89.continue.v1',100,false,90);
CREATE TABLE canopy_credits_v1.orders (
  id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES canopy_credits_v1.accounts,
  terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(id,account_id)
);
CREATE TABLE canopy_credits_v1.journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES canopy_credits_v1.accounts,
  request_id uuid NOT NULL, command jsonb NOT NULL, kind text NOT NULL,
  available bigint NOT NULL DEFAULT 0, held bigint NOT NULL DEFAULT 0,
  spent bigint NOT NULL DEFAULT 0, source bigint NOT NULL DEFAULT 0,
  reverses uuid REFERENCES canopy_credits_v1.journal, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), writer_xid bigint NOT NULL DEFAULT txid_current(),
  UNIQUE(account_id,request_id), UNIQUE(id,account_id),
  CHECK(available::numeric+held+spent+source=0)
);
CREATE TABLE canopy_credits_v1.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES canopy_credits_v1.accounts,
  origin text NOT NULL CHECK(origin IN ('purchase','tree_bonus')), issuance_id uuid NOT NULL,
  total bigint NOT NULL CHECK(total>0), UNIQUE(id,account_id),
  FOREIGN KEY(issuance_id,account_id) REFERENCES canopy_credits_v1.journal(id,account_id)
);
CREATE TABLE canopy_credits_v1.postings (
  operation_id uuid NOT NULL, account_id uuid NOT NULL, lot_id uuid NOT NULL,
  available bigint NOT NULL DEFAULT 0, held bigint NOT NULL DEFAULT 0,
  spent bigint NOT NULL DEFAULT 0, source bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(operation_id,lot_id),
  FOREIGN KEY(operation_id,account_id) REFERENCES canopy_credits_v1.journal(id,account_id),
  FOREIGN KEY(lot_id,account_id) REFERENCES canopy_credits_v1.lots(id,account_id),
  CHECK(available::numeric+held+spent+source=0)
);
CREATE TABLE canopy_credits_v1.receipts (
  order_id uuid PRIMARY KEY, account_id uuid NOT NULL,
  network text NOT NULL CHECK(network='sui:mainnet'), digest text NOT NULL, event_index bigint NOT NULL CHECK(event_index>=0),
  evidence jsonb NOT NULL, issuance_id uuid NOT NULL,
  UNIQUE(network,digest,event_index),
  FOREIGN KEY(order_id,account_id) REFERENCES canopy_credits_v1.orders(id,account_id),
  FOREIGN KEY(issuance_id,account_id) REFERENCES canopy_credits_v1.journal(id,account_id)
);
CREATE TABLE canopy_credits_v1.runs (
  id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES canopy_credits_v1.accounts,
  ruleset text NOT NULL, UNIQUE(id,account_id)
);
CREATE TABLE canopy_credits_v1.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL,
  run_id uuid NOT NULL UNIQUE, sku text NOT NULL REFERENCES canopy_credits_v1.skus,
  amount bigint NOT NULL CHECK(amount>0), reserve_op uuid NOT NULL,
  state text NOT NULL CHECK(state IN ('reserved','committed','delivered','released','refunded')),
  expires_at timestamptz NOT NULL, checkpoint_ref text, commit_op uuid,
  FOREIGN KEY(run_id,account_id) REFERENCES canopy_credits_v1.runs(id,account_id),
  FOREIGN KEY(reserve_op,account_id) REFERENCES canopy_credits_v1.journal(id,account_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(commit_op,account_id) REFERENCES canopy_credits_v1.journal(id,account_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(checkpoint_ref IS NULL OR checkpoint_ref ~ '^[a-f0-9]{64}$')
);
CREATE INDEX cc_postings_account_lot ON canopy_credits_v1.postings(account_id,lot_id);
CREATE INDEX cc_recovery_due ON canopy_credits_v1.reservations(expires_at) WHERE state IN ('reserved','committed');

CREATE FUNCTION canopy_credits_v1.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'cc_immutable_history'; END $$;
CREATE FUNCTION canopy_credits_v1.check_posting() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM canopy_credits_v1.journal WHERE id=NEW.operation_id AND writer_xid=txid_current()) THEN
    RAISE EXCEPTION 'cc_posted_operation_closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cc_posting_open BEFORE INSERT ON canopy_credits_v1.postings FOR EACH ROW EXECUTE FUNCTION canopy_credits_v1.check_posting();
-- Enforce the aggregate/lot accounting at transaction commit, not merely in JS.
CREATE FUNCTION canopy_credits_v1.check_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j canopy_credits_v1.journal; sums record;
BEGIN
  SELECT * INTO j FROM canopy_credits_v1.journal WHERE id=NEW.id;
  SELECT coalesce(sum(available),0) a,coalesce(sum(held),0) h,coalesce(sum(spent),0) s,coalesce(sum(source),0) src
    INTO sums FROM canopy_credits_v1.postings WHERE operation_id=j.id;
  IF (j.available::numeric,j.held::numeric,j.spent::numeric,j.source::numeric) IS DISTINCT FROM (sums.a,sums.h,sums.s,sums.src) THEN
    RAISE EXCEPTION 'cc_posting_mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM canopy_credits_v1.postings WHERE account_id=j.account_id GROUP BY lot_id
    HAVING sum(available)<0 OR sum(held)<0 OR sum(spent)<0 OR sum(source)>0) THEN RAISE EXCEPTION 'cc_negative_lot'; END IF;
  IF EXISTS(SELECT 1 FROM canopy_credits_v1.lots l LEFT JOIN canopy_credits_v1.postings p ON p.lot_id=l.id
    WHERE l.account_id=j.account_id GROUP BY l.id,l.total HAVING -coalesce(sum(p.source),0)<>l.total) THEN RAISE EXCEPTION 'cc_lot_issuance_mismatch'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cc_balanced_operation AFTER INSERT ON canopy_credits_v1.journal DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION canopy_credits_v1.check_operation();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['orders','journal','lots','postings','receipts','runs'] LOOP
    EXECUTE format('CREATE TRIGGER cc_no_mutation BEFORE UPDATE OR DELETE ON canopy_credits_v1.%I FOR EACH ROW EXECUTE FUNCTION canopy_credits_v1.immutable()',t);
    EXECUTE format('CREATE TRIGGER cc_no_truncate BEFORE TRUNCATE ON canopy_credits_v1.%I FOR EACH STATEMENT EXECUTE FUNCTION canopy_credits_v1.immutable()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['accounts','skus','orders','journal','lots','postings','receipts','runs','reservations'] LOOP
    EXECUTE format('ALTER TABLE canopy_credits_v1.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

CREATE FUNCTION canopy_credits_v1.balance(p_account uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('available',coalesce(sum(available),0)::text,'held',coalesce(sum(held),0)::text,
    'spent',coalesce(sum(spent),0)::text,'issued',(-coalesce(sum(source),0))::text)
  FROM canopy_credits_v1.journal WHERE account_id=p_account
$$;
CREATE FUNCTION canopy_credits_v1.lock_account(p_account uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM 1 FROM canopy_credits_v1.accounts WHERE id=p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cc_account_unregistered'; END IF;
END $$;
CREATE FUNCTION canopy_credits_v1.prior(p_account uuid,p_request uuid,p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE j canopy_credits_v1.journal;
BEGIN
  SELECT * INTO j FROM canopy_credits_v1.journal WHERE account_id=p_account AND request_id=p_request;
  IF FOUND THEN
    IF j.command<>p_command THEN RAISE EXCEPTION 'cc_idempotency_conflict'; END IF;
    RETURN j.result;
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION canopy_credits_v1.audit(p_account uuid,p_request uuid,p_command jsonb,p_kind text,p_result jsonb) RETURNS void LANGUAGE sql SET search_path=pg_catalog AS $$
  INSERT INTO canopy_credits_v1.journal(account_id,request_id,command,kind,result) VALUES(p_account,p_request,p_command,p_kind,p_result)
$$;
CREATE FUNCTION canopy_credits_v1.register_account(p_account uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  INSERT INTO canopy_credits_v1.accounts(id) VALUES(p_account) ON CONFLICT DO NOTHING
$$;
CREATE FUNCTION canopy_credits_v1.record_order(p_id uuid,p_account uuid,p_terms jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old canopy_credits_v1.orders;
BEGIN
  PERFORM canopy_credits_v1.lock_account(p_account);
  IF EXISTS(SELECT 1 FROM jsonb_each(p_terms) WHERE value='null'::jsonb) THEN RAISE EXCEPTION 'cc_null_order_field'; END IF;
  IF p_terms->>'network' IS DISTINCT FROM 'sui:mainnet' OR p_terms->>'coinType' IS DISTINCT FROM
    '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE' OR
    p_terms->>'orderId' IS DISTINCT FROM p_id::text OR p_terms->>'accountId' IS DISTINCT FROM p_account::text OR
    NOT(p_terms ?& ARRAY['baseCC','bonusCC','requiredRaw','issuedAtMs','expiresAtMs','payer','recipient','eventType','quoteHash','policyVersion']) THEN RAISE EXCEPTION 'cc_invalid_order'; END IF;
  IF coalesce((p_terms->>'baseCC')::bigint,0)<=0 OR coalesce((p_terms->>'bonusCC')::bigint,-1)<0 OR
    coalesce((p_terms->>'requiredRaw')::numeric,0)<=0 OR (p_terms->>'requiredRaw')::numeric>18446744073709551615 OR
    (p_terms->>'requiredRaw') !~ '^[1-9][0-9]*$' OR
    (p_terms->>'baseCC')::numeric+(p_terms->>'bonusCC')::numeric>9223372036854775807 OR
    (p_terms->>'expiresAtMs')::bigint<=(p_terms->>'issuedAtMs')::bigint OR
    (p_terms->>'expiresAtMs')::bigint-(p_terms->>'issuedAtMs')::bigint>60000 OR
    (p_terms->>'eventType') !~ '^0x[0-9a-f]{64}::checkout::Purchase$' OR
    (p_terms->>'payer') !~ '^0x[0-9a-f]{64}$' OR (p_terms->>'recipient') !~ '^0x[0-9a-f]{64}$' OR
    p_terms->>'payer'=p_terms->>'recipient' OR (p_terms->>'quoteHash') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'cc_invalid_order'; END IF;
  SELECT * INTO old FROM canopy_credits_v1.orders WHERE id=p_id;
  IF FOUND THEN
    IF old.account_id<>p_account OR old.terms<>p_terms THEN RAISE EXCEPTION 'cc_order_conflict'; END IF;
    RETURN;
  END IF;
  INSERT INTO canopy_credits_v1.orders VALUES(p_id,p_account,p_terms,clock_timestamp());
END $$;

-- Only the trusted ingestion role may call this AFTER independent chain verification.
CREATE FUNCTION canopy_credits_v1.credit_receipt(p_account uuid,p_request uuid,p_order uuid,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o canopy_credits_v1.orders; old canopy_credits_v1.receipts; cmd jsonb; answer jsonb; op uuid:=gen_random_uuid();
  base bigint; bonus bigint; lot uuid; stamp bigint; k text;
BEGIN
  PERFORM canopy_credits_v1.lock_account(p_account);
  cmd:=jsonb_build_object('action','credit_receipt','order',p_order,'evidence',p_evidence);
  answer:=canopy_credits_v1.prior(p_account,p_request,cmd); IF answer IS NOT NULL THEN RETURN answer; END IF;
  SELECT * INTO o FROM canopy_credits_v1.orders WHERE id=p_order AND account_id=p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'cc_order_not_found'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_evidence) WHERE value='null'::jsonb) THEN RAISE EXCEPTION 'cc_null_receipt_field'; END IF;
  IF p_evidence->>'status' IS DISTINCT FROM 'success' OR p_evidence->>'source' IS DISTINCT FROM 'chain-reader' OR
    p_evidence->>'finalized' IS DISTINCT FROM 'true' OR NOT(p_evidence ?& ARRAY['checkpoint','digest','eventIndex','amountRaw','timestampMs','evidenceHash']) OR
    (p_evidence->>'checkpoint') !~ '^[0-9]+$' OR (p_evidence->>'eventIndex') !~ '^[0-9]+$' OR
    (p_evidence->>'digest') !~ '^[1-9A-HJ-NP-Za-km-z]{43,44}$' OR (p_evidence->>'evidenceHash') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'cc_unverified_receipt'; END IF;
  FOREACH k IN ARRAY ARRAY['network','coinType','orderId','accountId','payer','recipient','eventType','quoteHash'] LOOP
    IF p_evidence->>k IS DISTINCT FROM o.terms->>k THEN RAISE EXCEPTION 'cc_payment_mismatch_%',k; END IF;
  END LOOP;
  IF p_evidence->>'amountRaw' IS DISTINCT FROM o.terms->>'requiredRaw' THEN RAISE EXCEPTION 'cc_payment_amount_mismatch'; END IF;
  stamp:=(p_evidence->>'timestampMs')::bigint;
  -- Delayed observation is okay; compare chain timestamp to immutable quote window.
  IF stamp<(o.terms->>'issuedAtMs')::bigint OR stamp>(o.terms->>'expiresAtMs')::bigint THEN RAISE EXCEPTION 'cc_payment_outside_window'; END IF;
  SELECT * INTO old FROM canopy_credits_v1.receipts WHERE order_id=p_order;
  IF FOUND THEN
    IF old.evidence<>p_evidence THEN RAISE EXCEPTION 'cc_receipt_conflict'; END IF;
    SELECT result INTO answer FROM canopy_credits_v1.journal WHERE id=old.issuance_id;
    PERFORM canopy_credits_v1.audit(p_account,p_request,cmd,'receipt_replay',answer); RETURN answer;
  END IF;
  base:=(o.terms->>'baseCC')::bigint; bonus:=(o.terms->>'bonusCC')::bigint;
  answer:=jsonb_build_object('operationId',op,'orderId',p_order,'credited',(base+bonus)::text);
  INSERT INTO canopy_credits_v1.journal(id,account_id,request_id,command,kind,available,source,result)
    VALUES(op,p_account,p_request,cmd,'issue',base+bonus,-(base+bonus),answer);
  INSERT INTO canopy_credits_v1.receipts VALUES(p_order,p_account,'sui:mainnet',p_evidence->>'digest',(p_evidence->>'eventIndex')::bigint,p_evidence,op);
  INSERT INTO canopy_credits_v1.lots(account_id,origin,issuance_id,total) VALUES(p_account,'purchase',op,base) RETURNING id INTO lot;
  INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id,available,source) VALUES(op,p_account,lot,base,-base);
  IF bonus>0 THEN
    INSERT INTO canopy_credits_v1.lots(account_id,origin,issuance_id,total) VALUES(p_account,'tree_bonus',op,bonus) RETURNING id INTO lot;
    INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id,available,source) VALUES(op,p_account,lot,bonus,-bonus);
  END IF;
  RETURN answer;
END $$;

CREATE FUNCTION canopy_credits_v1.reverse_hold(p_account uuid,p_res uuid,p_request uuid,p_cmd jsonb,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE r canopy_credits_v1.reservations; op uuid:=gen_random_uuid(); answer jsonb; target text;
BEGIN
  SELECT * INTO r FROM canopy_credits_v1.reservations WHERE id=p_res AND account_id=p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cc_reservation_not_found'; END IF;
  IF r.state='delivered' THEN RAISE EXCEPTION 'cc_delivered_requires_review'; END IF;
  target:=CASE WHEN r.state='committed' THEN 'refunded' WHEN r.state='reserved' THEN 'released' ELSE r.state END;
  answer:=jsonb_build_object('reservationId',r.id,'state',target,'reason',p_reason);
  IF r.state NOT IN ('reserved','committed') THEN
    PERFORM canopy_credits_v1.audit(p_account,p_request,p_cmd,'release_replay',answer); RETURN answer;
  END IF;
  INSERT INTO canopy_credits_v1.journal(id,account_id,request_id,command,kind,available,held,spent,reverses,result)
    VALUES(op,p_account,p_request,p_cmd,target,r.amount,CASE WHEN r.state='reserved' THEN -r.amount ELSE 0 END,
      CASE WHEN r.state='committed' THEN -r.amount ELSE 0 END,coalesce(r.commit_op,r.reserve_op),answer);
  INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id,available,held,spent)
    SELECT op,p_account,lot_id,-available,CASE WHEN r.state='reserved' THEN available ELSE 0 END,
      CASE WHEN r.state='committed' THEN available ELSE 0 END FROM canopy_credits_v1.postings WHERE operation_id=r.reserve_op;
  UPDATE canopy_credits_v1.reservations SET state=target WHERE id=r.id;
  RETURN answer;
END $$;
CREATE FUNCTION canopy_credits_v1.sweep(p_account uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM canopy_credits_v1.reservations WHERE account_id=p_account AND state IN ('reserved','committed') AND expires_at<=clock_timestamp() FOR UPDATE LOOP
    PERFORM canopy_credits_v1.reverse_hold(p_account,r.id,gen_random_uuid(),jsonb_build_object('action','expire','reservationId',r.id),'delivery_timeout');
  END LOOP;
END $$;
CREATE FUNCTION canopy_credits_v1.execute(p_account uuid,p_request uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE action text:=p_command->>'action'; answer jsonb; r canopy_credits_v1.reservations; sku canopy_credits_v1.skus;
  op uuid:=gen_random_uuid(); rid uuid; left_cc bigint; used bigint; l record; old_run canopy_credits_v1.runs; checkpoint text;
BEGIN
  PERFORM canopy_credits_v1.lock_account(p_account);
  answer:=canopy_credits_v1.prior(p_account,p_request,p_command); IF answer IS NOT NULL THEN RETURN answer; END IF;
  PERFORM canopy_credits_v1.sweep(p_account);
  IF action='open_run' THEN
    rid:=(p_command->>'runId')::uuid;
    IF nullif(p_command->>'ruleset','') IS NULL THEN RAISE EXCEPTION 'cc_ruleset_required'; END IF;
    SELECT * INTO old_run FROM canopy_credits_v1.runs WHERE id=rid;
    IF FOUND AND (old_run.account_id<>p_account OR old_run.ruleset<>p_command->>'ruleset') THEN RAISE EXCEPTION 'cc_run_conflict'; END IF;
    INSERT INTO canopy_credits_v1.runs VALUES(rid,p_account,p_command->>'ruleset') ON CONFLICT DO NOTHING;
    SELECT * INTO old_run FROM canopy_credits_v1.runs WHERE id=rid;
    IF old_run.account_id<>p_account OR old_run.ruleset<>p_command->>'ruleset' THEN RAISE EXCEPTION 'cc_run_conflict'; END IF;
    answer:=jsonb_build_object('runId',rid);
  ELSIF action='recover' THEN
    SELECT * INTO r FROM canopy_credits_v1.reservations WHERE run_id=(p_command->>'runId')::uuid AND account_id=p_account;
    answer:=jsonb_build_object('reservation',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'state',r.state,'checkpointRef',r.checkpoint_ref,
      'requiresReview',r.state='delivered') END,'balance',canopy_credits_v1.balance(p_account));
  ELSIF action='reserve' THEN
    rid:=(p_command->>'runId')::uuid;
    IF NOT EXISTS(SELECT 1 FROM canopy_credits_v1.runs WHERE id=rid AND account_id=p_account) THEN RAISE EXCEPTION 'cc_run_not_found'; END IF;
    SELECT * INTO r FROM canopy_credits_v1.reservations WHERE run_id=rid;
    IF FOUND THEN
      IF r.sku IS DISTINCT FROM p_command->>'sku' THEN RAISE EXCEPTION 'cc_sku_conflict'; END IF;
      answer:=jsonb_build_object('reservationId',r.id,'state',r.state,'amount',r.amount::text);
    ELSE
      SELECT * INTO sku FROM canopy_credits_v1.skus WHERE id=p_command->>'sku' AND enabled;
      IF NOT FOUND THEN RAISE EXCEPTION 'cc_sku_disabled'; END IF;
      IF (canopy_credits_v1.balance(p_account)->>'available')::numeric<sku.cost THEN RAISE EXCEPTION 'cc_insufficient_credits'; END IF;
      r.id:=gen_random_uuid();
      answer:=jsonb_build_object('reservationId',r.id,'state','reserved','amount',sku.cost::text);
      INSERT INTO canopy_credits_v1.journal(id,account_id,request_id,command,kind,available,held,result)
        VALUES(op,p_account,p_request,p_command,'reserve',-sku.cost,sku.cost,answer);
      left_cc:=sku.cost;
      FOR l IN SELECT lots.id,sum(p.available)::bigint remaining FROM canopy_credits_v1.lots lots
        JOIN canopy_credits_v1.postings p ON p.lot_id=lots.id JOIN canopy_credits_v1.journal j ON j.id=lots.issuance_id
        WHERE lots.account_id=p_account GROUP BY lots.id,j.created_at,lots.origin
        HAVING sum(p.available)>0 ORDER BY j.created_at,CASE lots.origin WHEN 'purchase' THEN 0 ELSE 1 END,lots.id LOOP
        used:=least(l.remaining,left_cc);
        INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id,available,held) VALUES(op,p_account,l.id,-used,used);
        left_cc:=left_cc-used; EXIT WHEN left_cc=0;
      END LOOP;
      IF left_cc<>0 THEN RAISE EXCEPTION 'cc_fifo_mismatch'; END IF;
      INSERT INTO canopy_credits_v1.reservations(id,account_id,run_id,sku,amount,reserve_op,state,expires_at)
        VALUES(r.id,p_account,rid,sku.id,sku.cost,op,'reserved',clock_timestamp()+make_interval(secs=>sku.recovery_seconds));
      RETURN answer;
    END IF;
  ELSIF action IN ('commit','deliver','release') THEN
    SELECT * INTO r FROM canopy_credits_v1.reservations WHERE id=(p_command->>'reservationId')::uuid AND account_id=p_account FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'cc_reservation_not_found'; END IF;
    IF action='release' THEN RETURN canopy_credits_v1.reverse_hold(p_account,r.id,p_request,p_command,'server_confirmed_undelivered'); END IF;
    IF action='commit' THEN
      checkpoint:=p_command->>'checkpointRef';
      IF checkpoint IS NULL OR checkpoint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'cc_checkpoint_required'; END IF;
      IF r.state='reserved' THEN
        answer:=jsonb_build_object('reservationId',r.id,'state','committed','checkpointRef',checkpoint);
        INSERT INTO canopy_credits_v1.journal(id,account_id,request_id,command,kind,held,spent,result)
          VALUES(op,p_account,p_request,p_command,'commit',-r.amount,r.amount,answer);
        INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id,held,spent)
          SELECT op,p_account,lot_id,-held,held FROM canopy_credits_v1.postings WHERE operation_id=r.reserve_op;
        UPDATE canopy_credits_v1.reservations SET state='committed',checkpoint_ref=checkpoint,commit_op=op,
          expires_at=clock_timestamp()+make_interval(secs=>(SELECT recovery_seconds FROM canopy_credits_v1.skus WHERE id=r.sku)) WHERE id=r.id;
        RETURN answer;
      END IF;
      IF r.state NOT IN ('committed','delivered') OR r.checkpoint_ref IS DISTINCT FROM checkpoint THEN RAISE EXCEPTION 'cc_commit_conflict'; END IF;
    ELSE
      IF r.state NOT IN ('committed','delivered') THEN RAISE EXCEPTION 'cc_not_committed'; END IF;
      IF r.checkpoint_ref IS DISTINCT FROM p_command->>'checkpointRef' THEN RAISE EXCEPTION 'cc_checkpoint_mismatch'; END IF;
      UPDATE canopy_credits_v1.reservations SET state='delivered' WHERE id=r.id; r.state:='delivered';
    END IF;
    answer:=jsonb_build_object('reservationId',r.id,'state',r.state,'checkpointRef',r.checkpoint_ref);
  ELSE RAISE EXCEPTION 'cc_unknown_action'; END IF;
  PERFORM canopy_credits_v1.audit(p_account,p_request,p_command,action,answer); RETURN answer;
END $$;

CREATE FUNCTION canopy_credits_v1.get_order(p_account uuid,p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT terms FROM canopy_credits_v1.orders WHERE id=p_id AND account_id=p_account
$$;

-- No direct browser/table access; narrowly scoped internal roles only.
REVOKE ALL ON ALL TABLES IN SCHEMA canopy_credits_v1 FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA canopy_credits_v1 FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA canopy_credits_v1 FROM PUBLIC;
GRANT USAGE ON SCHEMA canopy_credits_v1 TO canopy_cc_runtime,canopy_cc_ingest;
GRANT EXECUTE ON FUNCTION canopy_credits_v1.balance(uuid),canopy_credits_v1.execute(uuid,uuid,jsonb) TO canopy_cc_runtime;
GRANT EXECUTE ON FUNCTION canopy_credits_v1.register_account(uuid),canopy_credits_v1.record_order(uuid,uuid,jsonb),canopy_credits_v1.credit_receipt(uuid,uuid,uuid,jsonb),canopy_credits_v1.get_order(uuid,uuid),canopy_credits_v1.balance(uuid) TO canopy_cc_ingest;
COMMIT;
