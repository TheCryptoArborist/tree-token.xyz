import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, decodeFunctionData } from 'viem';
import { mayanInput, verifyMayanQuote, verifyMayanPayload, buildMayanPayload, simulateMayan, FORWARD_ABI, ORDER_ABI } from '../netlify/lib/gateway-mayan-simulation.ts';
import { createMayanHandler } from '../netlify/preview-functions/tree-gateway-mayan-simulate.ts';
import { mayanReviewAmount } from '../gateway/review-core.js';
import { SOURCES,SUI,USDC } from '../gateway/options.js';
const address='0x'+'1'.repeat(40), recipient='0x'+'2'.repeat(64), verified='0x'+'3'.repeat(64), protocol='0x'+'4'.repeat(40);
const input=mayanInput({address,recipient,amountRaw:'100000000'});
const token={contract:SUI,decimals:9,wChainId:21,verifiedAddress:verified};
function fixture() { return {type:'MCTP',fromChain:'base',toChain:'sui',gasless:false,hasAuction:true,onlyBridging:false,fromToken:{contract:SOURCES.base.USDC[0],chainId:8453,wChainId:30,decimals:6},toToken:token,effectiveAmountIn64:input.amountRaw,mctpInputContract:SOURCES.base.USDC[0],mctpOutputContract:USDC,mctpMayanContract:protocol,referrerBps:0,gasDrop:0,bridgeFee:0,slippageBps:100,deadline64:String(Math.floor(Date.now()/1000)+3600),expectedAmountOut:100,minAmountOut:99,redeemRelayerFee:1,redeemRelayerFee64:'1000000'}; }
test('Mayan input is exact, bounded and rejects caller-provided transactions, URLs or invalid addresses',()=>{
  for(const mutation of [{address:'0x'+'0'.repeat(40)},{recipient:'0x'+'0'.repeat(64)},{amountRaw:'0'},{amountRaw:'1.5'},{amountRaw:'1000000000001'},{rpc:'https://example.com'},{transaction:{}}]) assert.throws(()=>mayanInput({...input,...mutation}));
});
test('only Base USDC and the Base stage of BNB/Robinhood SUI settlements enable Mayan review',()=>{
  assert.equal(mayanReviewAmount('base','USDC','10',{settlement:SUI}),'10000000');
  assert.equal(mayanReviewAmount('robinhood','ETH','0.1',{settlement:SUI,relay:{minimumRaw:'1234567'}}),'1234567');
  assert.equal(mayanReviewAmount('bsc','BNB','0.1',{settlement:SUI,relay:{minimumRaw:'1234567'}}),'1234567');
  for(const args of [['base','ETH','1',{settlement:SUI}],['ethereum','USDC','1',{settlement:SUI}],['solana','USDC','1',{settlement:SUI}],['base','USDC','1',{settlement:USDC}],['bsc','BNB','1',{settlement:SUI,relay:{minimumRaw:'-1'}}]]) assert.equal(mayanReviewAmount(...args as any),null);
});
test('Mayan rejects changed assets, protocols, fees, amounts, registry identity, expiry and slippage',()=>{
  const changes=[q=>q.type='SWIFT',q=>q.fromChain='ethereum',q=>q.effectiveAmountIn64='1',q=>q.mctpInputContract=address,q=>q.mctpOutputContract=SUI,q=>q.referrerBps=25,q=>q.gasDrop=1,q=>q.bridgeFee=1,q=>q.gasless=true,q=>q.hasAuction=false,q=>q.deadline64='1',q=>q.minAmountOut=98,q=>q.toToken={...token,verifiedAddress:'0x'+'5'.repeat(64)},q=>q.redeemRelayerFee64='2'];
  for(const change of changes){const q=fixture();change(q);assert.throws(()=>verifyMayanQuote(q,{sui:[token]},input));}
  assert.throws(()=>verifyMayanQuote(fixture(),{sui:[]},input));
});
test('actual SDK payload encodes exact amount, connected Sui recipient, minimum and no permit/referrer',async()=>{
  const q=fixture(), review=verifyMayanQuote(q,{sui:[token]},input), payload=await buildMayanPayload(q,input);
  const tx=verifyMayanPayload(payload,input,review);
  assert.equal(tx.from,address);assert.equal(tx.value,'0x0');assert.deepEqual(Object.keys(tx).sort(),['data','from','to','value']);
  assert.throws(()=>verifyMayanPayload({...payload,value:'1'},input,review));
  assert.throws(()=>verifyMayanPayload({...payload,to:address},input,review));
  assert.throws(()=>verifyMayanPayload({...payload,data:payload.data+'00'},input,review));
  const outer=decodeFunctionData({abi:FORWARD_ABI,data:payload.data as any});
  const args=outer.args as any, decoded=decodeFunctionData({abi:ORDER_ABI,data:args[4]});
  for(const patch of [{destAddr:verified},{amountIn:1n},{minAmountOut:1n},{referrerBps:25},{destChain:2}]){
    const altered=[...args]; altered[4]=encodeFunctionData({abi:ORDER_ABI,functionName:'createOrder',args:[{...decoded.args[0],...patch}]});
    const data=encodeFunctionData({abi:FORWARD_ABI,functionName:'forwardERC20',args:altered as any});
    assert.throws(()=>verifyMayanPayload({...payload,data},input,review));
  }
});
function dependencies(funded=true){
 const calls:any[]=[];
 const deps={json:async(url:string)=>url.includes('/tokens')?{sui:[token]}:{quotes:[fixture()]},buildMayanPayload,mayanBaseChecks:async()=>({status:'balances-only',simulated:false,baseEthPresent:true,existingUsdcEnough:true,existingAllowanceEnough:funded,requiredUsdcRaw:input.amountRaw}),rpc:async(url,method,params)=>{
  calls.push({url,method,params});
  if(method==='eth_chainId') return '0x2105';
  if(method==='eth_getCode') return '0x6001';
  if(method==='eth_call') return '0x1';
  if(method==='eth_estimateGas') return '0x10000';
  if(method==='eth_gasPrice') return '0x100';
  if(method==='eth_getBalance') return '0xde0b6b3a7640000';
  throw Error('Forbidden method');
 }};return {deps,calls};
}
test('missing existing allowance blocks simulation without approving or inventing bridge funds',async()=>{
 const {deps,calls}=dependencies(false);const result=await simulateMayan(input,deps);
 assert.equal(result.status,'blocked');assert.equal(result.simulated,false);assert.equal(result.payloadVerified,true);
 assert.ok(!calls.some(c=>c.method==='eth_estimateGas'));assert.equal(result.signed,false);assert.equal(result.routeReady,false);
});
test('passed simulation is source-only, uses real state and never returns executable bytes',async()=>{
 const {deps,calls}=dependencies();const result=await simulateMayan(input,deps);
 assert.equal(result.status,'passed');assert.equal(result.simulated,true);assert.equal(result.destinationFillSimulated,false);assert.equal(result.submitted,false);assert.equal(result.routeReady,false);assert.equal(result.l1FeeIncluded,false);
 const simulation=calls.find(c=>c.method==='eth_estimateGas');assert.equal(simulation.params.length,2);assert.equal(simulation.params[1],'latest');assert.equal(simulation.params[0].from,address);
 assert.ok(calls.every(c=>c.url==='https://mainnet.base.org' && ['eth_chainId','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance'].includes(c.method)));
 assert.ok(!('data' in result));assert.ok(!('transaction' in result));
 for(const [method,value] of [['eth_chainId','0x1'],['eth_call','0x0'],['eth_getCode','0x'],['eth_estimateGas','0x0'],['eth_getBalance','0x0']]) await assert.rejects(()=>simulateMayan(input,{...deps,rpc:async(u,m,p)=>m===method?value:deps.rpc(u,m,p)}));
 await assert.rejects(()=>simulateMayan(input,{...deps,rpc:async(u,m,p)=>{if(m==='eth_estimateGas')throw Error('revert');return deps.rpc(u,m,p);}}));
});
test('endpoint validates inputs before work and converts simulation failures to a no-pass result',async()=>{
 let calls=0;const handler=createMayanHandler(async()=>{calls++;throw Error('private upstream detail')});
 assert.equal((await handler(new Request('https://example.com'))).status,405);
 assert.equal((await handler(new Request('https://example.com',{method:'POST',body:'{}'}))).status,400);assert.equal(calls,0);
 const response=await handler(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
 assert.equal(response.status,422);const result=await response.json();assert.equal(result.status,'not-passed');assert.equal(result.signed,false);assert.ok(!JSON.stringify(result).includes('private upstream'));assert.equal(response.headers.get('cache-control'),'no-store');
});
