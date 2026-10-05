import { getOrderId } from '@relay-protocol/settlement-sdk/dist/order/index.js';
import { decodeFunctionData, encodeFunctionData, parseAbi } from 'viem';
import { amountToRaw, SOURCES } from '../../gateway/options.js';
import { isEvmAddress } from '../../gateway/review-core.js';

export const NETWORKS = {
  bsc: { id: 56, protocol: 'bnb', rpc: 'https://bsc-dataseed.bnbchain.org', symbol: 'BNB' },
  robinhood: { id: 4663, protocol: 'robinhood', rpc: 'https://rpc.mainnet.chain.robinhood.com', symbol: 'ETH' },
};
export const BASE_RPC = 'https://mainnet.base.org';
export const FORWARDER = '0x337685fdab40d39bd02028545a4ffa7d287cc3e2';
const ZERO = '0x0000000000000000000000000000000000000000';
const BASE_USDC = SOURCES.base.USDC[0];
const ABI = parseAbi(['function depositNative(address depositor, bytes32 id)']);
const ERC20 = parseAbi(['function balanceOf(address owner) view returns (uint256)', 'function allowance(address owner,address spender) view returns (uint256)']);
const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const uint = (v: unknown) => typeof v === 'string' && /^(0|[1-9]\d{0,77})$/.test(v) && BigInt(v) < 2n ** 256n;
function requireThat(ok: unknown) { if (!ok) throw Error('Bridge verification unavailable.'); }
export function bridgeInput(value: any) {
  requireThat(value && Object.keys(value).sort().join(',') === 'address,amount,chain' && Object.hasOwn(NETWORKS, value.chain) && isEvmAddress(value.address));
  const raw = amountToRaw(value.amount, 18);
  requireThat(BigInt(raw) > 0n && BigInt(raw) <= 100n * 10n ** 18n);
  return { chain: value.chain as keyof typeof NETWORKS, address: value.address.toLowerCase(), amount: value.amount, raw };
}

// Follow Relay's protocol-v2 input verification, not the quote's own target claim.
export function verifyRelay(q: any, chains: any[], input: ReturnType<typeof bridgeInput>, now = Date.now()) {
  const network = NETWORKS[input.chain];
  const source = chains.find(c => c.id === network.id);
  const base = chains.find(c => c.id === 8453);
  requireThat(source?.vmType === 'evm' && base?.vmType === 'evm' && source.protocol?.v2?.chainId === network.protocol && base.protocol?.v2?.chainId === 'base');
  const depository = source.protocol.v2.depository;
  requireThat(isEvmAddress(depository));
  const v2 = q?.protocol?.v2, order = v2?.orderData;
  requireThat(v2?.hubType === 'onchain' && order?.version === 'v1' && order.solverChainId === 'base');
  requireThat(order.inputs?.length === 1 && order.output?.payments?.length === 1 && order.output.calls?.length === 0 && order.fees?.length === 0);
  const payment = order.inputs[0].payment, output = order.output.payments[0];
  requireThat(payment.chainId === network.protocol && same(payment.currency, ZERO) && payment.amount === input.raw && payment.weight === '1');
  requireThat(order.output.chainId === 'base' && same(output.recipient, input.address) && same(output.currency, BASE_USDC));
  requireThat(uint(output.minimumAmount) && uint(output.expectedAmount) && BigInt(output.minimumAmount) > 0n && BigInt(output.minimumAmount) <= BigInt(output.expectedAmount) && BigInt(output.minimumAmount) >= BigInt(output.expectedAmount) * 99n / 100n);
  requireThat(Number.isSafeInteger(order.output.deadline) && order.output.deadline * 1000 > now);
  requireThat(Array.isArray(order.inputs[0].refunds) && order.inputs[0].refunds.length > 0 && order.inputs[0].refunds.every(r => same(r.recipient, input.address) && ((r.chainId === network.protocol && same(r.currency, ZERO)) || (r.chainId === 'base' && same(r.currency, BASE_USDC)))));
  const id = getOrderId(order, { [network.protocol]: 'ethereum-vm', base: 'ethereum-vm' });
  requireThat(same(v2.orderId, id));
  requireThat(v2.paymentDetails?.chainId === network.protocol && same(v2.paymentDetails.depository, depository) && same(v2.paymentDetails.currency, ZERO) && v2.paymentDetails.amount === input.raw);
  requireThat(q.steps?.length === 1 && q.steps[0].kind === 'transaction' && q.steps[0].items?.length === 1);
  const tx = q.steps[0].items[0].data;
  requireThat(tx?.chainId === network.id && same(tx.from, input.address) && same(tx.to, depository) && tx.value === input.raw);
  requireThat(typeof tx.data === 'string' && /^0x[0-9a-f]{136}$/i.test(tx.data));
  const decoded = decodeFunctionData({ abi: ABI, data: tx.data });
  requireThat(decoded.functionName === 'depositNative' && same(decoded.args[0], input.address) && same(decoded.args[1], id));
  return { transaction: { from: input.address, to: depository.toLowerCase(), data: tx.data, value: `0x${BigInt(input.raw).toString(16)}` }, minimumBaseUsdcRaw: output.minimumAmount, expiresAt: Math.min(now + 30000, order.output.deadline * 1000) };
}

export async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
  requireThat(response.ok);
  return response.json();
}
const METHODS = new Set(['eth_chainId', 'eth_getBalance', 'eth_getCode', 'eth_estimateGas', 'eth_gasPrice', 'eth_call']);
export async function rpc(url: string, method: string, params: unknown[]) {
  requireThat([BASE_RPC, ...Object.values(NETWORKS).map(n => n.rpc)].includes(url) && METHODS.has(method));
  const data = await json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  requireThat(data.jsonrpc === '2.0' && data.id === 1 && !data.error && typeof data.result === 'string' && /^0x[0-9a-f]*$/i.test(data.result));
  return data.result;
}
export function quantity(value: unknown) {
  requireThat(typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value));
  return BigInt(value as string);
}
export async function sourceSimulation(input: ReturnType<typeof bridgeInput>, review: ReturnType<typeof verifyRelay>, read = rpc) {
  const net = NETWORKS[input.chain];
  requireThat(quantity(await read(net.rpc, 'eth_chainId', [])) === BigInt(net.id));
  const code = await read(net.rpc, 'eth_getCode', [review.transaction.to, 'latest']);
  requireThat(/^0x[0-9a-f]+$/i.test(code) && !/^0x0*$/i.test(code));
  const [balanceHex, gasHex, priceHex] = await Promise.all([
    read(net.rpc, 'eth_getBalance', [input.address, 'latest']),
    read(net.rpc, 'eth_estimateGas', [review.transaction, 'latest']),
    read(net.rpc, 'eth_gasPrice', []),
  ]);
  const balance = quantity(balanceHex), gas = quantity(gasHex), price = quantity(priceHex);
  requireThat(gas > 0n && gas <= 30000000n && price > 0n && Date.now() < review.expiresAt);
  requireThat(balance >= BigInt(input.raw) + gas * price);
  return { status: 'passed', scope: 'Relay source deposit only', gasUnits: gas.toString(), estimatedGasRaw: (gas * price).toString(), gasSymbol: net.symbol };
}
export async function mayanBaseChecks(address: string, minimumRaw: string, read = rpc) {
  requireThat(quantity(await read(BASE_RPC, 'eth_chainId', [])) === 8453n);
  const [native, usdc, allowance] = await Promise.all([
    read(BASE_RPC, 'eth_getBalance', [address, 'latest']),
    read(BASE_RPC, 'eth_call', [{ to: BASE_USDC, data: encodeFunctionData({ abi: ERC20, functionName: 'balanceOf', args: [address as `0x${string}`] }) }, 'latest']),
    read(BASE_RPC, 'eth_call', [{ to: BASE_USDC, data: encodeFunctionData({ abi: ERC20, functionName: 'allowance', args: [address as `0x${string}`, FORWARDER] }) }, 'latest']),
  ]);
  const gas = quantity(native), tokens = quantity(usdc), approved = quantity(allowance);
  return { status: 'balances-only', simulated: false, baseEthPresent: gas > 0n, existingUsdcEnough: tokens >= BigInt(minimumRaw), existingAllowanceEnough: approved >= BigInt(minimumRaw), requiredUsdcRaw: minimumRaw };
}
