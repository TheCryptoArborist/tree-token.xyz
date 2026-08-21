function required(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is not configured.`);
  return normalized;
}

export function keeperSupabaseConfig(env = process.env) {
  const rawUrl = required(env.TREE_RAFFLE_SUPABASE_URL, 'TREE_RAFFLE_SUPABASE_URL');
  const secretKey = required(env.TREE_RAFFLE_SUPABASE_SECRET_KEY, 'TREE_RAFFLE_SUPABASE_SECRET_KEY');
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('TREE_RAFFLE_SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:') throw new Error('TREE_RAFFLE_SUPABASE_URL must use HTTPS.');
  return { url: url.origin, secretKey };
}

function cursorRow(value) {
  if (!value || typeof value !== 'object') throw new Error('Supabase returned an invalid keeper cursor.');
  const row = value;
  if (!['suidex-v2', 'suidex-v3', 'turbos'].includes(row.streamId)
    || typeof row.eventType !== 'string' || !row.eventType
    || typeof row.cursor !== 'string' || !row.cursor
    || !Number.isSafeInteger(Number(row.version)) || Number(row.version) < 1) {
    throw new Error('Supabase returned an invalid keeper cursor.');
  }
  return { streamId: row.streamId, eventType: row.eventType, cursor: row.cursor, version: Number(row.version) };
}

export class SupabaseKeeperCursorStore {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async rpc(name, body) {
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.config.secretKey,
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'tree-raffle-keeper/1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload.message === 'string'
        ? payload.message
        : `Supabase keeper cursor request failed with HTTP ${response.status}.`;
      throw new Error(message);
    }
    return payload;
  }

  async load() {
    const payload = await this.rpc('load_tree_raffle_keeper_cursors', {});
    if (!Array.isArray(payload)) throw new Error('Supabase returned an invalid keeper cursor list.');
    return payload.map(cursorRow);
  }

  async compareAndSet({ streamId, eventType, expectedCursor, nextCursor }) {
    return cursorRow(await this.rpc('save_tree_raffle_keeper_cursor', {
      p_stream_id: streamId,
      p_event_type: eventType,
      p_expected_cursor: expectedCursor,
      p_next_cursor: nextCursor,
    }));
  }
}

export function configuredSupabaseKeeperCursorStore(env = process.env, fetchImpl = fetch) {
  return new SupabaseKeeperCursorStore(keeperSupabaseConfig(env), fetchImpl);
}
