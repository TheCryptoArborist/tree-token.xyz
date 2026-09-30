import { SuiGrpcClient } from '@mysten/sui/grpc';
import { quoteTurbosTreeSwap } from '../lib/turbos-tree-swap.ts';
import { simulationInput, simulationTransaction, simulationSummary } from '../lib/gateway-simulation.ts';
import { SUI, TREE } from '../../gateway/options.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function createSimulationHandler(quote = quoteTurbosTreeSwap, simulate = options => client.core.simulateTransaction(options)) {
return async function handler(request: Request) {
  if (request.method !== 'POST') return reply({ message: 'Use POST for an unsigned simulation.' }, 405);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ message: 'JSON required.' }, 415);
  let input;
  try {
    const text = await request.text();
    if (text.length > 512) throw Error();
    input = simulationInput(JSON.parse(text));
  } catch { return reply({ status: 'invalid', message: 'Use a valid Sui address and an amount up to 1,000 SUI.' }, 400); }
  let timeout;
  try {
    const run = async () => {
      const route = await quote({ tokenIn: SUI, tokenOut: TREE, amountIn: input.raw, slippageBps: 100 });
      const transaction = simulationTransaction(input.address, input.raw, route);
      const result = await simulate({ transaction, checksEnabled: true, doGasSelection: true, signal: AbortSignal.timeout(15_000), include: { effects: true, balanceChanges: true } });
      return simulationSummary(result, input.address, input.amount, route.minAmountOut);
    };
    return reply(await Promise.race([run(), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Timeout')), 20_000); })]));
  } catch {
    return reply({ status: 'not-passed', message: 'Simulation did not pass or was unavailable. Your Sui wallet must already hold the swap amount plus gas; bridge proceeds have not arrived. Refresh the quote and retry. No signing or transfer occurred.', signed: false, submitted: false, bridgeSimulated: false }, 422);
  } finally { clearTimeout(timeout); }
}
}
export default createSimulationHandler();
export const config = { path: '/api/tree-gateway-simulate' };
