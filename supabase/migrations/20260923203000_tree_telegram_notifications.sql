-- Additive, disabled by default. Polls verified records without changing the
-- purchase verifier, Challenge procedures, or their transaction paths.
begin;

create table private.tree_telegram_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  activated_at timestamptz,
  chat_id text check (chat_id ~ '^-[0-9]{1,16}$'),
  thread_id integer check (thread_id > 0),
  next_send_at timestamptz not null default now(),
  check (not enabled or (activated_at is not null and chat_id is not null))
);
insert into private.tree_telegram_settings (singleton) values (true);

create table private.tree_telegram_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('qualifying_buy', 'challenge_completed')),
  source_id text not null,
  round_id text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  expires_at timestamptz not null,
  state text not null default 'pending'
    check (state in ('pending', 'sending', 'sent', 'uncertain', 'failed', 'skipped')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  chat_id text,
  thread_id integer,
  message_id bigint,
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (kind, source_id, round_id)
);
create index tree_telegram_pending_idx on private.tree_telegram_outbox (available_at, occurred_at, id)
  where state = 'pending';
alter table private.tree_telegram_settings enable row level security;
alter table private.tree_telegram_outbox enable row level security;
revoke all on private.tree_telegram_settings, private.tree_telegram_outbox from public, anon, authenticated;
revoke all on sequence private.tree_telegram_outbox_id_seq from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.tree_telegram_settings, private.tree_telegram_outbox to service_role;
grant usage, select on sequence private.tree_telegram_outbox_id_seq to service_role;

-- Only the source columns needed for notifications; no answers, scores, tokens,
-- or request fingerprints are granted or returned by these functions.
grant select (tx_digest, buyer, tree_amount_raw, qualifying_usd_cents, qualifies, finalized_at)
  on private.tree_raffle_verified_buys to service_role;
grant select (round_id, state, minimum_qualifying_usd_cents, purchase_window_opens_at,
  purchase_window_closes_at, challenge_opens_at, challenge_closes_at)
  on private.tree_knowledge_trial_rounds to service_role;
grant select (attempt_id, round_id, wallet, submitted_at, disqualified)
  on private.tree_knowledge_trial_attempts to service_role;

create function public.claim_tree_telegram_notification_v1(p_chat_id text, p_thread_id integer default null)
returns jsonb language plpgsql security invoker
set search_path = '' set statement_timeout = '5s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_settings private.tree_telegram_settings%rowtype;
  v_event private.tree_telegram_outbox%rowtype;
begin
  select * into v_settings from private.tree_telegram_settings where singleton for update;
  if not found or not v_settings.enabled then return jsonb_build_object('status','disabled'); end if;
  if p_chat_id is distinct from v_settings.chat_id or p_thread_id is distinct from v_settings.thread_id then
    raise exception 'Notification destination does not match the activated destination.';
  end if;

  -- A process might die after Telegram accepted the message. Never auto-replay
  -- expired leases: Telegram cannot guarantee idempotency for sendMessage.
  update private.tree_telegram_outbox set state='uncertain', error_code='worker-lease-expired'
    where state='sending' and lease_expires_at <= v_now;
  if exists (select 1 from private.tree_telegram_outbox where state='sending') then
    return jsonb_build_object('status','busy');
  end if;
  if v_settings.next_send_at > v_now then return jsonb_build_object('status','throttled'); end if;

  insert into private.tree_telegram_outbox (kind,source_id,round_id,payload,occurred_at,expires_at)
  select 'qualifying_buy', b.tx_digest, r.round_id,
    jsonb_build_object('wallet',b.buyer,'roundId',r.round_id,'txDigest',b.tx_digest,
      'treeAmountRaw',b.tree_amount_raw::text,'qualifyingUsdCents',b.qualifying_usd_cents::text),
    b.finalized_at, least(r.challenge_closes_at,b.finalized_at + interval '24 hours')
  from private.tree_raffle_verified_buys b join private.tree_knowledge_trial_rounds r
    on b.finalized_at >= r.purchase_window_opens_at and b.finalized_at < r.purchase_window_closes_at
  where b.qualifies and b.qualifying_usd_cents >= r.minimum_qualifying_usd_cents
    and b.finalized_at >= v_settings.activated_at and b.finalized_at >= v_now - interval '24 hours'
    and b.finalized_at <= v_now
    and r.state='open' and v_now >= r.challenge_opens_at and v_now < r.challenge_closes_at
    and not exists (select 1 from private.tree_telegram_outbox o
      where o.kind='qualifying_buy' and o.source_id=b.tx_digest and o.round_id=r.round_id)
  order by b.finalized_at,b.tx_digest,r.round_id limit 100
  on conflict (kind,source_id,round_id) do nothing;

  insert into private.tree_telegram_outbox (kind,source_id,round_id,payload,occurred_at,expires_at)
  select 'challenge_completed',a.attempt_id::text,a.round_id,
    jsonb_build_object('wallet',a.wallet,'roundId',a.round_id),
    a.submitted_at,a.submitted_at + interval '24 hours'
  from private.tree_knowledge_trial_attempts a join private.tree_knowledge_trial_rounds r using (round_id)
  where a.submitted_at >= v_settings.activated_at and a.submitted_at >= v_now - interval '24 hours'
    and a.submitted_at <= v_now and not a.disqualified
    and r.state in ('open','closed','tiebreak','scored','awarded')
    and not exists (select 1 from private.tree_telegram_outbox o
      where o.kind='challenge_completed' and o.source_id=a.attempt_id::text and o.round_id=a.round_id)
  order by a.submitted_at,a.attempt_id limit 100
  on conflict (kind,source_id,round_id) do nothing;

  -- Recheck queued events after delays, round closure, or disqualification.
  update private.tree_telegram_outbox o set state='skipped',error_code='no-longer-eligible'
  where o.state='pending' and (
    o.expires_at <= v_now
    or o.occurred_at < v_settings.activated_at
    or (o.chat_id is not null and (o.chat_id is distinct from p_chat_id or o.thread_id is distinct from p_thread_id))
    or (o.kind='qualifying_buy' and not exists (
      select 1 from private.tree_raffle_verified_buys b join private.tree_knowledge_trial_rounds r on r.round_id=o.round_id
      where b.tx_digest=o.source_id and b.qualifies and b.qualifying_usd_cents >= r.minimum_qualifying_usd_cents
        and b.finalized_at >= r.purchase_window_opens_at and b.finalized_at < r.purchase_window_closes_at
        and r.state='open' and v_now >= r.challenge_opens_at and v_now < r.challenge_closes_at))
    or (o.kind='challenge_completed' and not exists (
      select 1 from private.tree_knowledge_trial_attempts a join private.tree_knowledge_trial_rounds r using (round_id)
      where a.attempt_id::text=o.source_id and a.round_id=o.round_id and a.submitted_at is not null and not a.disqualified
        and r.state in ('open','closed','tiebreak','scored','awarded')))
  );

  select * into v_event from private.tree_telegram_outbox
    where state='pending' and available_at <= v_now order by occurred_at,id limit 1 for update skip locked;
  if not found then return jsonb_build_object('status','idle'); end if;
  update private.tree_telegram_outbox set state='sending',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_expires_at=v_now+interval '2 minutes',chat_id=p_chat_id,thread_id=p_thread_id
    where id=v_event.id returning * into v_event;
  update private.tree_telegram_settings set next_send_at=v_now+interval '4 seconds' where singleton;
  return jsonb_build_object('status','claimed','event',jsonb_build_object(
    'id',v_event.id::text,'kind',v_event.kind,'payload',v_event.payload,'leaseToken',v_event.lease_token));
end;
$$;

create function public.settle_tree_telegram_notification_v1(
  p_id bigint,p_lease_token uuid,p_status text,p_message_id bigint default null,
  p_retry_after integer default 0,p_error_code text default null
)
returns jsonb language plpgsql security invoker
set search_path = '' set statement_timeout = '5s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_event private.tree_telegram_outbox%rowtype;
begin
  if p_status is null or p_status not in ('sent','retry','failed','uncertain')
    or (p_status='sent' and (p_message_id is null or p_message_id <= 0))
    or p_retry_after is null or p_retry_after < 0 or p_retry_after > 604800
    or (p_error_code is not null and p_error_code !~ '^[a-z-]{1,64}$') then
    raise exception 'Invalid notification settlement.';
  end if;
  -- Consistent lock order with claim. A lease token fences stale workers.
  perform 1 from private.tree_telegram_settings where singleton for update;
  select * into v_event from private.tree_telegram_outbox where id=p_id for update;
  if not found or v_event.state <> 'sending' or v_event.lease_token is distinct from p_lease_token then
    return jsonb_build_object('status','stale');
  end if;
  update private.tree_telegram_outbox set
    state=case when p_status='retry' then 'pending' else p_status end,
    available_at=case when p_status='retry' then v_now + make_interval(secs=>greatest(p_retry_after,4)) else available_at end,
    message_id=p_message_id,error_code=p_error_code,
    sent_at=case when p_status='sent' then v_now else null end,
    lease_expires_at=null
  where id=p_id;
  if p_status='retry' then
    update private.tree_telegram_settings set next_send_at=greatest(next_send_at,
      v_now + make_interval(secs=>greatest(p_retry_after,4))) where singleton;
  elsif p_status='failed' then
    update private.tree_telegram_settings set enabled=false where singleton;
  end if;
  return jsonb_build_object('status','recorded');
end;
$$;

revoke all on function public.claim_tree_telegram_notification_v1(text,integer) from public,anon,authenticated;
revoke all on function public.settle_tree_telegram_notification_v1(bigint,uuid,text,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.claim_tree_telegram_notification_v1(text,integer) to service_role;
grant execute on function public.settle_tree_telegram_notification_v1(bigint,uuid,text,bigint,integer,text) to service_role;

commit;
