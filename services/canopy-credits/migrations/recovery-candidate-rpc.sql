-- Recovery preview only. No payment, checkpoint attestation or receipt writes.
-- Keep the private schema inaccessible to public API roles. Expose ONE backend-only wrapper.
CREATE TABLE tree_continue_v1.candidate_limits (
 account_id uuid PRIMARY KEY, window_start timestamptz NOT NULL, requests integer NOT NULL CHECK(requests BETWEEN 1 AND 60)
);
ALTER TABLE tree_continue_v1.candidate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tree_continue_v1.candidate_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.tree_recovery_candidate_rpc(
 p_account uuid,p_payer text,p_action text,p_run uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_snapshot text DEFAULT NULL,p_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a tree_continue_v1.accounts; n integer; b timestamptz; result jsonb;
 origin constant text:='https://deploy-preview-48--tree-token.netlify.app';
 environment constant text:='release-candidate';
BEGIN
 IF p_account IS NULL OR p_payer IS NULL OR p_payer !~ '^0x[0-9a-f]{64}$' OR p_payer='0x'||repeat('0',64)
   OR p_action IS NULL OR p_action NOT IN ('list','save','recover') THEN RAISE EXCEPTION 'invalid_candidate_request'; END IF;
 -- Serialize quota admission only. No external network calls occur inside this transaction.
 PERFORM pg_advisory_xact_lock(hashtextextended('tree-recovery-candidate-quota',0));
 SELECT * INTO a FROM tree_continue_v1.accounts WHERE account_id=p_account;
 IF FOUND AND (a.payer<>p_payer OR a.auth_origin<>origin OR a.environment<>environment) THEN RAISE EXCEPTION 'candidate_identity_mismatch'; END IF;
 SELECT requests,window_start INTO n,b FROM tree_continue_v1.candidate_limits WHERE account_id=p_account FOR UPDATE;
 IF NOT FOUND THEN
   IF (SELECT count(*) FROM tree_continue_v1.candidate_limits)>=256 THEN RAISE EXCEPTION 'candidate_capacity'; END IF;
   INSERT INTO tree_continue_v1.candidate_limits VALUES(p_account,clock_timestamp(),1);
 ELSIF b < clock_timestamp()-interval '1 minute' THEN
   UPDATE tree_continue_v1.candidate_limits SET requests=1,window_start=clock_timestamp() WHERE account_id=p_account;
 ELSE
   IF n>=60 THEN RAISE EXCEPTION 'candidate_rate_limit'; END IF;
   UPDATE tree_continue_v1.candidate_limits SET requests=requests+1 WHERE account_id=p_account;
 END IF;
 IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(x.info ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
    SELECT c.created_at,jsonb_build_object('runId',c.run_id,'wave',c.snapshot_text::jsonb->'wave','score',c.snapshot_text::jsonb->'score','purchaseState',o.state) info
    FROM tree_continue_v1.checkpoints c LEFT JOIN tree_continue_v1.orders o ON o.account_id=c.account_id AND o.run_id=c.run_id
    WHERE c.account_id=p_account ORDER BY c.created_at DESC LIMIT 16
   ) x;
   RETURN jsonb_build_object('flights',result,'paymentsEnabled',false,'restoreAuthorized',false);
 END IF;
 IF p_run IS NULL THEN RAISE EXCEPTION 'candidate_run_required'; END IF;
 IF p_action='recover' THEN RETURN tree_continue_v1.read_recovery(p_account,p_payer,origin,environment,p_run); END IF;
 IF p_request IS NULL OR p_snapshot IS NULL OR p_hash IS NULL OR octet_length(p_snapshot)>262144 OR
   p_snapshot::jsonb->'scene'->>'codec' IS DISTINCT FROM 'formation-recovery.v1' THEN RAISE EXCEPTION 'candidate_snapshot_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.flights WHERE account_id=p_account AND run_id=p_run) AND
   (SELECT count(*) FROM tree_continue_v1.flights WHERE account_id=p_account)>=16 THEN RAISE EXCEPTION 'candidate_flight_limit'; END IF;
 PERFORM tree_continue_v1.register_flight(p_account,p_payer,origin,environment,p_run);
 result:=tree_continue_v1.store_checkpoint(p_account,p_payer,origin,environment,p_run,p_request,p_snapshot,p_hash);
 RETURN result||jsonb_build_object('paymentsEnabled',false,'restoreAuthorized',false);
END $$;
REVOKE ALL ON FUNCTION public.tree_recovery_candidate_rpc(uuid,text,text,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tree_recovery_candidate_rpc(uuid,text,text,uuid,uuid,text,text) TO service_role;
COMMENT ON FUNCTION public.tree_recovery_candidate_rpc(uuid,text,text,uuid,uuid,text,text) IS 'Recovery preview storage ONLY. Called by an Edge Function after central TREE session verification; no paid entitlement, attestation, receipt or token transfer.';
