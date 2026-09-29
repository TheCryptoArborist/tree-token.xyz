import { bridgeInput, verifyRelay, NETWORKS, json, sourceSimulation, mayanBaseChecks } from '../lib/gateway-bridge-review.ts';
import { SOURCES } from '../../gateway/options.js';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function createBridgeReviewHandler(deps = { json, sourceSimulation, mayanBaseChecks }) {
  return async (request: Request) => {
    if (request.method !== 'POST') return reply({ error: 'Use the read-only bridge check.' }, 405);
    let input;
    try {
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error();
      const body = await request.text();
      if (body.length > 512) throw Error();
      input = bridgeInput(JSON.parse(body));
    } catch { return reply({ error: 'Choose BNB or Robinhood Chain, a valid source account and an amount up to 100 native tokens.' }, 400); }
    const started = Date.now();
    try {
      const [quote, catalog] = await Promise.all([
        deps.json('https://api.relay.link/quote/v2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: input.address, recipient: input.address, originChainId: NETWORKS[input.chain].id, destinationChainId: 8453, originCurrency: SOURCES.bsc.BNB[0], destinationCurrency: SOURCES.base.USDC[0], amount: input.raw, tradeType: 'EXACT_INPUT', includeProtocolData: true, slippageTolerance: '100' }) }),
        deps.json('https://api.relay.link/chains'),
      ]);
      const review = verifyRelay(quote, catalog.chains, input, started);
      const [source, mayan] = await Promise.allSettled([deps.sourceSimulation(input, review), deps.mayanBaseChecks(input.address, review.minimumBaseUsdcRaw)]);
      if (Date.now() >= review.expiresAt) throw Error();
      return reply({ address: input.address, chain: input.chain, amount: input.amount, orderVerified: true, expiresAt: review.expiresAt,
        relay: source.status === 'fulfilled' ? source.value : { status: 'not-passed', scope: 'Relay source deposit only' },
        mayan: mayan.status === 'fulfilled' ? mayan.value : { status: 'unavailable', simulated: false },
        signed: false, submitted: false, destinationFillSimulated: false, routeReady: false });
    } catch { return reply({ error: 'Bridge order verification was unavailable or the route was unsupported. No simulation pass can be claimed.', signed: false, submitted: false, routeReady: false }, 422); }
  };
}
export default createBridgeReviewHandler();
export const config = { path: '/api/tree-gateway-bridge-review' };
