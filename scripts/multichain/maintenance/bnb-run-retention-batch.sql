-- ADMINISTRATOR ONLY, explicit maintenance action. Never run by the web handler.
-- Execute the count query first. At most 1000 expired rows per invocation.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';
with candidates as (
 select hash from private.arcade_bnb_run_reviews
 where expires_at < statement_timestamp() - interval '7 days'
 order by expires_at,hash
 limit 1000 for update skip locked
), deleted as (
 delete from private.arcade_bnb_run_reviews r using candidates c
 where r.hash=c.hash
 returning 1
)
select count(*) as deleted_expired_reviews from deleted;
commit;
