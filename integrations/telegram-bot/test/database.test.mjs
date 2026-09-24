import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../../../supabase/migrations/20260923203000_tree_telegram_notifications.sql', import.meta.url), 'utf8');
const wallet = `0x${'1'.repeat(64)}`;
const chat = '-1001234567890';
const round = 'knowledge:2026-09-23';

test('PostgreSQL notification queue, eligibility, and role isolation', async t => {
  const db = new PGlite();
  try {
    // Real Postgres execution with the production source column names/types.
    // Deliberately include confidential columns to test they cannot be read.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema private;
      create table private.tree_raffle_verified_buys (
        tx_digest text primary key,buyer text,tree_amount_raw numeric(78,0),
        qualifying_usd_cents bigint,qualifies boolean,finalized_at timestamptz,
        recorded_at timestamptz default now(),fingerprint text);
      create table private.tree_knowledge_trial_rounds (
        round_id text primary key,state text,minimum_qualifying_usd_cents integer,
        purchase_window_opens_at timestamptz,purchase_window_closes_at timestamptz,
        challenge_opens_at timestamptz,challenge_closes_at timestamptz);
      create table private.tree_knowledge_trial_attempts (
        attempt_id uuid primary key,round_id text,wallet text,submitted_at timestamptz,
        disqualified boolean default false,answers jsonb,correct_count integer,
        elapsed_ms integer,attempt_token_sha256 text);
      alter table private.tree_raffle_verified_buys enable row level security;
      alter table private.tree_knowledge_trial_rounds enable row level security;
      alter table private.tree_knowledge_trial_attempts enable row level security;
    `);
    await db.exec(migration);
    async function asRole(role, sql, params = []) {
      await db.exec(`set role ${role}`);
      try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
    }
    async function reset(enabled = true) {
      await db.exec(`truncate private.tree_telegram_outbox restart identity;
        delete from private.tree_raffle_verified_buys; delete from private.tree_knowledge_trial_attempts;
        delete from private.tree_knowledge_trial_rounds;
        update private.tree_telegram_settings set enabled=${enabled},activated_at=now()-interval '1 hour',
          chat_id='${chat}',thread_id=null,next_send_at=now()-interval '1 minute';
        insert into private.tree_knowledge_trial_rounds values ('${round}','open',500,
          now()-interval '15 minutes',now()+interval '1 hour',now()-interval '15 minutes',now()+interval '1 hour');`);
    }
    async function buy({ id = '2', cents = 500, qualifies = true, when = "now()-interval '5 minutes'" } = {}) {
      await db.query(`insert into private.tree_raffle_verified_buys
        (tx_digest,buyer,tree_amount_raw,qualifying_usd_cents,qualifies,finalized_at)
        values ($1,$2,1250000000000,$3,$4,${when})`, [id.repeat(44),wallet,cents,qualifies]);
    }
    async function attempt({ submitted = true, disqualified = false } = {}) {
      await db.query(`insert into private.tree_knowledge_trial_attempts values
        ('11111111-1111-4111-8111-111111111111',$1,$2,${submitted ? "now()-interval '1 minute'" : 'null'},
         $3,'["HIDDEN_ANSWER"]',3,98765,'HIDDEN_TOKEN')`, [round,wallet,disqualified]);
    }
    async function claim(destination = chat) {
      return (await asRole('service_role','select public.claim_tree_telegram_notification_v1($1,null) as result',[destination])).rows[0].result;
    }
    async function settle(event, status = 'sent', seconds = 0, token = event.leaseToken) {
      return (await asRole('service_role',
        'select public.settle_tree_telegram_notification_v1($1,$2,$3,$4,$5,$6) as result',
        [event.id,token,status,status==='sent'?42:null,seconds,status==='sent'?null:'test-error'])).rows[0].result;
    }
    async function unthrottle() {
      await db.exec("update private.tree_telegram_settings set next_send_at=now()-interval '1 minute'");
    }

    await t.test('migration starts disabled; anonymous roles cannot invoke or read', async () => {
      assert.equal((await claim()).status,'disabled');
      for (const role of ['anon','authenticated']) {
        await assert.rejects(asRole(role,'select public.claim_tree_telegram_notification_v1($1,null)',[chat]), { code:'42501' });
        await assert.rejects(asRole(role,'select * from private.tree_telegram_outbox'), { code:'42501' });
        await assert.rejects(asRole(role,"select public.settle_tree_telegram_notification_v1(1,gen_random_uuid(),'sent',42,0,null)"), { code:'42501' });
      }
      for (const column of ['answers','correct_count','elapsed_ms','attempt_token_sha256']) {
        await assert.rejects(asRole('service_role',`select ${column} from private.tree_knowledge_trial_attempts`), { code:'42501' });
      }
    });

    await t.test('only verified purchases meeting the round minimum and window qualify', async () => {
      await reset(); await buy({cents:499}); await buy({id:'3',qualifies:false});
      await buy({id:'4',when:"now()-interval '30 minutes'"}); await buy({id:'5'});
      const result=await claim(); assert.equal(result.status,'claimed');
      assert.equal(result.event.payload.txDigest,'5'.repeat(44));
      assert.equal(result.event.payload.qualifyingUsdCents,'500');
      assert.equal((await db.query('select count(*)::int as n from private.tree_telegram_outbox')).rows[0].n,1);
    });

    await t.test('round-specific higher minimum applies', async () => {
      await reset(); await buy({cents:700});
      await db.exec('update private.tree_knowledge_trial_rounds set minimum_qualifying_usd_cents=1000');
      assert.equal((await claim()).status,'idle');
    });

    await t.test('no old purchases or unsubmitted/disqualified attempts are announced', async () => {
      await reset(); await buy({when:"now()-interval '2 hours'"}); await attempt({submitted:false});
      assert.equal((await claim()).status,'idle');
      await db.exec("update private.tree_knowledge_trial_attempts set submitted_at=now(),disqualified=true");
      assert.equal((await claim()).status,'idle');
    });

    await t.test('completion payload excludes all confidential fields', async () => {
      await reset(); await attempt(); const result=await claim();
      assert.equal(result.event.kind,'challenge_completed');
      assert.deepEqual(result.event.payload,{wallet,roundId:round});
      assert.doesNotMatch(JSON.stringify(result),/HIDDEN|98765|answers|correct_count/);
    });

    await t.test('overlap and replay do not deliver a confirmed event twice', async () => {
      await reset(); await buy(); const first=await claim();
      assert.equal((await claim()).status,'busy');
      assert.equal((await settle(first.event)).status,'recorded');
      await unthrottle(); assert.equal((await claim()).status,'idle');
      assert.equal((await db.query('select count(*)::int as n from private.tree_telegram_outbox')).rows[0].n,1);
    });

    await t.test('destination and stale lease tokens are rejected', async () => {
      await reset(); await buy(); await assert.rejects(claim('-100999'));
      const first=await claim();
      assert.equal((await settle(first.event,'sent',0,'22222222-2222-4222-8222-222222222222')).status,'stale');
      assert.equal((await claim()).status,'busy');
    });

    await t.test('Telegram cooldown pauses the entire destination then retries the same event', async () => {
      await reset(); await buy(); const first=await claim(); await settle(first.event,'retry',300);
      assert.equal((await claim()).status,'throttled');
      await unthrottle();
      await db.exec("update private.tree_telegram_outbox set available_at=now()-interval '1 minute'");
      const next=await claim(); assert.equal(next.event.id,first.event.id);
      assert.notEqual(next.event.leaseToken,first.event.leaseToken);
    });

    await t.test('unknown delivery and expired worker lease never auto-replay', async () => {
      await reset(); await buy(); const first=await claim(); await settle(first.event,'uncertain');
      await unthrottle(); assert.equal((await claim()).status,'idle');
      await reset(); await buy(); await claim();
      await db.exec("update private.tree_telegram_outbox set lease_expires_at=now()-interval '1 minute'");
      await unthrottle(); assert.equal((await claim()).status,'idle');
      assert.equal((await db.query('select state from private.tree_telegram_outbox')).rows[0].state,'uncertain');
    });

    await t.test('closed rounds and disqualified attempts are removed from the waiting queue', async () => {
      await reset(); await buy(); await attempt(); const first=await claim(); await settle(first.event,'retry',300);
      await db.exec("update private.tree_knowledge_trial_rounds set state='closed'; update private.tree_knowledge_trial_attempts set disqualified=true");
      await unthrottle(); assert.equal((await claim()).status,'idle');
      assert.deepEqual((await db.query('select distinct state from private.tree_telegram_outbox')).rows,[{state:'skipped'}]);
    });

    await t.test('definite Telegram configuration errors pause notifications', async () => {
      await reset(); await buy(); const first=await claim(); await settle(first.event,'failed');
      assert.equal((await claim()).status,'disabled');
    });

    await t.test('polling keeps late-committing verified records without a timestamp cursor gap', async () => {
      await reset(); assert.equal((await claim()).status,'idle');
      await buy({when:"now()-interval '10 minutes'"}); assert.equal((await claim()).status,'claimed');
    });

    await t.test('fresh activation skips older source and queued events even inside the current round', async () => {
      await reset(); await buy(); const first=await claim(); await settle(first.event,'retry',4);
      await db.exec("update private.tree_telegram_settings set activated_at=clock_timestamp(),next_send_at=now()-interval '1 minute'");
      assert.equal((await claim()).status,'idle');
      assert.equal((await db.query('select state from private.tree_telegram_outbox')).rows[0].state,'skipped');
      await buy({id:'3',when:"now()-interval '1 minute'"});
      assert.equal((await claim()).status,'idle');
    });

    await t.test('purchase window excludes its closing boundary and future transactions', async () => {
      await reset();
      await db.exec("update private.tree_knowledge_trial_rounds set purchase_window_closes_at=now()-interval '2 minutes'");
      await buy({when:'(select purchase_window_closes_at from private.tree_knowledge_trial_rounds limit 1)'});
      await buy({id:'3',when:"now()+interval '1 minute'"});
      assert.equal((await claim()).status,'idle');
    });
  } finally { await db.close(); }
});
