import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { configuredSupabaseKeeperCursorStore } from './tree-raffle-supabase-cursors.mjs';
import {
  configuredDailyDrawExecutor,
  configuredKnowledgeTrialAwardExecutor,
  dueDailyRoundId,
} from './tree-raffle-draw-executor.mjs';

const SUI_GRAPHQL_URL = process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql';
const PORT = Number(process.env.PORT || 8080);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5_000);
const GRAPHQL_TIMEOUT_MS = Number(process.env.GRAPHQL_TIMEOUT_MS || 20_000);
const HEALTH_STALE_AFTER_MS = Number(process.env.HEALTH_STALE_AFTER_MS || 120_000);
const DRY_RUN = process.env.KEEPER_DRY_RUN !== 'false';
const CURSOR_BACKEND = process.env.KEEPER_CURSOR_BACKEND || 'memory';
const INGEST_ENDPOINT = process.env.TREE_RAFFLE_INGEST_ENDPOINT || process.env.KEEPER_INGEST_ENDPOINT || '';
const INGEST_SECRET = process.env.TREE_RAFFLE_INGEST_SECRET || process.env.KEEPER_INGEST_SECRET || '';
const INGEST_TIMEOUT_MS = Number(process.env.KEEPER_INGEST_TIMEOUT_MS || 12_000);
const MIN_INGEST_TIMEOUT_MS = 3_000;
const DRAW_ENABLED = process.env.KEEPER_DRAW_ENABLED === 'true';
const DRAW_DRY_RUN = process.env.KEEPER_DRAW_DRY_RUN !== 'false';
const KNOWLEDGE_AWARD_ENABLED = process.env.KEEPER_KNOWLEDGE_AWARD_ENABLED === 'true';
const KNOWLEDGE_AWARD_DRY_RUN = process.env.KEEPER_KNOWLEDGE_AWARD_DRY_RUN !== 'false';
const KNOWLEDGE_AWARD_POLL_MS = Number(process.env.KEEPER_KNOWLEDGE_AWARD_POLL_MS || 60_000);
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
  pollInFlight: false,
  skippedPolls: 0,
  cursors: new Map(),
  streams: new Map(),
  draw: {
    lastAttemptedRound: null,
    lastCompletedRound: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastResult: null,
  },
  knowledgeAward: {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastResult: null,
  },
};
let durableCursorStore = null;
let dailyDrawExecutor = null;
let knowledgeTrialAwardExecutor = null;

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
    signal: AbortSignal.timeout(GRAPHQL_TIMEOUT_MS),
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
  if (!INGEST_ENDPOINT) {
    throw new Error('Live keeper mode requires TREE_RAFFLE_INGEST_ENDPOINT.');
  }
  if (!INGEST_SECRET) {
    throw new Error('Live keeper mode requires TREE_RAFFLE_INGEST_SECRET.');
  }
  const response = await fetch(INGEST_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-tree-raffle-ingest-secret': INGEST_SECRET,
    },
    body: JSON.stringify({ digest }),
    signal: AbortSignal.timeout(Number.isFinite(INGEST_TIMEOUT_MS) && INGEST_TIMEOUT_MS >= MIN_INGEST_TIMEOUT_MS
      ? INGEST_TIMEOUT_MS
      : 12_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload.message === 'string' ? payload.message : `Keeper ingest request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  console.log(JSON.stringify({
    level: 'info',
    action: 'keeper-submitted',
    digest,
    status: payload.status || 'ok',
    outcome: payload.outcome || 'recorded',
  }));
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
  if (state.pollInFlight) {
    state.skippedPolls += 1;
    return;
  }
  state.pollInFlight = true;
  state.lastPollAt = new Date().toISOString();
  const failures = [];
  try {
    for (const stream of KEEPER_STREAMS) {
      try {
        await pollStream(stream);
        state.streams.set(stream.id, { lastSuccessAt: new Date().toISOString(), lastError: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Keeper stream poll failed.';
        state.streams.set(stream.id, {
          ...(state.streams.get(stream.id) || {}),
          lastError: message,
        });
        failures.push(`${stream.id}: ${message}`);
      }
    }
    if (failures.length === 0) state.lastSuccessAt = new Date().toISOString();
    state.lastError = failures.length ? failures.join('; ') : null;
  } finally {
    state.pollInFlight = false;
  }
}

export async function pollDailyDraw(now = new Date()) {
  if (!DRAW_ENABLED) return;
  const roundId = dueDailyRoundId(now);
  if (!roundId || state.draw.lastAttemptedRound === roundId) return;
  state.draw.lastAttemptedRound = roundId;
  state.draw.lastAttemptAt = now.toISOString();
  state.draw.lastError = null;
  if (DRAW_DRY_RUN) {
    state.draw.lastResult = { status: 'dry-run-due', roundId };
    console.log(JSON.stringify({ level: 'info', action: 'draw-dry-run-due', roundId }));
    return;
  }
  try {
    const result = await dailyDrawExecutor.run(roundId);
    if (result?.status === 'no-round') {
      state.draw.lastSuccessAt = new Date().toISOString();
      state.draw.lastResult = { status: 'no-round', roundId };
      console.log(JSON.stringify({ level: 'info', action: 'draw-no-round', roundId }));
      return;
    }
    state.draw.lastCompletedRound = roundId;
    state.draw.lastSuccessAt = new Date().toISOString();
    state.draw.lastResult = {
      status: 'completed', roundId, winner: result.winner,
      drawTxDigest: result.drawTxDigest, registerTxDigest: result.registerTxDigest,
    };
    console.log(JSON.stringify({ level: 'info', action: 'draw-completed', ...state.draw.lastResult }));
  } catch (error) {
    state.draw.lastError = error instanceof Error ? error.message : 'Daily draw execution failed.';
    console.error(JSON.stringify({ level: 'error', action: 'draw-failed', roundId, message: state.draw.lastError }));
  }
}

export async function pollKnowledgeTrialAward(now = new Date()) {
  if (!KNOWLEDGE_AWARD_ENABLED) return;
  const lastAttemptMs = Date.parse(state.knowledgeAward.lastAttemptAt || '') || 0;
  if (lastAttemptMs && now.getTime() - lastAttemptMs < KNOWLEDGE_AWARD_POLL_MS) return;
  state.knowledgeAward.lastAttemptAt = now.toISOString();
  state.knowledgeAward.lastError = null;
  if (KNOWLEDGE_AWARD_DRY_RUN) {
    state.knowledgeAward.lastResult = { status: 'dry-run' };
    return;
  }
  try {
    const result = await knowledgeTrialAwardExecutor.run();
    state.knowledgeAward.lastSuccessAt = new Date().toISOString();
    state.knowledgeAward.lastResult = result;
    if (result?.status === 'awarded') {
      console.log(JSON.stringify({
        level: 'info', action: 'knowledge-award-completed',
        roundId: result.roundId, wallet: result.wallet,
        registerTxDigest: result.registerTxDigest,
      }));
    }
  } catch (error) {
    state.knowledgeAward.lastError = error instanceof Error ? error.message : 'Knowledge Trial award settlement failed.';
    console.error(JSON.stringify({ level: 'error', action: 'knowledge-award-failed', message: state.knowledgeAward.lastError }));
  }
}

export function keeperHealthStatus(snapshot, nowMs = Date.now(), staleAfterMs = HEALTH_STALE_AFTER_MS) {
  const streamStates = KEEPER_STREAMS.map(({ id }) => snapshot.streams.get(id));
  const latestSuccessMs = Math.max(
    0,
    ...streamStates.map((stream) => Date.parse(stream?.lastSuccessAt || '') || 0),
  );
  if (!latestSuccessMs || nowMs - latestSuccessMs > staleAfterMs) return 'unavailable';
  return snapshot.lastError ? 'degraded' : 'ok';
}

function publicState() {
  const status = keeperHealthStatus(state);
  return {
    status,
    mode: DRY_RUN ? 'staging-dry-run' : 'live',
    cursorPersistence: CURSOR_BACKEND === 'supabase' ? 'supabase-compare-and-set' : 'memory-only-staging',
    startedAt: state.startedAt,
    lastPollAt: state.lastPollAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    candidateDigests: state.candidateDigests,
    pollInFlight: state.pollInFlight,
    skippedPolls: state.skippedPolls,
    draw: {
      enabled: DRAW_ENABLED,
      mode: DRAW_DRY_RUN ? 'dry-run' : 'live',
      ...state.draw,
    },
    knowledgeAward: {
      enabled: KNOWLEDGE_AWARD_ENABLED,
      mode: KNOWLEDGE_AWARD_DRY_RUN ? 'dry-run' : 'live',
      ...state.knowledgeAward,
    },
    streams: KEEPER_STREAMS.map(({ id }) => ({
      id,
      initialized: state.cursors.has(id),
      lastSuccessAt: state.streams.get(id)?.lastSuccessAt || null,
      lastError: state.streams.get(id)?.lastError || null,
    })),
  };
}

export async function startKeeper() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error('PORT is invalid.');
  if (!Number.isInteger(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 2_000) throw new Error('POLL_INTERVAL_MS is invalid.');
  if (!Number.isInteger(GRAPHQL_TIMEOUT_MS) || GRAPHQL_TIMEOUT_MS < 3_000) throw new Error('GRAPHQL_TIMEOUT_MS is invalid.');
  if (!Number.isInteger(HEALTH_STALE_AFTER_MS) || HEALTH_STALE_AFTER_MS < 30_000) throw new Error('HEALTH_STALE_AFTER_MS is invalid.');
  if (!DRY_RUN && !INGEST_ENDPOINT) throw new Error('Live keeper mode requires TREE_RAFFLE_INGEST_ENDPOINT.');
  if (!DRY_RUN && !INGEST_SECRET) throw new Error('Live keeper mode requires TREE_RAFFLE_INGEST_SECRET.');
  if (!Number.isInteger(INGEST_TIMEOUT_MS) || INGEST_TIMEOUT_MS < MIN_INGEST_TIMEOUT_MS) {
    throw new Error('KEEPER_INGEST_TIMEOUT_MS is invalid.');
  }
  if (!Number.isInteger(KNOWLEDGE_AWARD_POLL_MS) || KNOWLEDGE_AWARD_POLL_MS < 10_000) {
    throw new Error('KEEPER_KNOWLEDGE_AWARD_POLL_MS is invalid.');
  }
  if (DRAW_ENABLED && !DRAW_DRY_RUN) dailyDrawExecutor = configuredDailyDrawExecutor();
  if (KNOWLEDGE_AWARD_ENABLED && !KNOWLEDGE_AWARD_DRY_RUN) {
    knowledgeTrialAwardExecutor = configuredKnowledgeTrialAwardExecutor();
  }
  await initializeCursorPersistence();

  http.createServer((request, response) => {
    if (request.url !== '/healthz') {
      response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return response.end(JSON.stringify({ status: 'not-found' }));
    }
    const health = publicState();
    response.writeHead(health.status === 'unavailable' ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return response.end(JSON.stringify(health));
  }).listen(PORT, '0.0.0.0');

  const run = async () => {
    try {
      await pollOnce();
      await pollDailyDraw();
      await pollKnowledgeTrialAward();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : 'Keeper poll failed.';
      console.error(JSON.stringify({ level: 'error', action: 'poll-failed', message: state.lastError }));
    }
  };
  await run();
  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      await run();
      scheduleNext();
    }, POLL_INTERVAL_MS);
    timer.unref();
  };
  scheduleNext();
  console.log(JSON.stringify({ level: 'info', action: 'keeper-started', port: PORT, dryRun: DRY_RUN }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startKeeper().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
