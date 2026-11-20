-- Execute against an empty Postgres 17 service after this isolated migration.
-- All rows and statements in this test are rolled back.
begin;
do $$
declare
  wallet text := '0x'||repeat('1',40);
  nonce text := repeat('a',64);
  s1 text := repeat('b',64);
  s2 text := repeat('c',64);
  rec jsonb;
begin
  rec:=public.arcade_bnb_test_create_challenge_v1(nonce,wallet,wallet,clock_timestamp(),
    clock_timestamp()+interval '4 minutes 59 seconds',repeat('d',64));
  if rec->>'nonce'<>nonce then raise exception 'challenge creation mismatch'; end if;
  if public.arcade_bnb_test_read_challenge_v1(nonce) is null then raise exception 'missing challenge'; end if;
  rec:=public.arcade_bnb_test_consume_session_v1(nonce,wallet,repeat('d',64),s1,clock_timestamp()+interval '59 minutes');
  if rec->>'authenticated'<>'true' then raise exception 'no session'; end if;
  if public.arcade_bnb_test_consume_session_v1(nonce,wallet,repeat('d',64),s2,clock_timestamp()+interval '59 minutes') is not null then
    raise exception 'replayed nonce accepted'; end if;
  if public.arcade_bnb_test_read_challenge_v1(nonce) is not null then raise exception 'used nonce still readable'; end if;
  if public.arcade_bnb_test_read_session_v1(s1) is null then raise exception 'session unreadable'; end if;
  if not public.arcade_bnb_test_revoke_session_v1(s1) then raise exception 'logout failed'; end if;
  if public.arcade_bnb_test_read_session_v1(s1) is not null then raise exception 'revoked token works'; end if;
end $$;
do $$
declare
 r text; f text;
begin
 foreach r in array array['anon','authenticated'] loop
   foreach f in array array[
     'public.arcade_bnb_test_create_challenge_v1(text,text,text,timestamptz,timestamptz,text)',
     'public.arcade_bnb_test_read_challenge_v1(text)',
     'public.arcade_bnb_test_consume_session_v1(text,text,text,text,timestamptz)',
     'public.arcade_bnb_test_read_session_v1(text)',
     'public.arcade_bnb_test_revoke_session_v1(text)'
   ] loop
     if has_function_privilege(r,f,'EXECUTE') then raise exception 'client role has API access: % %',r,f; end if;
   end loop;
   if has_table_privilege(r,'private.arcade_bnb_test_sessions','SELECT') or
     has_table_privilege(r,'private.arcade_bnb_test_challenges','SELECT') then
     raise exception 'client role has table read access: %',r; end if;
 end loop;
 if not has_function_privilege('service_role','public.arcade_bnb_test_read_session_v1(text)','EXECUTE') then
   raise exception 'service role missing RPC'; end if;
end $$;
rollback;
