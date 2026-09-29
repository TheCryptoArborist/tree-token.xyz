import { Transaction } from '@mysten/sui/transactions';
import { SUI, TREE, amountToRaw } from '../../gateway/options.js';
import { suiReviewAddress } from '../../gateway/review-core.js';
import { normalizeTreeSwapQuote, normalizeMoveType, TURBOS_SUI_TREE_POOL, TURBOS_SUI_TREE_FEE_TYPE } from './tree-swap-route.ts';

const PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
const VERSIONED = '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f';
export function simulationInput(input: any) {
  const address = suiReviewAddress({ connected: true, address: input?.address });
  if (!address || typeof input?.amount !== 'string' || Object.keys(input).some(key => !['address', 'amount'].includes(key))) throw Error('Invalid simulation request');
  const raw = amountToRaw(input.amount, 9);
  if (BigInt(raw) > 1_000_000_000_000n) throw Error('Simulation limit is 1,000 SUI');
  return { address, raw, amount: input.amount };
}
export function simulationTransaction(address: string, raw: string, route: any) {
  const verified = normalizeTreeSwapQuote({}, { tokenIn: SUI, tokenOut: TREE, amountIn: raw, slippageBps: 100 }, [route]).selectedRoute;
  if (BigInt(verified.minAmountOut) < BigInt(verified.amountOut) * 9900n / 10000n) throw Error('Slippage limit exceeded');
  const tx = new Transaction();
  tx.setSender(address);
  const [input] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(raw))]);
  tx.moveCall({
    target: `${PACKAGE}::swap_router::${verified.aToB ? 'swap_a_b' : 'swap_b_a'}`,
    typeArguments: [verified.coinAType!, verified.coinBType!, TURBOS_SUI_TREE_FEE_TYPE],
    arguments: [tx.object(TURBOS_SUI_TREE_POOL), tx.makeMoveVec({ elements: [input] }), tx.pure.u64(BigInt(raw)),
      tx.pure.u64(BigInt(verified.minAmountOut)), tx.pure.u128(verified.aToB ? 4_295_048_016n : 79_226_673_515_401_279_992_447_579_055n),
      tx.pure.bool(true), tx.pure.address(address), tx.pure.u64(BigInt(Date.now() + 60_000)), tx.object('0x6'), tx.object(VERSIONED)],
  });
  return tx;
}
function decimal(raw: bigint, decimals: number) {
  const sign = raw < 0n ? '-' : '';
  const text = (raw < 0n ? -raw : raw).toString().padStart(decimals + 1, '0');
  return sign + text.slice(0, -decimals) + '.' + text.slice(-decimals);
}
export function simulationSummary(result: any, address: string, amount: string, minimum: string) {
  const tx = result?.$kind === 'Transaction' ? result.Transaction : null;
  if (!tx || tx.effects?.status?.success !== true) throw Error('Simulation failed');
  const change = (tx.balanceChanges || []).filter(c => c.address?.toLowerCase() === address && normalizeMoveType(c.coinType) === normalizeMoveType(TREE));
  const received = change.reduce((sum, c) => sum + BigInt(c.amount), 0n);
  if (received < BigInt(minimum)) throw Error('TREE output below minimum');
  const gas = tx.effects.gasUsed;
  for (const key of ['computationCost', 'storageCost', 'storageRebate']) if (!/^\d{1,20}$/.test(gas?.[key] || '')) throw Error('Missing gas effects');
  return { status: 'passed', scope: 'Turbos SUI to TREE only', address, amount, receivedTree: decimal(received, 6), netGasSui: decimal(BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate), 9), checkedAt: new Date().toISOString(), signed: false, submitted: false, bridgeSimulated: false, gatewayFeeIncluded: false };
}
