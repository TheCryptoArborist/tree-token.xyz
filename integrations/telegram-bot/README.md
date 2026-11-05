# TREE Telegram bot — first version

One Telegram identity announces verified qualifying TREE purchases and completed
Knowledge Trial attempts. Completion messages never include answers, scores,
completion times, or secret attempt tokens. Practice attempts are not announced.
Winner posts, standings commands, SuiNS resolution, and images are future work.

## Current state

Implemented and tested locally. No bot account has been registered, no Telegram
message has been sent, the migration has not been applied to production, and the
worker has not been deployed. Both environment and database switches default off.
The existing production website and all its function packages are unchanged.

## Event source and delivery

The bot polls the existing verified-purchase ledger and completed-attempt records.
It never decides whether an arbitrary wallet transfer is a buy or accepts events
from a browser. The existing purchase verifier/keeper must first record the buy.
No source-table trigger, purchase function, Challenge function, or scoring rule is
modified. Source schema and qualification procedures were inspected read-only on
the connected production database on September 23, 2026.

Qualifying-buy messages require the ledger's qualification flag, the active
round's minimum purchase amount, its purchase window, and an open Challenge.
Qualifying again does not grant another attempt, entry, ticket, or reward.
The round's stored rules are used instead of a separate hardcoded $5 eligibility
test. The message validator additionally rejects values below the Challenge's
existing minimum of $5.

The worker checks once a minute and sends at most one queued message each run.
Only events occurring after activation are collected; old purchases are not
replayed. Each event is deduplicated by type, source ID, and round. Buy messages
expire when the Challenge closes; other queued messages expire after 24 hours.
Large backlogs or longer outages can therefore skip stale events deliberately.
Amounts come from the recorded transaction, not a current token price.

The database serializes claims and binds delivery to one numeric chat ID and
optional topic ID. A Telegram rate-limit response schedules a later retry and
pauses that destination for the requested interval. Definite configuration errors
pause the database switch. Network timeouts, ambiguous responses, and expired
worker leases are marked `uncertain` for manual review, because Telegram's
`sendMessage` API does not provide an idempotency key. They are never automatically
reposted. This avoids claiming an impossible exactly-once delivery guarantee.

## Register the bot

1. Open the official [BotFather](https://t.me/BotFather) and send `/newbot`.
2. Suggested display name: **TREE Community Bot**.
3. Suggested username: **Thickquidity_TREE_Bot**, if available. Availability has
   not been checked; BotFather confirms it during registration.
4. Suggested description: "Verified TREE purchase alerts and Knowledge Trial
   participation updates. Open the TREE Challenge directly from each alert."
5. Add the bot to the intended TREE group or announcement channel. Give it message
   posting permission. In a channel, it needs administrator posting permission.
   No delete-message, ban-user, invite-user, or wallet permissions are needed.
6. Keep the BotFather token in a password manager and the hosting service's secret
   environment settings. Do not commit it or paste it into a public group.

No `/start` conversation or commands are implemented in this announcement-only
first version. Keep Telegram privacy mode enabled; it does not need ordinary chat
messages. No webhook is needed for outgoing notifications.

## Connection and preflight

Use Node 22+ (tested on Node 24). From this directory:

```sh
npm ci --ignore-scripts
npm test
npm run preview
```

`preview` prints two clearly marked examples and sends nothing. `npm run once`
also does nothing until explicitly enabled.

Create a local ignored `.env` from `.env.example`, or set the same variables in
the server's environment. Store the token only server-side. Configure the
destination as its exact negative numeric group/channel ID, not its username.
If the group has a public username, an operator can resolve it with Telegram's
read-only `getChat` API after adding the bot. For a private group, inspect the
bot's membership update locally with `getUpdates` before configuring any webhook;
do not publish the token, raw update data, or unrelated messages. No updates are
consumed by the included preflight script.

```sh
npm run check
```

This checks the bot identity, destination, and posting permissions using
`getMe`, `getChat`, and `getChatMember`. It never posts or changes a webhook.
An optional forum topic must also be checked manually for existence and openness.

The database connection accepts the dedicated `TREE_TELEGRAM_SUPABASE_*`
variables or the existing `TREE_KNOWLEDGE_TRIAL_SUPABASE_*` /
`TREE_RAFFLE_SUPABASE_*` server variables. Use a Supabase secret/service-role key,
never a browser publishable/anonymous key. The migration's RPCs are invoker
functions executable only by `service_role`; private queue tables use RLS, and
the source-column grants exclude scores, answers, and authorization material.

## Deployment and activation

Follow the repository's `AGENTS.md` and `production/README.md`. Do not run a normal
full-functions deploy of the TREE website: existing live packages have not all
been recovered. The new function is deliberately outside `netlify/functions`.

1. Review/merge this change. Apply
   `supabase/migrations/20260923203000_tree_telegram_notifications.sql` to the
   existing Challenge database, using the schema migration workflow. It adds only
   disabled notification settings, an outbox, and two service-only RPCs. Verify the
   new function grants and run Supabase security advisors.
2. Package **only** `functions/tree-telegram-notify.mts` and its imported `src`
   modules. Add its package and `* * * * *` schedule through the preserved-package
   release process. Retain all existing public files, backend identities, routes,
   and schedules; record the new package digest and deployment in the production
   manifest. Keep automatic production publication locked.
3. Set the server environment variables and verify bot/destination using preflight.
   Enable `TREE_TELEGRAM_ENABLED=true` only in production. Deploy previews and
   branch deploys are additionally blocked by the worker's context check.
4. Activate the destination with a database administrator, using the verified
   numeric ID. The following example uses a placeholder, not a live destination:

```sql
update private.tree_telegram_settings
set enabled = true,
    activated_at = clock_timestamp(),
    chat_id = '-1001234567890', -- REPLACE with the verified destination
    thread_id = null,
    next_send_at = clock_timestamp()
where singleton;
```

5. Watch the next real qualifying purchase/completion and check its corresponding
   Telegram message and outbox status. Do not fabricate ledger buys or scored
   attempts just to test posting.

A separately managed Node host can invoke `npm run once` each minute instead of
the Netlify schedule. Choose one deployment path; the database lease still guards
against overlapping invocations. No wallet signing key is required.

## Pause, inspect, and recover

Immediate pause (no website deployment required):

```sql
update private.tree_telegram_settings set enabled=false where singleton;
select state, count(*) from private.tree_telegram_outbox group by state;
select id,kind,round_id,state,error_code,message_id,sent_at
from private.tree_telegram_outbox order by id desc limit 20;
```

Pause takes effect on the next claim; an already claimed HTTP send may finish.
For `uncertain`, inspect the destination before deciding whether to mark the row
sent or retry it. Never bulk-reset uncertain/sent rows to pending. A confirmed
posted message should be recorded as sent with its real Telegram message ID; a
confirmed unsent event can be reset to pending if still relevant. Resume with
`enabled=true` while retaining `activated_at` after a brief pause; reset
`activated_at` to the current time when intentionally starting fresh. Older queued
events will then be skipped. Changing chats/topics also requires updating the
server configuration and settings together and reviewing any outstanding send.

Current tests run the migration and RPCs in embedded PostgreSQL (PGlite) and cover
eligibility boundaries, hidden-field permissions, deduplication, cooldowns,
expired leases, disqualification, destination mismatch, and Telegram responses.
Live end-to-end delivery remains pending bot registration and activation.

References: [Telegram API](https://core.telegram.org/bots/api),
[BotFather](https://core.telegram.org/bots/features#botfather),
[Supabase functions](https://supabase.com/docs/guides/database/functions).
