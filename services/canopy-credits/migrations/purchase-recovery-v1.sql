-- Apply after flight-storage-v1.sql in an explicitly reviewed runtime.
-- Recovery lookup and scan throttling only: no receipt or delivery authority.
CREATE TABLE tree_continue_v1.receipt_scan_attempts (
  order_id uuid PRIMARY KEY REFERENCES tree_continue_v1.orders(order_id),
  last_attempt timestamptz NOT NULL
);
ALTER TABLE tree_continue_v1.receipt_scan_attempts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION tree_continue_v1.lookup_purchases(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid DEFAULT NULL,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; cursor_time timestamptz;
BEGIN
  IF p_account IS NULL OR p_payer IS NULL OR p_origin IS NULL OR p_environment IS NULL THEN RAISE EXCEPTION 'purchase_identity_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.accounts WHERE account_id=p_account AND payer=p_payer AND auth_origin=p_origin AND environment=p_environment) THEN
    RETURN CASE WHEN p_run IS NULL THEN jsonb_build_object('rows','[]'::jsonb,'hasMore',false) ELSE jsonb_build_object('record',NULL) END;
  END IF;
  IF p_run IS NOT NULL THEN
    SELECT jsonb_build_object('terms',o.terms,'state',o.state,'hasEvidence',o.evidence IS NOT NULL) INTO result
    FROM tree_continue_v1.orders o WHERE o.account_id=p_account AND o.run_id=p_run;
    RETURN jsonb_build_object('record',result);
  END IF;
  IF p_after IS NOT NULL THEN
    SELECT created_at INTO cursor_time FROM tree_continue_v1.orders WHERE account_id=p_account AND order_id=p_after;
    IF cursor_time IS NULL THEN RAISE EXCEPTION 'invalid_purchase_cursor'; END IF;
  END IF;
  WITH page AS (
    SELECT o.order_id,o.run_id,o.state,o.created_at,c.snapshot_text::jsonb->'wave' AS wave,c.snapshot_text::jsonb->'score' AS score
    FROM tree_continue_v1.orders o JOIN tree_continue_v1.checkpoints c USING(account_id,run_id)
    WHERE o.account_id=p_account AND (p_after IS NULL OR (o.created_at,o.order_id)<(cursor_time,p_after))
    ORDER BY o.created_at DESC,o.order_id DESC LIMIT 26
  ), numbered AS (SELECT *,row_number() OVER(ORDER BY created_at DESC,order_id DESC) n FROM page)
  SELECT jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('orderId',order_id,'runId',run_id,'state',state,'wave',wave,'score',score) ORDER BY n) FILTER(WHERE n<=25),'[]'::jsonb),'hasMore',count(*)>25) INTO result FROM numbered;
  RETURN result;
END $$;
CREATE FUNCTION tree_continue_v1.reserve_receipt_scan(p_account uuid,p_payer text,p_origin text,p_environment text,p_run uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE found_order uuid; claimed uuid;
BEGIN
  PERFORM tree_continue_v1.assert_binding(p_account,p_payer,p_origin,p_environment);
  SELECT order_id INTO found_order FROM tree_continue_v1.orders WHERE account_id=p_account AND run_id=p_run AND evidence IS NULL;
  IF found_order IS NULL THEN RETURN false; END IF;
  INSERT INTO tree_continue_v1.receipt_scan_attempts(order_id,last_attempt) VALUES(found_order,clock_timestamp())
  ON CONFLICT(order_id) DO UPDATE SET last_attempt=EXCLUDED.last_attempt
  WHERE tree_continue_v1.receipt_scan_attempts.last_attempt<clock_timestamp()-interval '10 seconds'
  RETURNING order_id INTO claimed;
  RETURN claimed IS NOT NULL;
END $$;
CREATE ROLE tree_continue_recovery NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE ALL ON tree_continue_v1.receipt_scan_attempts FROM PUBLIC;
REVOKE ALL ON FUNCTION tree_continue_v1.lookup_purchases(uuid,text,text,text,uuid,uuid),tree_continue_v1.reserve_receipt_scan(uuid,text,text,text,uuid) FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','tree_continue_storage','tree_continue_delivery'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON tree_continue_v1.receipt_scan_attempts FROM %I',r);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION tree_continue_v1.lookup_purchases(uuid,text,text,text,uuid,uuid),tree_continue_v1.reserve_receipt_scan(uuid,text,text,text,uuid) FROM %I',r);
    END IF;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA tree_continue_v1 TO tree_continue_recovery;
GRANT EXECUTE ON FUNCTION tree_continue_v1.lookup_purchases(uuid,text,text,text,uuid,uuid),tree_continue_v1.reserve_receipt_scan(uuid,text,text,text,uuid) TO tree_continue_recovery;
-- No logins, membership, public RPC, browser policy, financial writer or keys.
