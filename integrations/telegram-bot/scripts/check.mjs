import { telegramConfig, runtimeEnvironment } from '../src/config.mjs';

// Read-only preflight: checks bot identity and destination, never posts a message
// and never consumes Telegram updates or changes an existing webhook.
try {
  const config = telegramConfig(runtimeEnvironment(), { checkOnly: true });
  async function call(method, data = {}) {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error();
    return body.result;
  }
  const bot = await call('getMe');
  const chat = await call('getChat', { chat_id: config.chatId });
  const member = await call('getChatMember', { chat_id: config.chatId, user_id: bot.id });
  if (String(chat.id) !== config.chatId || !['group', 'supergroup', 'channel'].includes(chat.type)
      || ['left', 'kicked'].includes(member.status)) throw new Error();
  if (chat.type === 'channel' && member.status !== 'creator'
      && !(member.status === 'administrator' && member.can_post_messages)) throw new Error();
  if (member.status === 'restricted' && (!member.is_member || !member.can_send_messages)) throw new Error();
  if (member.status === 'member' && chat.permissions?.can_send_messages === false) throw new Error();
  if (config.threadId && !chat.is_forum) throw new Error();
  console.log(JSON.stringify({ status: 'ok', botUsername: bot.username, chatTitle: chat.title,
    chatId: String(chat.id), type: chat.type, role: member.status,
    topicRequiresManualCheck: config.threadId !== null, messageSent: false }, null, 2));
} catch {
  console.error('Telegram preflight failed. Check the token, numeric destination ID, and bot posting permissions.');
  process.exitCode = 1;
}
