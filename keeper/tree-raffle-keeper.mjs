import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { configuredSupabaseKeeperCursorStore } from './tree-raffle-supabase-cursors.mjs';

const SUI_GRAPHQL_URL = process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql';
const PORT = Number(process.env.PORT || 8080);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5_000);
const DRY_RUN = process.env.KEEPER_DRY_RUN !== 'false';
const CURSOR_BACKEND = process.env.KEEPER_CURSOR_BACKEND || 'memory';
export const GRAPHQL_PAGE_SIZE = 50;

const V2_PACKAGE = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
const V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
const TURBOS_EVENT_PACKAGE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
const SUI_TYPE = '0x2::sui::SUI';
const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const V3_POOL = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
const TURBOS_POOL = '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';

export const KEEPER_STREAMS = Object.freeze([
  {
    id: 'suidex-v2',
    eventType: `${V2_PACKAGE}::pair::Swap<${SUI_TYPE},${TREE_TYPE}>`,
  },
  {
    id: 'suidex-v3',
    eventType: `${V3_PACKAGE}::trade::SwapEvent`,
  },
  {
    id: 'turbos',
    eventType: `${TURBOS_EVENT_PACKAGE}::pool::SwapEvent`,
  },
]);

const LATEST_EVENT_QUERY = `query KeeperLatest($type: String!) {
  events(last: 1, filter: { type: $type }) {
    pageInfo { startCursor }
    nodes { transaction { digest } contents { json } }
  }
}`;

const NEXT_EVENTS_QUERY = `query KeeperEvents($type: String!, $after: String, $first: Int!) {
  events(first: $first, after: $after, filter: { type: $type }) {
    pageInfo { hasNextPage endCursor }
    nodes { transaction { digest } contents { json } }
  }
}`;

const state = {
  startedAt: new Date().toISOString(),
  lastPollAt: null,
  lastSuccessAt: null,
  lastError: null,
  candidateDigests: 0,
  cursors: new Map(),
};
let durableCursorStore = null;

function normalizedAddress(value) {
  const body = String(value || '').toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${body}`;
}

export function isExactPoolCandidate(streamId, event) {
  const candidate = event?.contents?.json ?? event?.parsedJson;
  const json = candidate && typeof candidate === 'object' ? candidate : {};
  if (streamId === 'suidex-v3') return normalizedAddress(json.pool_id) === normalizedAddress(V3_POOL);
  if (streamId === 'turbos') return normalizedAddress(json.pool) === normalizedAddress(TURBOS_POOL);
  return streamId === 'suidex-v2';
}

async function graphql(query, variables) {
  const response = await fetch(SUI_GRAPHQL_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'TREE-Raffle-Keeper/1.0' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Sui GraphQL returned ${response.status}.`);
  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length) {
    const detail = payload.errors.map((error) => error?.message).filter(Boolean).join('; ');
    throw new Error(`Sui GraphQL returned a query error${detail ? `: ${detail}` : '.'}`);
  }
  return payload.data;
}

async function latestEvent(eventType) {
  const connection = (await graphql(LATEST_EVENT_QUERY, { type: eventType }))?.events;
  if (!connection || !Array.isArray(connection.nodes)) throw new Error('Sui GraphQL returned malformed latest-event data.');
  return connection;
}

async function nextEvents(eventType, cursor, limit) {
  const connection = (await graphql(NEXT_EVENTS_QUERY, { type: eventType, after: cursor, first: limit }))?.events;
  if (!connection || !Array.isArray(connection.nodes)) throw new Error('Sui GraphQL returned malformed event data.');
  return connection;
}

async function submitDigest(digest) {
  if (DRY_RUN) {
    console.log(JSON.stringify({ level: 'info', action: 'dry-run-candidate', digest }));
    return;
  }
  throw new Error('Live entry submission is intentionally blocked until durable cursor storage is configured.');
}

async function initializeCursorPersistence() {
  if (CURSOR_BACKEND === 'memory') return;
  if (CURSOR_BACKEND !== 'supabase') throw new Error('KEEPER_CURSOR_BACKEND must be memory or supabase.');
  durableCursorStore = configuredSupabaseKeeperCursorStore();
  const rows = await durableCursorStore.load();
  for (const row of rows) {
    const stream = KEEPER_STREAMS.find(({ id }) => id === row.streamId);
    if (!stream || stream.eventType !== row.eventType) {
      throw new Error(`Stored keeper cursor event type does not match ${row.streamId}.`);
    }
    state.cursors.set(row.streamId, row.cursor);
  }
}

async function persistCursor(stream, expectedCursor, nextCursor) {
  if (!nextCursor) throw new Error(`Sui GraphQL returned a missing cursor for ${stream.id}.`);
  if (durableCursorStore) {
    const saved = await durableCursorStore.compareAndSet({
      streamId: stream.id,
      eventType: stream.eventType,
      expectedCursor,
      nextCursor,
    });
    state.cursors.set(stream.id, saved.cursor);
    return;
  }
  state.cursors.set(stream.id, nextCursor);
}

async function bootstrapStream(stream) {
  const page = await latestEvent(stream.eventType);
  const latest = page.pageInfo?.startCursor || null;
  if (latest) await persistCursor(stream, null, latest);
  else state.cursors.set(stream.id, null);
  console.log(JSON.stringify({ level: 'info', action: 'stream-bootstrap', stream: stream.id, cursor: latest }));
}

async function pollStream(stream) {
  if (!state.cursors.has(stream.id)) return bootstrapStream(stream);
  let cursor = state.cursors.get(stream.id);
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await nextEvents(stream.eventType, cursor, GRAPHQL_PAGE_SIZE);
    for (const event of page.nodes) {
      const digest = event?.transaction?.digest;
      if (isExactPoolCandidate(stream.id, event) && typeof digest === 'string') {
        await submitDigest(digest);
        state.candidateDigests += 1;
      }
    }
    if (page.nodes.length) {
      const nextCursor = page.pageInfo?.endCursor;
      if (nextCursor === cursor) throw new Error(`Sui GraphQL repeated the cursor for ${stream.id}.`);
      await persistCursor(stream, cursor, nextCursor);
      cursor = nextCursor;
    }
    if (!page.pageInfo?.hasNextPage || !page.nodes.length) break;
  }
}

export async function pollOnce() {
  state.lastPollAt = new Date().toISOString();
  for (const stream of KEEPER_STREAMS) await pollStream(stream);
  state.lastSuccessAt = new Date().toISOString();
  state.lastError = null;
}

function publicState() {
  return {
    status: state.lastError ? 'degraded' : 'ok',
    mode: DRY_RUN ? 'staging-dry-run' : 'blocked',
    cursorPersistence: CURSOR_BACKEND === 'supabase' ? 'supabase-compare-and-set' : 'memory-only-staging',
    startedAt: state.startedAt,
    lastPollAt: state.lastPollAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    candidateDigests: state.candidateDigests,
    streams: KEEPER_STREAMS.map(({ id }) => ({ id, initialized: state.cursors.has(id) })),
  };
}

export async function startKeeper() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error('PORT is invalid.');
  if (!Number.isInteger(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 2_000) throw new Error('POLL_INTERVAL_MS is invalid.');
  if (!DRY_RUN) throw new Error('Live keeper mode remains blocked until verified ingestion is connected and reviewed.');
  await initializeCursorPersistence();

  http.createServer((request, response) => {
    if (request.url !== '/healthz') {
      response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return response.end(JSON.stringify({ status: 'not-found' }));
    }
    response.writeHead(state.lastError ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return response.end(JSON.stringify(publicState()));
  }).listen(PORT, '0.0.0.0');

  const run = async () => {
    try {
      await pollOnce();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : 'Keeper poll failed.';
      console.error(JSON.stringify({ level: 'error', action: 'poll-failed', message: state.lastError }));
    }
  };
  await run();
  setInterval(run, POLL_INTERVAL_MS).unref();
  console.log(JSON.stringify({ level: 'info', action: 'keeper-started', port: PORT, dryRun: DRY_RUN }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startKeeper().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
