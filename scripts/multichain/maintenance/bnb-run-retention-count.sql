-- Administrator preflight only. No user rows or identifiers returned.
select count(*) as expired_over_seven_days
from private.arcade_bnb_run_reviews
where expires_at < statement_timestamp() - interval '7 days';
