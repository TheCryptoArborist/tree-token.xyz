-- Hosted disabled-checkout lookup only. No financial role is granted to the platform role.
CREATE TABLE tree_continue_v1.preview_lookup_limits (
 account_id uuid PRIMARY KEY, window_start timestamptz NOT NULL,
 requests integer NOT NULL CHECK (requests BETWEEN 1 AND 60)
);
ALTER TABLE tree_continue_v1.preview_lookup_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tree_continue_v1.preview_lookup_limits FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.tree_continue_preview_lookup(
 p_account uuid, p_payer text, p_action text, p_run uuid DEFAULT NULL, p_after uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; started timestamptz; value jsonb;
BEGIN
 IF p_account IS NULL OR p_payer IS NULL OR p_payer !~ '^0x[0-9a-f]{64}$' OR p_payer='0x'||repeat('0',64) OR
   p_action IS NULL OR p_action NOT IN ('status','list_purchases','recover_purchase') OR
   (p_action='recover_purchase' AND (p_run IS NULL OR p_after IS NOT NULL)) OR
   (p_action='list_purchases' AND p_run IS NOT NULL) OR
   (p_action='status' AND (p_run IS NOT NULL OR p_after IS NOT NULL)) THEN
   RAISE EXCEPTION 'invalid_preview_lookup';
 END IF;
 -- Called only after issuer-side opaque-session verification in the Edge Function.
 PERFORM pg_advisory_xact_lock(hashtextextended('tree-continue-preview-lookup-quota',0));
 SELECT requests,window_start INTO n,started FROM tree_continue_v1.preview_lookup_limits WHERE account_id=p_account FOR UPDATE;
 IF NOT FOUND THEN
  IF (SELECT count(*) FROM tree_continue_v1.preview_lookup_limits)>=1024 THEN RETURN jsonb_build_object('allowed',false); END IF;
  INSERT INTO tree_continue_v1.preview_lookup_limits VALUES(p_account,clock_timestamp(),1);
 ELSIF started < clock_timestamp()-interval '1 minute' THEN
  UPDATE tree_continue_v1.preview_lookup_limits SET requests=1,window_start=clock_timestamp() WHERE account_id=p_account;
 ELSE
  IF n>=60 THEN RETURN jsonb_build_object('allowed',false); END IF;
  UPDATE tree_continue_v1.preview_lookup_limits SET requests=requests+1 WHERE account_id=p_account;
 END IF;
 IF p_action='status' THEN RETURN jsonb_build_object('allowed',true,'result',NULL); END IF;
 value := tree_continue_v1.lookup_purchases(p_account,p_payer,
   'https://deploy-preview-48--tree-token.netlify.app','release-candidate',p_run,p_after);
 RETURN jsonb_build_object('allowed',true,'result',value);
END $$;
REVOKE ALL ON FUNCTION public.tree_continue_preview_lookup(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tree_continue_preview_lookup(uuid,text,text,uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.tree_continue_preview_lookup(uuid,text,text,uuid,uuid) IS
 'Pinned release-candidate purchase lookup after custom TREE session verification. No receipt, checkpoint approval, order or delivery writes; no financial role membership.';
