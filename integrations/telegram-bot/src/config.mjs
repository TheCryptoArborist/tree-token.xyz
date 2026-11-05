export const ENV_KEYS = [
  'TREE_TELEGRAM_ENABLED', 'TREE_TELEGRAM_BOT_TOKEN', 'TREE_TELEGRAM_CHAT_ID',
  'TREE_TELEGRAM_THREAD_ID', 'TREE_TELEGRAM_SUPABASE_URL', 'TREE_TELEGRAM_SUPABASE_SECRET_KEY',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL', 'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_SUPABASE_URL', 'TREE_RAFFLE_SUPABASE_SECRET_KEY', 'CONTEXT',
];

export function runtimeEnvironment() {
  // CLI only. The Netlify entrypoint supplies Netlify.env explicitly.
  return Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
}

export function telegramConfig(env, { checkOnly = false } = {}) {
  if (!checkOnly && (env.TREE_TELEGRAM_ENABLED !== 'true'
      || (env.CONTEXT && env.CONTEXT !== 'production'))) return { enabled: false };
  const token = env.TREE_TELEGRAM_BOT_TOKEN?.trim() || '';
  const chatId = env.TREE_TELEGRAM_CHAT_ID?.trim() || '';
  const thread = env.TREE_TELEGRAM_THREAD_ID?.trim() || '';
  if (!/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Invalid TREE_TELEGRAM_BOT_TOKEN configuration.');
  if (!/^-\d{1,16}$/.test(chatId) || !Number.isSafeInteger(Number(chatId))) {
    throw new Error('TREE_TELEGRAM_CHAT_ID must be a numeric group or channel ID.');
  }
  if (thread && (!/^[1-9]\d{0,9}$/.test(thread) || Number(thread) > 2147483647)) {
    throw new Error('Invalid TREE_TELEGRAM_THREAD_ID configuration.');
  }
  const base = { enabled: true, token, chatId, threadId: thread ? Number(thread) : null };
  if (checkOnly) return base;
  const rawUrl = env.TREE_TELEGRAM_SUPABASE_URL || env.TREE_KNOWLEDGE_TRIAL_SUPABASE_URL || env.TREE_RAFFLE_SUPABASE_URL;
  const secretKey = env.TREE_TELEGRAM_SUPABASE_SECRET_KEY || env.TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY || env.TREE_RAFFLE_SUPABASE_SECRET_KEY;
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid notification database URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Notification database must use an HTTPS origin.');
  }
  if (!secretKey?.trim()) throw new Error('Notification database secret is not configured.');
  return { ...base, databaseUrl: url.origin, secretKey: secretKey.trim() };
}
