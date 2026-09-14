import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { quoteTurbosTreeSwap } from '../netlify/lib/turbos-tree-swap.ts';
import {
  SUI_TYPE,
  TREE_TYPE,
  TURBOS_SUI_TREE_FEE_TYPE,
  TURBOS_SUI_TREE_POOL,
} from '../netlify/lib/tree-swap-route.ts';

const TURBOS_PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
const TURBOS_VERSIONED = '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f';
const CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
const owner = process.argv[2];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Usage: node scripts/simulate-tree-turbos-swap.mjs <owner>');

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });

function normalizeType(value) {
  const parts = String(value || '').split('::');
  const address = (parts.shift() || '').toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}::${parts.join('::')}`.toLowerCase();
}

async function getAllCoins(coinType) {
  const coins = [];
  let cursor = null;
  do {
    const page = await client.core.listCoins({ owner, coinType, cursor, limit: 50 });
    coins.push(...(page.objects || []));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return coins.filter((coin) => BigInt(coin.balance || '0') > 0n);
}

async function inputCoin(transaction, coinType, amount) {
  if (normalizeType(coinType) === normalizeType(SUI_TYPE)) {
    const [coin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(amount)]);
    return coin;
  }
  const coins = (await getAllCoins(coinType)).sort((left, right) => BigInt(right.balance || '0') > BigInt(left.balance || '0') ? 1 : -1);
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin);
    total += BigInt(coin.balance || '0');
    if (total >= amount) break;
  }
  if (total < amount) throw new Error('Insufficient TREE balance for the Turbos simulation.');
  const primary = transaction.object(selected[0].objectId);
  const remainder = selected.slice(1).map((coin) => transaction.object(coin.objectId));
  for (let index = 0; index < remainder.length; index += 200) transaction.mergeCoins(primary, remainder.slice(index, index + 200));
  const [coin] = transaction.splitCoins(primary, [transaction.pure.u64(amount)]);
  transaction.transferObjects([primary], owner);
  return coin;
}

async function build(route) {
  const amountIn = BigInt(route.amountIn);
  const transaction = new Transaction();
  transaction.setSender(owner);
  const input = await inputCoin(transaction, route.tokenIn, amountIn);
  const inputVector = transaction.makeMoveVec({ elements: [input] });
  const sqrtPriceLimit = route.aToB ? 4_295_048_016n : 79_226_673_515_401_279_992_447_579_055n;
  transaction.moveCall({
    target: `${TURBOS_PACKAGE}::swap_router::${route.aToB ? 'swap_a_b' : 'swap_b_a'}`,
    typeArguments: [route.coinAType, route.coinBType, TURBOS_SUI_TREE_FEE_TYPE],
    arguments: [
      transaction.object(TURBOS_SUI_TREE_POOL), inputVector, transaction.pure.u64(amountIn),
      transaction.pure.u64(BigInt(route.minAmountOut)), transaction.pure.u128(sqrtPriceLimit),
      transaction.pure.bool(true), transaction.pure.address(owner), transaction.pure.u64(BigInt(Date.now() + 180_000)),
      transaction.object(CLOCK), transaction.object(TURBOS_VERSIONED),
    ],
  });
  return transaction;
}

function succeeded(result) {
  const core = result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction;
  return core?.effects?.status?.success === true;
}

const requests = [
  { label: 'SUI_TO_TREE', tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '1000000000', slippageBps: 100 },
  { label: 'TREE_TO_SUI', tokenIn: TREE_TYPE, tokenOut: SUI_TYPE, amountIn: '10000000000', slippageBps: 100 },
];
const results = [];
for (const request of requests) {
  const route = await quoteTurbosTreeSwap(request);
  if (route.pairId !== TURBOS_SUI_TREE_POOL || route.executionKind !== 'turbos-direct') throw new Error(`${request.label} returned an unexpected route.`);
  const transaction = await build(route);
  const bytes = await transaction.build({ client });
  for (let pass = 1; pass <= 2; pass += 1) {
    const simulation = await client.core.simulateTransaction({ transaction: bytes, checksEnabled: true, include: { effects: true, balanceChanges: true, events: true } });
    if (!succeeded(simulation)) {
      const core = simulation?.$kind === 'Transaction' ? simulation.Transaction : simulation?.Transaction;
      throw new Error(`${request.label} simulation ${pass} failed: ${JSON.stringify(simulation?.FailedTransaction?.status?.error || core?.effects?.status?.error || null)}`);
    }
  }
  results.push({ direction: request.label, amountIn: route.amountIn, amountOut: route.amountOut, minAmountOut: route.minAmountOut, simulations: 2 });
}

console.log(JSON.stringify({ classification: 'TREE_TURBOS_DIRECT_SWAP_SIMULATIONS_VALID', owner, pool: TURBOS_SUI_TREE_POOL, results, signed: false, submitted: false }, null, 2));
