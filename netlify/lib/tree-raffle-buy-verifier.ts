import {
  SUI_TYPE,
  SUIDEX_V2_TREE_POOL,
  SUIDEX_V3_TREE_POOL,
  TREE_TYPE,
  normalizeMoveType,
} from './tree-swap-route.ts';
import type { TreeRaffleVerifiedRoute } from './tree-raffle-ledger-core.ts';

const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const SUIDEX_V2_PACKAGE = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
const SUIDEX_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
const TURBOS_PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
const TURBOS_EVENT_PACKAGE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
const TURBOS_SUI_TREE_POOL = '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';
const TURBOS_SUI_TREE_FEE_TYPE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee10000bps::FEE10000BPS';
const DIGEST_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;

export const TREE_RAFFLE_BUY_QUERY = `query TreeRaffleBuy($digest: String!) {
  transaction(digest: $digest) {
    digest
    sender { address }
    transactionJson
    effects {
      status
      timestamp
      checkpoint { sequenceNumber }
      balanceChanges(first: 50) {
        pageInfo { hasNextPage }
        nodes { owner { address } coinType { repr } amount }
      }
      events(first: 50) {
        pageInfo { hasNextPage }
        nodes {
          sender { address }
          transactionModule { fullyQualifiedName }
          contents { type { repr } json }
        }
      }
    }
  }
}`;

type RecordValue = Record<string, unknown>;
type MoveCall = { packageId: string; moduleName: string; functionName: string; typeArguments: string[] };

export type FinalizedTreeBuy = {
  txDigest: string;
  buyer: string;
  route: TreeRaffleVerifiedRoute;
  suiSpentRaw: string;
  treeAmountRaw: string;
  finalizedCheckpoint: number;
  finalizedAt: string;
  raffleDate: string;
};

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const body = value.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(body)) return null;
  return `0x${body.padStart(64, '0')}`;
}

function parseUnsigned(value: unknown): bigint | null {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '').trim();
  return /^(?:0|[1-9][0-9]*)$/.test(text) ? BigInt(text) : null;
}

function parseSigned(value: unknown): bigint | null {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '').trim();
  return /^-?(?:0|[1-9][0-9]*)$/.test(text) ? BigInt(text) : null;
}

function extractMoveCalls(value: unknown): MoveCall[] {
  const calls: MoveCall[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return void node.forEach(visit);
    const object = record(node);
    if (!Object.keys(object).length) return;
    const packageId = normalizeAddress(object.package ?? object.packageId ?? object.package_id ?? object.packageAddress);
    const moduleName = object.module ?? object.moduleName ?? object.module_name;
    const functionName = object.function ?? object.functionName ?? object.function_name;
    if (packageId && typeof moduleName === 'string' && typeof functionName === 'string') {
      const rawTypes = object.typeArguments ?? object.type_arguments ?? object.typeArgs;
      calls.push({
        packageId,
        moduleName: moduleName.toLowerCase(),
        functionName: functionName.toLowerCase(),
        typeArguments: Array.isArray(rawTypes) ? rawTypes.filter((item): item is string => typeof item === 'string') : [],
      });
    }
    Object.values(object).forEach(visit);
  };
  visit(value);
  return calls;
}

const NORMAL_SUI = normalizeMoveType(SUI_TYPE);
const NORMAL_TREE = normalizeMoveType(TREE_TYPE);
const NORMAL_FEE = normalizeMoveType(TURBOS_SUI_TREE_FEE_TYPE);
const NORMAL_V2_PACKAGE = normalizeAddress(SUIDEX_V2_PACKAGE)!;
const NORMAL_V3_PACKAGE = normalizeAddress(SUIDEX_V3_PACKAGE)!;
const NORMAL_TURBOS_PACKAGE = normalizeAddress(TURBOS_PACKAGE)!;

function exactTypes(call: MoveCall, expected: string[]) {
  return call.typeArguments.length === expected.length
    && call.typeArguments.every((value, index) => normalizeMoveType(value) === expected[index]);
}

function recognizedSwapCall(call: MoveCall): TreeRaffleVerifiedRoute | null {
  if (call.packageId === NORMAL_V2_PACKAGE
    && call.moduleName === 'router'
    && call.functionName === 'swap_exact_tokens0_for_tokens1'
    && exactTypes(call, [NORMAL_SUI, NORMAL_TREE])) return 'suidex-v2';
  if (call.packageId === NORMAL_V3_PACKAGE
    && call.moduleName === 'trade'
    && call.functionName === 'flash_swap'
    && exactTypes(call, [NORMAL_SUI, NORMAL_TREE])) return 'suidex-v3';
  if (call.packageId === NORMAL_TURBOS_PACKAGE
    && call.moduleName === 'swap_router'
    && call.functionName === 'swap_b_a'
    && exactTypes(call, [NORMAL_TREE, NORMAL_SUI, NORMAL_FEE])) return 'turbos';
  return null;
}

function disqualifyingCall(call: MoveCall): boolean {
  if (![NORMAL_V2_PACKAGE, NORMAL_V3_PACKAGE, NORMAL_TURBOS_PACKAGE].includes(call.packageId)) return false;
  const containsTree = call.typeArguments.some((type) => normalizeMoveType(type) === NORMAL_TREE);
  if (!containsTree) return false;
  return /(liquidity|position|farm|staking|reward|collect|deposit|withdraw|stake|unstake|mint|open|close|add_|remove_)/
    .test(`${call.moduleName}::${call.functionName}`);
}

type SwapEvidence = { route: TreeRaffleVerifiedRoute; input: bigint; output: bigint };

function eventType(event: RecordValue): string {
  return String(record(record(event.contents).type).repr || '').toLowerCase();
}

function eventJson(event: RecordValue): RecordValue {
  return record(record(event.contents).json);
}

function eventParty(event: RecordValue, json: RecordValue, field: 'sender' | 'recipient'): string | null {
  return normalizeAddress(json[field]) ?? normalizeAddress(record(event.sender).address);
}

function parseSwapEvent(eventValue: unknown, buyer: string): SwapEvidence | null {
  const event = record(eventValue);
  const type = eventType(event);
  const json = eventJson(event);

  if (type.startsWith(`${SUIDEX_V2_PACKAGE}::pair::swap<`)
    && normalizeMoveType(type.slice(type.indexOf('<') + 1, type.lastIndexOf('>')).split(',')[0]) === NORMAL_SUI
    && normalizeMoveType(type.slice(type.indexOf('<') + 1, type.lastIndexOf('>')).split(',')[1]) === NORMAL_TREE) {
    const input = parseUnsigned(json.amount0_in);
    const otherInput = parseUnsigned(json.amount1_in);
    const inputOutput = parseUnsigned(json.amount0_out);
    const output = parseUnsigned(json.amount1_out);
    if (eventParty(event, json, 'sender') === buyer && input && input > 0n && otherInput === 0n && inputOutput === 0n && output && output > 0n) {
      return { route: 'suidex-v2', input, output };
    }
    return null;
  }

  if (type === `${SUIDEX_V3_PACKAGE}::trade::swapevent`) {
    const input = parseUnsigned(json.amount_x);
    const output = parseUnsigned(json.amount_y);
    if (normalizeAddress(json.pool_id) === normalizeAddress(SUIDEX_V3_TREE_POOL)
      && json.x_for_y === true
      && eventParty(event, json, 'sender') === buyer
      && input && input > 0n && output && output > 0n) return { route: 'suidex-v3', input, output };
    return null;
  }

  if (type === `${TURBOS_EVENT_PACKAGE}::pool::swapevent`) {
    const input = parseUnsigned(json.amount_b);
    const output = parseUnsigned(json.amount_a);
    if (normalizeAddress(json.pool) === normalizeAddress(TURBOS_SUI_TREE_POOL)
      && json.a_to_b === false && json.is_exact_in === true
      && eventParty(event, json, 'recipient') === buyer
      && input && input > 0n && output && output > 0n) return { route: 'turbos', input, output };
  }
  return null;
}

function newYorkDate(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(isoTimestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function containsPool(transactionJson: unknown, pool: string): boolean {
  return JSON.stringify(transactionJson).toLowerCase().includes(pool.toLowerCase());
}

export function verifyFinalizedTreeBuyNode(nodeValue: unknown, expectedDigest?: string): FinalizedTreeBuy {
  const node = record(nodeValue);
  const digest = typeof node.digest === 'string' ? node.digest.trim() : '';
  if (!DIGEST_PATTERN.test(digest) || (expectedDigest && digest !== expectedDigest)) throw new Error('Transaction digest did not match the requested Sui transaction.');
  const buyer = normalizeAddress(record(node.sender).address);
  if (!buyer) throw new Error('Transaction sender is unavailable.');
  const effects = record(node.effects);
  if (effects.status !== 'SUCCESS') throw new Error('Only successful finalized transactions can qualify.');
  const finalizedAt = new Date(String(effects.timestamp || '')).toISOString();
  const checkpointRaw = parseUnsigned(record(effects.checkpoint).sequenceNumber);
  if (!checkpointRaw || checkpointRaw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Finalized checkpoint is unavailable.');

  const events = record(effects.events);
  const balances = record(effects.balanceChanges);
  if (record(events.pageInfo).hasNextPage === true || record(balances.pageInfo).hasNextPage === true) {
    throw new Error('Transaction evidence exceeded the verifier page limit.');
  }
  const eventNodes = Array.isArray(events.nodes) ? events.nodes : [];
  const disqualifyingEvent = eventNodes.some((value) => /(lpmint|liquidity|position|farm|stake|deposit|withdraw|reward)/i.test(eventType(record(value))));
  if (disqualifyingEvent) throw new Error('Liquidity, zap, farm, and position transactions do not earn raffle tickets.');

  const calls = extractMoveCalls(node.transactionJson);
  if (calls.some(disqualifyingCall)) throw new Error('Liquidity, zap, farm, and position transactions do not earn raffle tickets.');
  const swapCalls = calls.map(recognizedSwapCall).filter((route): route is TreeRaffleVerifiedRoute => Boolean(route));
  if (swapCalls.length !== 1) throw new Error('A qualifying buy must contain exactly one allowlisted TREE swap.');
  const evidence = eventNodes.map((value) => parseSwapEvent(value, buyer)).filter((value): value is SwapEvidence => Boolean(value));
  if (evidence.length !== 1 || evidence[0].route !== swapCalls[0]) throw new Error('The allowlisted swap event could not be uniquely verified.');

  const requiredPool = evidence[0].route === 'suidex-v2' ? SUIDEX_V2_TREE_POOL
    : evidence[0].route === 'suidex-v3' ? SUIDEX_V3_TREE_POOL : TURBOS_SUI_TREE_POOL;
  if (!containsPool(node.transactionJson, requiredPool)) throw new Error('The swap did not use the exact allowlisted SUI/TREE pool.');

  let suiDelta = 0n;
  let treeDelta = 0n;
  for (const value of Array.isArray(balances.nodes) ? balances.nodes : []) {
    const change = record(value);
    if (normalizeAddress(record(change.owner).address) !== buyer) continue;
    const amount = parseSigned(change.amount);
    if (amount === null) throw new Error('Transaction balance evidence is malformed.');
    const coinType = normalizeMoveType(record(change.coinType).repr);
    if (coinType === NORMAL_SUI) suiDelta += amount;
    if (coinType === NORMAL_TREE) treeDelta += amount;
  }
  if (treeDelta !== evidence[0].output || suiDelta > -evidence[0].input) {
    throw new Error('Sender balance changes do not reconcile with the verified swap event.');
  }

  return {
    txDigest: digest,
    buyer,
    route: evidence[0].route,
    suiSpentRaw: evidence[0].input.toString(),
    treeAmountRaw: evidence[0].output.toString(),
    finalizedCheckpoint: Number(checkpointRaw),
    finalizedAt,
    raffleDate: newYorkDate(finalizedAt),
  };
}

export async function fetchFinalizedTreeBuy(
  digest: string,
  options: { fetchImpl?: typeof fetch; endpoint?: string; timeoutMs?: number } = {},
): Promise<FinalizedTreeBuy> {
  if (!DIGEST_PATTERN.test(digest)) throw new Error('A valid Sui transaction digest is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(options.endpoint ?? SUI_GRAPHQL_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TREE_RAFFLE_BUY_QUERY, variables: { digest } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Sui transaction verification returned ${response.status}.`);
    const payload = record(await response.json());
    if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui transaction verification returned a GraphQL error.');
    const transaction = record(record(payload.data).transaction);
    if (!Object.keys(transaction).length) throw new Error('The Sui transaction was not found or is not finalized.');
    return verifyFinalizedTreeBuyNode(transaction, digest);
  } finally {
    clearTimeout(timeout);
  }
}
