export const TREE_GATEWAY = Object.freeze({
  mayanSdkVersion: '15.2.2',
  referralBps: 25,
  quoteMaxAgeMs: 30_000,
  destinationChain: 'sui',
  defaultDestination: 'TREE',
});

export const SUI_USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const SUI_TYPE = '0x2::sui::SUI';
export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';

export const V1_SOURCE_CHAINS = Object.freeze(['base', 'ethereum', 'solana']);

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function assertSupportedSourceChain(chain) {
  const normalized = String(chain || '').trim().toLowerCase();
  if (!V1_SOURCE_CHAINS.includes(normalized)) {
    throw new Error('TREE Gateway v1 supports Base, Ethereum, and Solana as source chains.');
  }
  return normalized;
}

export function normalizeSuiCoinType(value) {
  const parts = String(value || '').trim().split('::');
  if (parts.length < 3) throw new Error('Invalid Sui coin type.');
  const address = parts.shift().toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}::${parts.join('::')}`.toLowerCase();
}

export function classifyDestination({ coinType, mayanDirectSupported }) {
  const normalized = normalizeSuiCoinType(coinType);
  const isTree = normalized === normalizeSuiCoinType(TREE_TYPE);
  if (mayanDirectSupported) return { mode: 'MAYAN_DIRECT', coinType: normalized, isTree };
  if (isTree) return { mode: 'MAYAN_TO_SUI_THEN_TREE_ROUTER', coinType: normalized, isTree: true };
  return { mode: 'MAYAN_SETTLEMENT_THEN_SUI_SWAP', coinType: normalized, isTree: false };
}

export function buildMayanQuoteRequest({
  fromChain,
  fromToken,
  amountIn64,
  toToken,
  destinationAddress,
  referrer,
  gasDrop,
}) {
  const source = assertSupportedSourceChain(fromChain);
  const amount = positiveInteger(amountIn64);
  if (!amount) throw new Error('A positive base-unit source amount is required.');
  if (!String(fromToken || '').trim()) throw new Error('A source token is required.');
  if (!String(toToken || '').trim()) throw new Error('A verified Sui destination token is required.');
  if (!/^0x[0-9a-f]{64}$/i.test(String(destinationAddress || ''))) throw new Error('A valid Sui destination wallet is required.');

  return {
    amountIn64: String(amountIn64),
    fromToken: String(fromToken),
    fromChain: source,
    toToken: String(toToken),
    toChain: TREE_GATEWAY.destinationChain,
    slippageBps: 'auto',
    destinationAddress,
    referrer: referrer || undefined,
    referrerBps: TREE_GATEWAY.referralBps,
    gasDrop: Number.isFinite(Number(gasDrop)) && Number(gasDrop) > 0 ? Number(gasDrop) : undefined,
  };
}

export function validateMayanQuote(quote, request, now = Date.now()) {
  if (!quote || typeof quote !== 'object') throw new Error('Mayan quote is unavailable.');
  if (String(quote.fromChain || '').toLowerCase() !== request.fromChain) throw new Error('Mayan quote source chain mismatch.');
  if (String(quote.toChain || '').toLowerCase() !== 'sui') throw new Error('Mayan quote destination must be Sui.');
  if (String(quote.fromToken?.contract || quote.fromToken || '').toLowerCase() !== String(request.fromToken).toLowerCase()) throw new Error('Mayan quote source token mismatch.');
  const quoteTo = quote.toToken?.contract || quote.toToken?.verifiedAddress || quote.toToken;
  if (!quoteTo) throw new Error('Mayan quote has no verified destination token.');
  if (String(quoteTo).toLowerCase() !== String(request.toToken).toLowerCase()) throw new Error('Mayan quote destination token mismatch.');
  const expiresAt = Date.parse(quote.expiresAt || quote.deadline || '');
  if (Number.isFinite(expiresAt) && expiresAt <= now) throw new Error('Mayan quote is stale.');
  const expected = Number(quote.expectedAmountOut ?? quote.minAmountOut);
  if (!Number.isFinite(expected) || expected <= 0) throw new Error('Mayan quote has no positive output.');
  return quote;
}

export function buildGatewayPlan({ mayanQuote, destinationCoinType, mayanDirectSupported }) {
  const destination = classifyDestination({ coinType: destinationCoinType, mayanDirectSupported });
  return Object.freeze({
    source: 'MAYAN',
    destinationChain: 'sui',
    destination,
    mayanQuote,
    requiresSuiFollowup: destination.mode !== 'MAYAN_DIRECT',
    requiresTreeSmartRouter: destination.mode === 'MAYAN_TO_SUI_THEN_TREE_ROUTER',
    referralBps: TREE_GATEWAY.referralBps,
  });
}
