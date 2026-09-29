import { decodeFunctionData, encodeFunctionData, parseAbi } from 'viem';
import { SOURCES, SUI, USDC, amountToRaw } from '../../gateway/options.js';
import { isEvmAddress, suiReviewAddress } from '../../gateway/review-core.js';
import { BASE_RPC, FORWARDER, json, rpc, quantity, mayanBaseChecks } from './gateway-bridge-review.ts';

export const FORWARD_ABI = parseAbi(['function forwardERC20(address tokenIn,uint256 amountIn,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitParams,address mayanProtocol,bytes protocolData) payable', 'function mayanProtocols(address protocol) view returns (bool)']);
export const ORDER_ABI = parseAbi(['function createOrder((address tokenIn,uint256 amountIn,uint64 gasDrop,bytes32 destAddr,uint16 destChain,bytes32 tokenOut,uint64 minAmountOut,uint64 deadline,uint64 redeemFee,bytes32 referrerAddr,uint8 referrerBps) params) payable']);
const BASE_USDC = SOURCES.base.USDC[0];
const ZERO32 = '0x' + '0'.repeat(64);
const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
function check(ok: unknown) { if (!ok) throw Error('Unsupported or invalid Mayan simulation input.'); }
export function mayanInput(value: any) {
  check(value && Object.keys(value).sort().join(',') === 'address,amountRaw,recipient');
  check(isEvmAddress(value.address) && suiReviewAddress({ connected: true, address: value.recipient }));
  check(typeof value.amountRaw === 'string' && /^[1-9]\d{0,12}$/.test(value.amountRaw) && BigInt(value.amountRaw) <= 1000000000000n);
  return { address: value.address.toLowerCase(), recipient: value.recipient.toLowerCase(), amountRaw: value.amountRaw };
}
export function verifyMayanQuote(q: any, tokenCatalog: any, input: ReturnType<typeof mayanInput>, now = Date.now()) {
  check(q?.type === 'MCTP' && q.fromChain === 'base' && q.toChain === 'sui' && q.gasless === false && q.hasAuction === true && q.onlyBridging === false);
  check(same(q.fromToken?.contract, BASE_USDC) && q.fromToken.chainId === 8453 && q.fromToken.wChainId === 30 && q.fromToken.decimals === 6);
  check(q.toToken?.contract === SUI && q.toToken.wChainId === 21 && q.toToken.decimals === 9 && q.effectiveAmountIn64 === input.amountRaw);
  check(same(q.mctpInputContract, BASE_USDC) && q.mctpOutputContract === USDC && isEvmAddress(q.mctpMayanContract));
  check(q.referrerBps === 0 && q.gasDrop === 0 && q.bridgeFee === 0 && q.slippageBps === 100);
  const tokens = Array.isArray(tokenCatalog) ? tokenCatalog : tokenCatalog?.sui;
  const sui = tokens?.find(t => t.contract === SUI && t.decimals === 9 && t.wChainId === 21);
  check(sui && /^0x[0-9a-f]{64}$/i.test(sui.verifiedAddress) && same(q.toToken.verifiedAddress, sui.verifiedAddress));
  check(typeof q.deadline64 === 'string' && /^\d{1,12}$/.test(q.deadline64) && Number(q.deadline64)*1000 > now);
  const expected = BigInt(amountToRaw(String(q.expectedAmountOut), 9)), minimum = BigInt(amountToRaw(String(q.minAmountOut), 9));
  check(minimum > 0n && minimum <= expected && minimum >= expected*99n/100n);
  const redeemFee = amountToRaw(String(q.redeemRelayerFee), 6);
  check(q.redeemRelayerFee64 === redeemFee && BigInt(redeemFee) < BigInt(input.amountRaw));
  // MCTP encodes destination amounts at at most eight decimals. Validate that exact floor.
  return { protocol: q.mctpMayanContract.toLowerCase(), tokenOut: sui.verifiedAddress.toLowerCase(), minimumNormalized: minimum/10n, minimumSuiRaw: (minimum/10n*10n).toString(), redeemFee, deadline: q.deadline64, expiresAt: Math.min(now+30000, Number(q.deadline64)*1000) };
}
export function verifyMayanPayload(payload: any, input: ReturnType<typeof mayanInput>, quote: ReturnType<typeof verifyMayanQuote>) {
  check(payload?.chainId === 8453 && same(payload.to, FORWARDER) && BigInt(payload.value) === 0n && typeof payload.data === 'string' && payload.data.length < 10000);
  const outer = decodeFunctionData({ abi: FORWARD_ABI, data: payload.data });
  check(outer.functionName === 'forwardERC20');
  if (outer.functionName !== 'forwardERC20') throw Error();
  const [token, amount, permit, protocol, data] = outer.args;
  check(same(token, BASE_USDC) && amount === BigInt(input.amountRaw) && same(protocol, quote.protocol));
  check(permit.value === 0n && permit.deadline === 0n && permit.v === 0 && same(permit.r, ZERO32) && same(permit.s, ZERO32));
  const inner = decodeFunctionData({ abi: ORDER_ABI, data });
  const order = inner.args[0];
  check(inner.functionName === 'createOrder' && same(order.tokenIn, BASE_USDC) && order.amountIn === BigInt(input.amountRaw));
  check(same(order.destAddr, input.recipient) && order.destChain === 21 && same(order.tokenOut, quote.tokenOut));
  check(order.minAmountOut === quote.minimumNormalized && order.minAmountOut > 0n && order.deadline === BigInt(quote.deadline) && order.redeemFee === BigInt(quote.redeemFee));
  check(order.gasDrop === 0n && order.referrerBps === 0 && same(order.referrerAddr, ZERO32));
  // Re-encoding also rejects trailing or non-canonical calldata.
  check(same(encodeFunctionData({ abi: ORDER_ABI, functionName: 'createOrder', args: [order] }), data));
  check(same(encodeFunctionData({ abi: FORWARD_ABI, functionName: 'forwardERC20', args: outer.args }), payload.data));
  return { from: input.address, to: FORWARDER, value: '0x0', data: payload.data };
}
export async function buildMayanPayload(q: any, input: ReturnType<typeof mayanInput>) {
  // Preserve the SDK's ESM entry point in Netlify's CommonJS function bundle.
  const { getMctpFromEvmTxPayload } = await import('@mayanfinance/swap-sdk');
  return getMctpFromEvmTxPayload(q, input.recipient, null, 8453, null, null);
}

export async function simulateMayan(input: ReturnType<typeof mayanInput>, deps = { json, rpc, buildMayanPayload, mayanBaseChecks }) {
  const started = Date.now();
  const query = new URLSearchParams({ fromChain: 'base', fromToken: BASE_USDC, toChain: 'sui', toToken: SUI, amountIn64: input.amountRaw, slippageBps: '100', swift: 'false', mctp: 'true', fastMctp: 'false', wormhole: 'false', gasless: 'false', sdkVersion: '15_2_2', referrerBps: '0', destinationAddress: input.recipient });
  const [body, catalog] = await Promise.all([deps.json('https://price-api.mayan.finance/v3/quote?'+query), deps.json('https://price-api.mayan.finance/v3/tokens?chain=sui')]);
  const candidates = (Array.isArray(body.quotes) ? body.quotes : []).flatMap(q => { try { return [{ q, review: verifyMayanQuote(q,catalog,input,started) }]; } catch { return []; } });
  check(candidates.length);
  const { q, review } = candidates[0];
  const payload = await deps.buildMayanPayload(q,input);
  const transaction = verifyMayanPayload(payload,input,review);
  check(quantity(await deps.rpc(BASE_RPC,'eth_chainId',[])) === 8453n);
  const [allowed, code, funds] = await Promise.all([
    deps.rpc(BASE_RPC,'eth_call',[{to:FORWARDER,data:encodeFunctionData({abi:FORWARD_ABI,functionName:'mayanProtocols',args:[review.protocol as `0x${string}`]})},'latest']),
    deps.rpc(BASE_RPC,'eth_getCode',[FORWARDER,'latest']),
    deps.mayanBaseChecks(input.address,input.amountRaw),
  ]);
  check(quantity(allowed) === 1n && /^0x[0-9a-f]+$/i.test(code) && !/^0x0*$/i.test(code) && Date.now()<review.expiresAt);
  const summary = { ...input, protocol: 'MCTP', scope: 'Base USDC to SUI source transaction only', payloadVerified: true, expiresAt: review.expiresAt, minimumSuiRaw: review.minimumSuiRaw, funds, signed: false, submitted: false, destinationFillSimulated: false, routeReady: false };
  if (!funds.baseEthPresent || !funds.existingUsdcEnough || !funds.existingAllowanceEnough) return { ...summary, status:'blocked', simulated:false };
  const [gasHex, priceHex, balanceHex] = await Promise.all([
    deps.rpc(BASE_RPC,'eth_estimateGas',[transaction,'latest']),
    deps.rpc(BASE_RPC,'eth_gasPrice',[]),
    deps.rpc(BASE_RPC,'eth_getBalance',[input.address,'latest']),
  ]);
  const gas = quantity(gasHex), price = quantity(priceHex);
  check(gas > 0n && gas <= 30000000n && price > 0n && quantity(balanceHex) >= gas*price && Date.now()<review.expiresAt);
  return { ...summary, status:'passed', simulated:true, gasUnits:gas.toString(), executionGasEstimateRaw:(gas*price).toString(), l1FeeIncluded:false };
}
