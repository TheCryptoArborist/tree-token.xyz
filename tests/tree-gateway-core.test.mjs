import assert from 'node:assert/strict';
import {
  TREE_GATEWAY,
  SUI_USDC_TYPE,
  TREE_TYPE,
  V1_SOURCE_CHAINS,
  buildMayanQuoteRequest,
  validateMayanQuote,
  classifyDestination,
  buildGatewayPlan,
} from '../dapp/tree-gateway-core.js';

assert.deepEqual(V1_SOURCE_CHAINS, ['base', 'ethereum', 'solana']);
assert.equal(TREE_GATEWAY.referralBps, 25);
assert.equal(TREE_GATEWAY.defaultDestination, 'TREE');
assert.equal(SUI_USDC_TYPE, '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC');

const destinationAddress = '0x' + '1'.repeat(64);
const request = buildMayanQuoteRequest({
  fromChain: 'base',
  fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  amountIn64: '250000000',
  toToken: SUI_USDC_TYPE,
  destinationAddress,
  referrer: 'TREE_REFERRER_PLACEHOLDER',
  gasDrop: 0.01,
});
assert.equal(request.toChain, 'sui');
assert.equal(request.referrerBps, 25);
assert.equal(request.slippageBps, 'auto');

assert.throws(() => buildMayanQuoteRequest({
  fromChain: 'bsc',
  fromToken: 'x',
  amountIn64: '1',
  toToken: SUI_USDC_TYPE,
  destinationAddress,
}), /supports Base, Ethereum, and Solana/);

const quote = {
  fromChain: 'base',
  toChain: 'sui',
  fromToken: { contract: request.fromToken },
  toToken: { contract: SUI_USDC_TYPE, verifiedAddress: SUI_USDC_TYPE },
  expectedAmountOut: 249,
};
assert.equal(validateMayanQuote(quote, request), quote);
assert.throws(() => validateMayanQuote({ ...quote, toChain: 'solana' }, request), /destination must be Sui/);
assert.throws(() => validateMayanQuote({ ...quote, expectedAmountOut: 0 }, request), /positive output/);

const directTree = classifyDestination({ coinType: TREE_TYPE, mayanDirectSupported: true });
assert.equal(directTree.mode, 'MAYAN_DIRECT');
assert.equal(directTree.isTree, true);

const routedTree = classifyDestination({ coinType: TREE_TYPE, mayanDirectSupported: false });
assert.equal(routedTree.mode, 'MAYAN_TO_SUI_THEN_TREE_ROUTER');

const routedOther = classifyDestination({ coinType: SUI_USDC_TYPE, mayanDirectSupported: false });
assert.equal(routedOther.mode, 'MAYAN_SETTLEMENT_THEN_SUI_SWAP');

const plan = buildGatewayPlan({ mayanQuote: quote, destinationCoinType: TREE_TYPE, mayanDirectSupported: false });
assert.equal(plan.requiresSuiFollowup, true);
assert.equal(plan.requiresTreeSmartRouter, true);
assert.equal(plan.referralBps, 25);

console.log('TREE Gateway core: PASS');
