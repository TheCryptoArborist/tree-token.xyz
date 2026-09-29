import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderId } from '@relay-protocol/settlement-sdk';
import { encodeFunctionData, parseAbi } from 'viem';
import { bridgeInput, verifyRelay, sourceSimulation, mayanBaseChecks, rpc, NETWORKS } from '../netlify/lib/gateway-bridge-review.ts';
import { createBridgeReviewHandler } from '../netlify/preview-functions/tree-gateway-bridge-review.ts';

const address = '0x' + '1'.repeat(40), depository = '0x' + '2'.repeat(40);
const usdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', zero = '0x' + '0'.repeat(40);
const input = bridgeInput({ address, amount: '0.01', chain: 'bsc' });
const chains = Object.entries(NETWORKS).map(([name, n]) => ({ id: n.id, vmType: 'evm', protocol: { v2: { chainId: n.protocol, depository } } })).concat([{ id: 8453, vmType: 'evm', protocol: { v2: { chainId: 'base', depository } } }]);
function fixture(chain = 'bsc') {
  const net = NETWORKS[chain];
  const order = { version: 'v1', solverChainId: 'base', solver: address, salt: '0x' + '3'.repeat(64), inputs: [{ payment: { chainId: net.protocol, currency: zero, amount: input.raw, weight: '1' }, refunds: [{ chainId: net.protocol, currency: zero, recipient: address, minimumAmount: '0', deadline: Math.floor(Date.now()/1000) + 3600, extraData: '0x' }] }], output: { chainId: 'base', payments: [{ recipient: address, currency: usdc, minimumAmount: '990000', expectedAmount: '1000000' }], calls: [], deadline: Math.floor(Date.now()/1000) + 3600, extraData: '0x' }, fees: [] };
  const orderId = getOrderId(order as any, { [net.protocol]: 'ethereum-vm', base: 'ethereum-vm' });
  return { protocol: { v2: { orderId, orderData: order, hubType: 'onchain', paymentDetails: { chainId: net.protocol, depository, currency: zero, amount: input.raw } } }, steps: [{ kind: 'transaction', items: [{ data: { chainId: net.id, from: address, to: depository, value: input.raw, data: encodeFunctionData({ abi: parseAbi(['function depositNative(address depositor,bytes32 id)']), functionName: 'depositNative', args: [address as any, orderId] }) } }]}] };
}
test('bridge check only accepts bounded native BNB/Robinhood requests, never supplied payloads or endpoints', () => {
  for (const mutation of [{chain:'base'}, {address:zero}, {amount:'101'}, {amount:'0'}, {amount:'0.0000000000000000001'}, {rpc:'https://example.com'}, {transaction:{}}]) assert.throws(()=>bridgeInput({address, amount: input.amount, chain: input.chain, ...mutation}));
  assert.equal(bridgeInput({address,chain:'robinhood',amount:'0.01'}).raw, input.raw);
});
test('both Relay origins bind exact payment, recipient, minimum and canonical deposit to recomputed order', () => {
  for (const chain of ['bsc','robinhood']) {
    const result = verifyRelay(fixture(chain), chains, {...input,chain} as any);
    assert.equal(result.transaction.to, depository);
    assert.equal(result.transaction.from, address);
    assert.equal(BigInt(result.transaction.value), BigInt(input.raw));
    assert.equal(result.minimumBaseUsdcRaw, '990000');
    assert.deepEqual(Object.keys(result.transaction).sort(), ['data','from','to','value']);
  }
});
test('Relay rejects tampered identities, amount, commitment, refund, extra actions and expiry', () => {
  const changes = [
    q=>q.protocol.v2.orderData.output.payments[0].recipient = depository,
    q=>q.protocol.v2.orderData.inputs[0].refunds[0].recipient = depository,
    q=>q.protocol.v2.orderData.output.payments[0].minimumAmount = '980000',
    q=>q.protocol.v2.orderData.output.deadline = 1,
    q=>q.protocol.v2.orderId = '0x'+'0'.repeat(64),
    q=>q.protocol.v2.paymentDetails.depository = address,
    q=>q.steps[0].items[0].data.to = address,
    q=>q.steps[0].items[0].data.value = '1',
    q=>q.steps[0].items[0].data.from = depository,
    q=>q.steps[0].items[0].data.chainId = 1,
    q=>q.steps[0].items[0].data.data += '00',
    q=>q.steps.push(q.steps[0]),
  ];
  for (const change of changes) { const q=fixture(); change(q); assert.throws(()=>verifyRelay(q,chains,input)); }
  const changedChains=structuredClone(chains);changedChains[0].protocol.v2.depository=address;
  assert.throws(()=>verifyRelay(fixture(),changedChains,input));
});
test('source simulation requires correct network, contract code, real funds and successful read-only gas estimation', async () => {
  const review=verifyRelay(fixture(),chains,input), methods=[];
  const values={eth_chainId:'0x38',eth_getCode:'0x6001',eth_getBalance:'0xde0b6b3a7640000',eth_estimateGas:'0x8000',eth_gasPrice:'0x100'};
  const read=async (_url,method,params)=>{methods.push(method); if(method==='eth_estimateGas') assert.deepEqual(params,[review.transaction,'latest']);return values[method];};
  assert.equal((await sourceSimulation(input,review,read)).status,'passed');
  assert.ok(methods.every(m=>['eth_chainId','eth_getCode','eth_getBalance','eth_estimateGas','eth_gasPrice'].includes(m)));
  for(const [method,value] of [['eth_chainId','0x1'],['eth_getCode','0x'],['eth_getBalance','0x0'],['eth_estimateGas','0x0']]) await assert.rejects(()=>sourceSimulation(input,review,async (url,m,p)=>m===method?value:read(url,m,p)));
  await assert.rejects(()=>sourceSimulation(input,review,async ()=>{throw Error('revert')}));
});
test('Mayan checks never count future proceeds or claim simulation/approval', async () => {
  const reads=[];
  const result=await mayanBaseChecks(address,'990000',async(url,method,params)=>{reads.push({url,method,params});return method==='eth_chainId'?'0x2105':'0x0';});
  assert.deepEqual(result,{status:'balances-only',simulated:false,baseEthPresent:false,existingUsdcEnough:false,existingAllowanceEnough:false,requiredUsdcRaw:'990000'});
  assert.ok(reads.every(r=>r.url==='https://mainnet.base.org' && ['eth_chainId','eth_call','eth_getBalance'].includes(r.method)));
  await assert.rejects(()=>rpc('https://example.com','eth_getBalance',[]));
  await assert.rejects(()=>rpc('https://mainnet.base.org','eth_sendRawTransaction',[]));
});
test('handler strips order and transaction payloads and keeps a failed simulation separate from balances', async () => {
  const handler=createBridgeReviewHandler({json:async(url,init)=>{if(url.endsWith('/chains'))return {chains}; const sent=JSON.parse(init.body);assert.equal(sent.user,address);assert.equal(sent.recipient,address);assert.equal(sent.includeProtocolData,true);assert.equal(sent.indicativeQuote,undefined);return fixture();},sourceSimulation:async()=>{throw Error('insufficient funds')},mayanBaseChecks:async()=>({status:'balances-only',simulated:false})} as any);
  const response=await handler(new Request('https://example.com/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,amount:input.amount,chain:input.chain})}));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.orderVerified,true);assert.equal(body.relay.status,'not-passed');assert.equal(body.mayan.simulated,false);assert.equal(body.routeReady,false);assert.equal(body.submitted,false);assert.equal(body.signed,false);
  assert.ok(!JSON.stringify(body).includes('depositNative'));assert.ok(!('transaction' in body));assert.ok(!('protocol' in body));
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('invalid requests stop before providers are contacted',async()=>{
 const handler=createBridgeReviewHandler({json:async()=>{throw Error('must not be called')}} as any);
 assert.equal((await handler(new Request('https://example.com'))).status,405);
 assert.equal((await handler(new Request('https://example.com',{method:'POST',body:'{}'}))).status,400);
 assert.equal((await handler(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,amount:'1',chain:'ethereum'})}))).status,400);
});
