import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramConfig } from '../src/config.mjs';
import { formatNotification } from '../src/messages.mjs';
import { runOnce, sendTelegram, databaseClient } from '../src/worker.mjs';

const env = { TREE_TELEGRAM_ENABLED: 'true', TREE_TELEGRAM_BOT_TOKEN: `123456:${'a'.repeat(35)}`,
  TREE_TELEGRAM_CHAT_ID: '-1001234567890', TREE_TELEGRAM_SUPABASE_URL: 'https://example.supabase.co',
  TREE_TELEGRAM_SUPABASE_SECRET_KEY: 'sb_secret_test' };
const event = { id: '1', kind: 'qualifying_buy', leaseToken: '11111111-1111-4111-8111-111111111111', payload: {
  wallet: `0x${'a'.repeat(64)}`, roundId: 'knowledge:2026-09-23', txDigest: '2'.repeat(44),
  treeAmountRaw: '1250000123456', qualifyingUsdCents: '2512',
} };
const response = (status, body) => new Response(JSON.stringify(body), { status });

test('disabled and preview environments cannot claim or send', async () => {
  const rpc = () => assert.fail('database must not be called');
  assert.deepEqual(await runOnce({ env: {}, rpc }), { status: 'disabled' });
  assert.deepEqual(await runOnce({ env: { ...env, CONTEXT: 'deploy-preview' }, rpc }), { status: 'disabled' });
});

test('secrets and destination must validate before claiming', () => {
  for (const patch of [ { TREE_TELEGRAM_CHAT_ID: '@somebody' }, { TREE_TELEGRAM_CHAT_ID: '1234' },
    { TREE_TELEGRAM_THREAD_ID: '0' }, { TREE_TELEGRAM_SUPABASE_URL: 'https://user:pass@example.org' },
    { TREE_TELEGRAM_SUPABASE_URL: 'http://example.org' } ]) {
    assert.throws(() => telegramConfig({ ...env, ...patch }));
  }
});

test('purchase message uses exact raw units and does not claim entry or a win', () => {
  const message = formatNotification(event);
  assert.match(message.text, /1,250,000.123456 TREE/);
  assert.match(message.text, /\$25.12/);
  assert.match(message.text, /Participation requires completing/);
  assert.equal(message.parse_mode, undefined);
  assert.equal(message.reply_markup.inline_keyboard[0][1].url, `https://suivision.xyz/txblock/${event.payload.txDigest}`);
});

test('completion message never includes hidden scores, timing, answers, or tokens', () => {
  const message = formatNotification({ ...event, kind: 'challenge_completed', payload: {
    ...event.payload, correctCount: 3, elapsedMs: 98765, answers: ['PRIVATE_ANSWER'],
    attemptToken: 'PRIVATE_TOKEN', displayName: '<script>evil</script>',
  } });
  assert.doesNotMatch(JSON.stringify(message), /98765|PRIVATE_|<script>|correctCount|elapsedMs/);
  assert.match(message.text, /Scores stay private/);
  assert.equal(message.reply_markup.inline_keyboard[0].length, 1);
});

test('unverified values fail closed', () => {
  for (const payload of [{ wallet: '<b>fake</b>' }, { txDigest: '../../spoof' },
    { qualifyingUsdCents: '499' }, { treeAmountRaw: '-1' }, { roundId: 'fake' }]) {
    assert.throws(() => formatNotification({ ...event, payload: { ...event.payload, ...payload } }));
  }
});

test('confirmed send persists delivery once', async () => {
  const calls = []; let sent = 0;
  const result = await runOnce({ env,
    rpc: async (name, body) => { calls.push([name, body]); return calls.length === 1
      ? { status: 'claimed', event } : { status: 'recorded' }; },
    send: async () => { sent++; return { status: 'sent', messageId: 42 }; },
  });
  assert.equal(sent, 1); assert.deepEqual(result, { status: 'sent' });
  assert.equal(calls[1][1].p_message_id, 42);
  assert.equal(calls[1][1].p_lease_token, event.leaseToken);
});

test('idle, throttled, and busy claims never send', async () => {
  for (const status of ['idle', 'throttled', 'busy', 'disabled']) {
    assert.deepEqual(await runOnce({ env, rpc: async () => ({ status }),
      send: () => assert.fail('unexpected send') }), { status });
  }
});

test('invalid queued payload is failed without sending', async () => {
  const settled = [];
  const result = await runOnce({ env, rpc: async (name, body) => name.startsWith('claim')
    ? { status: 'claimed', event: { ...event, payload: {} } }
    : (settled.push(body), { status: 'recorded' }), send: () => assert.fail('unexpected send') });
  assert.equal(result.status, 'failed'); assert.equal(settled[0].p_error_code, 'invalid-notification-data');
});

test('Telegram request has fixed destination and optional topic, without paid broadcasting', async () => {
  const config = telegramConfig({ ...env, TREE_TELEGRAM_THREAD_ID: '123' });
  const result = await sendTelegram(config, formatNotification(event), async (url, options) => {
    assert.ok(url.startsWith('https://api.telegram.org/bot'));
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, env.TREE_TELEGRAM_CHAT_ID); assert.equal(body.message_thread_id, 123);
    assert.equal(body.allow_paid_broadcast, undefined); assert.equal(options.redirect, 'error');
    return response(200, { ok: true, result: { message_id: 42, chat: { id: Number(config.chatId) } } });
  });
  assert.equal(result.status, 'sent');
});

test('429 honors Telegram cooldown; rejected config fails; unknown outcomes are never retried', async () => {
  const config = telegramConfig(env);
  const limited = await sendTelegram(config, {}, async () => response(429,
    { ok: false, error_code: 429, parameters: { retry_after: 300 } }));
  assert.equal(limited.status, 'retry'); assert.equal(limited.retryAfter, 300);
  assert.equal((await sendTelegram(config, {}, async () => response(429,
    { ok: false, error_code: 429, parameters: { retry_after: 999999 } }))).status, 'failed');
  assert.equal((await sendTelegram(config, {}, async () => response(403, { ok: false, error_code: 403 }))).status, 'failed');
  for (const fetcher of [async () => { throw new Error(`token: ${config.token}`); },
    async () => response(502, { error: 'gateway' }),
    async () => response(200, { ok: true, result: { message_id: 42, chat: { id: -1 } } }),
    async () => new Response('invalid JSON')]) {
    const result = await sendTelegram(config, {}, fetcher);
    assert.equal(result.status, 'uncertain'); assert.ok(!JSON.stringify(result).includes(config.token));
  }
});

test('database failures never leak keys or retry a successful Telegram send', async () => {
  let sent = 0;
  await assert.rejects(runOnce({ env,
    rpc: async name => { if (name.startsWith('claim')) return { status: 'claimed', event }; throw new Error('db unavailable'); },
    send: async () => { sent++; return { status: 'sent', messageId: 3 }; },
  }));
  assert.equal(sent, 1);
  const config = telegramConfig(env);
  const call = databaseClient(config, async () => { throw new Error(config.secretKey); });
  await assert.rejects(call('claim_tree_telegram_notification_v1', {}), { message: 'Notification database request failed.' });
});

test('Supabase secret keys use apikey; JWT service-role keys also use bearer authorization', async () => {
  for (const key of ['sb_secret_test', 'legacy.jwt.key']) {
    const call = databaseClient({ ...telegramConfig(env), secretKey: key }, async (url, options) => {
      assert.equal(options.headers.apikey, key);
      assert.equal(options.headers.Authorization, key.startsWith('sb_secret_') ? undefined : `Bearer ${key}`);
      return response(200, { status: 'idle' });
    });
    await call('claim_tree_telegram_notification_v1', {});
  }
});
