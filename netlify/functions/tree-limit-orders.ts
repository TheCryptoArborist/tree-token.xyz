import { Aftermath } from 'aftermath-ts-sdk';
import {
  assertAllowedTreeLimitTransaction,
  assertTreeLimitAccountProof,
  assertTreeLimitCancelProof,
  isTreeLimitOrder,
  jsonSafeTreeLimitOrder,
  normalizeSuiAddress,
  record,
  validateTreeLimitCreate,
  validateTreeLimitOrderId,
  validateTreeLimitProof,
} from '../lib/tree-limit-orders.ts';

const MAX_BODY_BYTES = 8_192;
const PREVIEW_HOST = /^deploy-preview-\d+--tree-token\.netlify\.app$/;
let sdkPromise: Promise<Aftermath> | null = null;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (url.hostname === 'tree-token.xyz' || url.hostname === 'www.tree-token.xyz' || PREVIEW_HOST.test(url.hostname))
      || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function sdk() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    sdkPromise ||= Aftermath.create({ network: 'MAINNET' });
    try { return await sdkPromise; } catch (error) {
      sdkPromise = null;
      if (attempt === 1) throw error;
    }
  }
  throw new Error('Aftermath Mainnet initialization failed.');
}

async function retrySafeAftermath<T>(operation: (aftermath: Aftermath) => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await operation(await sdk()); } catch (error) {
      lastError = error;
      sdkPromise = null;
    }
  }
  throw lastError;
}

async function body(request: Request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new Error('Request body is too large.');
  const text = await request.text();
  if (!text || text.length > MAX_BODY_BYTES) throw new Error('Request body is invalid.');
  return record(JSON.parse(text));
}

function orders(values: unknown, walletAddress: string) {
  return (Array.isArray(values) ? values : [])
    .filter((order) => isTreeLimitOrder(order) && normalizeSuiAddress(record(order).recipient) === walletAddress)
    .map(jsonSafeTreeLimitOrder).filter(Boolean);
}

export default async (request: Request) => {
  if (!allowedOrigin(request)) return json({ status: 'error', error: 'origin-not-allowed' }, 403);
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  try {
    if (request.method === 'GET' && action === 'config') {
      const config = await retrySafeAftermath(async (aftermath) => {
        const [minOrderSizeUsd, coinPricesUsd] = await Promise.all([
          aftermath.LimitOrders().getMinOrderSizeUsd(),
          aftermath.Prices().getCoinsToPrice({ coins: [TREE_LIMIT_SUI_TYPE, TREE_LIMIT_TREE_TYPE] }),
        ]);
        return { minOrderSizeUsd, coinPricesUsd };
      });
      return json({ status: 'ok', provider: 'Aftermath Mainnet', ...config });
    }
    if (request.method === 'GET' && action === 'past') {
      const walletAddress = normalizeSuiAddress(url.searchParams.get('owner'));
      if (!walletAddress) return json({ status: 'error', error: 'invalid-owner' }, 400);
      const values = await retrySafeAftermath((aftermath) => aftermath.LimitOrders().getPastLimitOrders({ walletAddress }));
      return json({ status: 'ok', orders: orders(values, walletAddress) });
    }
    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
    const input = await body(request);
    if (action === 'user-key') {
      const walletAddress = normalizeSuiAddress(input.walletAddress);
      if (!walletAddress) return json({ status: 'error', error: 'invalid-owner' }, 400);
      const publicKey = await retrySafeAftermath((aftermath) => aftermath.UserData().getUserPublicKey({ walletAddress }));
      return json({ status: 'ok', registered: Boolean(publicKey) });
    }
    if (action === 'register-user') {
      const proof = validateTreeLimitProof(input);
      assertTreeLimitAccountProof(proof.bytes);
      const aftermath = await sdk();
      const registered = await aftermath.UserData().createUserPublicKey(proof);
      return json({ status: registered ? 'ok' : 'error', registered: Boolean(registered) }, registered ? 200 : 502);
    }
    if (action === 'create') {
      const validated = validateTreeLimitCreate(input);
      const transaction = await retrySafeAftermath((aftermath) => aftermath.LimitOrders().getCreateLimitOrderTx({
        walletAddress: validated.walletAddress,
        allocateCoinType: validated.allocateCoinType,
        allocateCoinAmount: validated.allocateCoinAmount,
        buyCoinType: validated.buyCoinType,
        expiryDurationMs: validated.expiryDurationMs,
        outputToInputExchangeRate: validated.outputToInputExchangeRate,
        outputToInputStopLossExchangeRate: 0,
        isSponsoredTx: false,
      }));
      assertAllowedTreeLimitTransaction(transaction, validated);
      return json({
        status: 'ok',
        transaction: transaction.serialize(),
        order: {
          walletAddress: validated.walletAddress,
          direction: validated.direction,
          allocateCoinType: validated.allocateCoinType,
          buyCoinType: validated.buyCoinType,
          allocateCoinAmount: validated.allocateCoinAmount.toString(),
          targetPriceSuiPerTree: validated.targetPriceSuiPerTree,
          expiryDurationMs: validated.expiryDurationMs,
        },
      });
    }
    if (action === 'active') {
      const proof = validateTreeLimitProof(input);
      assertTreeLimitAccountProof(proof.bytes);
      const values = await retrySafeAftermath((aftermath) => aftermath.LimitOrders().getActiveLimitOrders(proof));
      return json({ status: 'ok', orders: orders(values, proof.walletAddress) });
    }
    if (action === 'cancel') {
      const proof = validateTreeLimitProof(input);
      const orderId = validateTreeLimitOrderId(input.orderId);
      assertTreeLimitCancelProof(proof.bytes, orderId);
      const aftermath = await sdk();
      const canceled = await aftermath.LimitOrders().cancelLimitOrder(proof);
      return json({ status: canceled ? 'ok' : 'error', canceled: Boolean(canceled) }, canceled ? 200 : 502);
    }
    return json({ status: 'error', error: 'unknown-action' }, 400);
  } catch (error) {
    console.error('TREE limit-order request failed', error);
    const message = error instanceof Error && /^(A valid|Allocated|Choose|Enter|Limit|Target|Unexpected)/.test(error.message)
      ? error.message
      : 'The TREE limit-order service could not complete this request.';
    const retryable = ['config', 'past', 'user-key', 'create', 'active'].includes(action);
    return json({ status: 'error', error: 'limit-order-unavailable', stage: action || 'service', retryable, message }, 502);
  }
};

export const config = { path: '/api/tree-limit-orders' };
