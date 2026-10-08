import { telegramConfig, runtimeEnvironment } from './config.mjs';
import { formatNotification } from './messages.mjs';

export function databaseClient(config, fetcher = fetch) {
  return async (name, body) => {
    if (!['claim_tree_telegram_notification_v1', 'settle_tree_telegram_notification_v1'].includes(name)) {
      throw new Error('Unsupported notification database operation.');
    }
    const headers = { 'Content-Type': 'application/json', apikey: config.secretKey };
    // New Supabase secret keys are API keys, not JWT bearer tokens.
    if (!config.secretKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.secretKey}`;
    try {
      const response = await fetcher(`${config.databaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      // Never log upstream response bodies, credentials, or request URLs.
      throw new Error('Notification database request failed.');
    }
  };
}

export async function sendTelegram(config, message, fetcher = fetch) {
  let response, body;
  try {
    response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, chat_id: config.chatId,
        ...(config.threadId ? { message_thread_id: config.threadId } : {}) }),
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    body = await response.json();
  } catch {
    // Telegram sendMessage has no idempotency key. An unknown outcome must
    // be reviewed instead of automatically sending the message a second time.
    return { status: 'uncertain', code: 'telegram-outcome-unknown' };
  }
  if (response.ok && body?.ok === true && Number.isSafeInteger(body.result?.message_id)
      && body.result.message_id > 0 && String(body.result?.chat?.id) === config.chatId) {
    return { status: 'sent', messageId: body.result.message_id, code: null };
  }
  if (body?.ok === false && (response.status === 429 || body.error_code === 429)) {
    const seconds = Number(body.parameters?.retry_after);
    if (Number.isSafeInteger(seconds) && seconds > 604800) {
      return { status: 'failed', code: 'telegram-cooldown-needs-review' };
    }
    return { status: 'retry', retryAfter: Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 60,
      code: 'telegram-rate-limited' };
  }
  if (body?.ok === false && [400, 401, 403, 404].includes(body.error_code)) {
    return { status: 'failed', code: 'telegram-configuration-rejected' };
  }
  return { status: 'uncertain', code: 'telegram-outcome-unknown' };
}

export async function runOnce({ env = runtimeEnvironment(), rpc, send, fetcher = fetch } = {}) {
  const config = telegramConfig(env);
  if (!config.enabled) return { status: 'disabled' };
  const call = rpc || databaseClient(config, fetcher);
  const claimed = await call('claim_tree_telegram_notification_v1', {
    p_chat_id: config.chatId, p_thread_id: config.threadId,
  });
  if (['disabled', 'idle', 'busy', 'throttled'].includes(claimed?.status)) return { status: claimed.status };
  const event = claimed?.event;
  if (claimed?.status !== 'claimed' || !event || !/^\d+$/.test(String(event.id))
      || !/^[0-9a-f-]{36}$/.test(event.leaseToken)) throw new Error('Invalid notification claim.');
  let message;
  try { message = formatNotification(event); } catch {
    await call('settle_tree_telegram_notification_v1', {
      p_id: event.id, p_lease_token: event.leaseToken, p_status: 'failed', p_message_id: null,
      p_retry_after: 0, p_error_code: 'invalid-notification-data',
    });
    return { status: 'failed', code: 'invalid-notification-data' };
  }
  let outcome;
  try { outcome = await (send || sendTelegram)(config, message, fetcher); } catch {
    outcome = { status: 'uncertain', code: 'telegram-outcome-unknown' };
  }
  const recorded = await call('settle_tree_telegram_notification_v1', {
    p_id: event.id, p_lease_token: event.leaseToken, p_status: outcome.status,
    p_message_id: outcome.messageId ?? null, p_retry_after: outcome.retryAfter ?? 0,
    p_error_code: outcome.code ?? null,
  });
  if (recorded?.status !== 'recorded') throw new Error('Notification delivery result was not recorded.');
  return { status: outcome.status, ...(outcome.code ? { code: outcome.code } : {}) };
}
