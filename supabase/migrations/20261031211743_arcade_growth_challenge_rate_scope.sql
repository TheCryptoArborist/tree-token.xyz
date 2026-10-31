-- A caller must not be able to exhaust another wallet's sign-in quota from a
-- different IP. The low limit is scoped to the wallet and keyed request
-- fingerprint pair. The independent 40-per-fingerprint limit remains intact.
-- Replace only this new Daily Growth RPC; keep the applied initial migration
-- and every unrelated object unchanged. Security remains invoker/service-only.
create or replace function public.arcade_growth_create_challenge_v1(p_challenge_id uuid,p_wallet text,p_origin text,p_date_key date,
  p_nonce_sha256 text,p_message text,p_expires_at timestamptz,p_request_fingerprint text)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_date_key <> (v_now at time zone 'UTC')::date or p_date_key is null then raise exception 'arcade-growth-day-changed'; end if;
  if p_expires_at <= v_now or p_expires_at > v_now + interval '5 minutes 5 seconds' then raise exception 'arcade-growth-invalid-challenge'; end if;
  -- Serialize the two rate counters; store only a domain-separated keyed IP hash.
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:challenge:fingerprint:' || p_request_fingerprint,0));
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:challenge:wallet-fingerprint:' || p_wallet || ':' || p_request_fingerprint,0));
  if (select count(*) from private.arcade_growth_wallet_challenges where wallet=p_wallet and request_fingerprint=p_request_fingerprint and issued_at>v_now-interval '10 minutes') >= 6
    or (select count(*) from private.arcade_growth_wallet_challenges where request_fingerprint=p_request_fingerprint and issued_at>v_now-interval '10 minutes') >= 40 then
    raise exception 'arcade-growth-rate-limited';
  end if;
  insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,issued_at,expires_at)
    values(p_challenge_id,p_wallet,p_origin,p_date_key,p_nonce_sha256,p_message,p_request_fingerprint,v_now,p_expires_at);
  return jsonb_build_object('challengeId',p_challenge_id,'wallet',p_wallet,'origin',p_origin,'dateKey',to_char(p_date_key,'YYYY-MM-DD'),
    'message',p_message,'expiresAt',p_expires_at,'consumed',false);
end $$;

revoke all on function public.arcade_growth_create_challenge_v1(uuid,text,text,date,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.arcade_growth_create_challenge_v1(uuid,text,text,date,text,text,timestamptz,text) to service_role;
