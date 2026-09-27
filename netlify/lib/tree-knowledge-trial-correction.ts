import { fetchFinalizedTreeRaffleClaim } from './tree-raffle-claim.ts';
import { verifyTreeRaffleClaimTransaction } from './tree-raffle-sui-draw.ts';

export const SEPTEMBER_22_CORRECTION = Object.freeze({
  incidentId: 'knowledge:2026-09-22:display-correction',
  originalRoundId: 'knowledge:2026-09-22',
  originalDrawId: 'knowledge:2026-09-22:award',
  originalClaimDigest: 'Ej9Wyaf8fWyLUf9sBAwu65wn2QWaVZYWkeY5DtfqyRvA',
  onchainDrawId: 'knowledge:2026-09-22:correction',
  wallet: '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6',
  tokenType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  amountRaw: '49000000000',
});

const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;

export const CORRECTION_EVENTS_QUERY = `query ChallengeCorrectionEvents($type: String!, $before: String) {
  events(last: 50, before: $before, filter: { type: $type }) {
    pageInfo { hasPreviousPage startCursor }
    nodes { transaction { digest } contents { type { repr } json } }
  }
}`;

type Environment = Record<string, string | undefined>;
type ChainEvent = { digest: string; type: string; json: Record<string, unknown> };
type Dependencies = {
  env?: Environment;
  fetchImpl?: typeof fetch;
  fetchClaim?: typeof fetchFinalizedTreeRaffleClaim;
  readEvents?: (eventType: string) => Promise<ChainEvent[]>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}

function bytes(value: unknown): number[] {
  if (Array.isArray(value) && !value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return value as number[];
  }
  if (typeof value === 'string' && value.length > 0 && value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    try { return [...atob(value)].map((character) => character.charCodeAt(0)); } catch { /* fail closed below */ }
  }
  throw new Error('Sui returned an invalid correction draw ID.');
}

function drawId(value: unknown): string {
  return new TextDecoder().decode(Uint8Array.from(bytes(value)));
}

function matchingEvent(event: ChainEvent, expectedType: string, correction = SEPTEMBER_22_CORRECTION) {
  const amount = String(event.json.amount || '');
  return event.type === expectedType
    && drawId(event.json.draw_id) === correction.onchainDrawId
    && String(event.json.winner || '').toLowerCase() === correction.wallet
    && amount === correction.amountRaw;
}

async function fetchEvents(eventType: string, dependencies: Dependencies): Promise<ChainEvent[]> {
  if (dependencies.readEvents) return dependencies.readEvents(eventType);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const events: ChainEvent[] = [];
  let before: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await fetchImpl(SUI_GRAPHQL_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: CORRECTION_EVENTS_QUERY, variables: { type: eventType, before } }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Sui correction lookup returned ${response.status}.`);
    const payload = record(await response.json());
    if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui correction lookup returned a GraphQL error.');
    const connection = record(record(payload.data).events);
    if (!Array.isArray(connection.nodes)) throw new Error('Sui returned malformed correction events.');
    for (const nodeValue of connection.nodes) {
      const node = record(nodeValue);
      const contents = record(node.contents);
      events.push({
        digest: String(record(node.transaction).digest || ''),
        type: String(record(contents.type).repr || ''),
        json: record(contents.json),
      });
    }
    const pageInfo = record(connection.pageInfo);
    if (pageInfo.hasPreviousPage !== true) break;
    const previous = String(pageInfo.startCursor || '');
    if (!previous || previous === before) throw new Error('Sui correction lookup returned an invalid cursor.');
    before = previous;
  }
  return events;
}

export async function readSupplementalCorrection(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const packageId = String(env.TREE_RAFFLE_PACKAGE_ID || '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(packageId)) throw new Error('The Challenge package is not configured.');
  const registeredType = `${packageId}::prize_pool::WinnerRegistered<${SEPTEMBER_22_CORRECTION.tokenType}>`;
  const claimedType = `${packageId}::prize_pool::PrizeClaimed<${SEPTEMBER_22_CORRECTION.tokenType}>`;
  const [claimEvents, registrationEvents] = await Promise.all([
    fetchEvents(claimedType, dependencies),
    fetchEvents(registeredType, dependencies),
  ]);
  const claims = claimEvents.filter((event) => matchingEvent(event, claimedType));
  const registrations = registrationEvents.filter((event) => matchingEvent(event, registeredType));
  if (claims.length > 1 || registrations.length > 1) throw new Error('Sui returned conflicting correction events.');
  const claim = claims[0] ?? null;
  const registration = registrations[0] ?? null;
  const status = claim ? 'claimed' : registration ? 'claimable' : 'pending-registration';
  return {
    ...SEPTEMBER_22_CORRECTION,
    status,
    claimable: status === 'claimable',
    claimed: status === 'claimed',
    registerTxDigest: registration?.digest || null,
    claimTxDigest: claim?.digest || null,
  };
}

export function createTreeKnowledgeTrialCorrectionHandler(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  return async (request: Request) => {
    if (request.method === 'GET') {
      try {
        return json({ status: 'ok', correction: await readSupplementalCorrection(dependencies) });
      } catch (error) {
        console.error('TREE Challenge correction lookup failed', error);
        return json({ status: 'error', error: 'correction-unavailable' }, 503);
      }
    }
    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
    let digest = '';
    let wallet = '';
    try {
      const body = await request.json() as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 2
        || typeof body.digest !== 'string' || typeof body.wallet !== 'string') throw new Error('invalid');
      digest = body.digest.trim();
      wallet = body.wallet.trim().toLowerCase();
      if (!SUI_DIGEST.test(digest) || !SUI_ADDRESS.test(wallet) || wallet !== SEPTEMBER_22_CORRECTION.wallet) throw new Error('invalid');
    } catch {
      return json({ status: 'error', error: 'invalid-request' }, 400);
    }
    try {
      const transaction = await (dependencies.fetchClaim ?? fetchFinalizedTreeRaffleClaim)(digest);
      if (transaction.sender !== wallet) throw new Error('The correction claim sender does not match the approved wallet.');
      const verified = verifyTreeRaffleClaimTransaction({
        transaction,
        packageId: env.TREE_RAFFLE_PACKAGE_ID || '',
        onchainDrawId: SEPTEMBER_22_CORRECTION.onchainDrawId,
        wallet,
        tokenType: SEPTEMBER_22_CORRECTION.tokenType,
        amountRaw: SEPTEMBER_22_CORRECTION.amountRaw,
      });
      return json({ status: 'ok', outcome: 'verified', wallet, digest: verified.digest });
    } catch (error) {
      console.error('TREE Challenge correction claim verification failed', error);
      return json({ status: 'error', error: 'verification-failed' }, 422);
    }
  };
}
