import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseBridgeQuotes,simulateBridgedRoute} from '../netlify/lib/tree-bridge-quotes.ts';
import {SUI_TYPE,TREE_TYPE} from '../netlify/lib/tree-swap-route.ts';
const now=Date.now(), timestamp=new Date(now).toISOString();
const coinOut='0xb::boom::BOOM';
const request={coinIn:SUI_TYPE,coinOut,amountIn:'10000000000'};
const hop={venue:'v3',pairId:'0x'+'1'.repeat(64),tokenIn:SUI_TYPE,tokenOut:coinOut,amountIn:request.amountIn,amountOut:'123456789123'};
const route={type:'direct',hops:[hop],totalAmountIn:hop.amountIn,totalAmountOut:hop.amountOut};
const payload={tokenIn:SUI_TYPE,tokenOut:coinOut,amountIn:request.amountIn,timestamp,directRoutes:[route],bestRoute:route};
test('service estimates bind the pair, exact input, output and timestamp; deduplicate and reject multi-hop',()=>{
  assert.equal(parseBridgeQuotes(payload,request,now,30000).length,1);
  assert.throws(()=>parseBridgeQuotes({...payload,amountIn:'1'},request,now,30000));
  assert.throws(()=>parseBridgeQuotes({...payload,timestamp:new Date(now-30001).toISOString()},request,now,30000));
  assert.equal(parseBridgeQuotes({...payload,timestamp:new Date(now+500).toISOString()},request,now,30000).length,1);
  assert.throws(()=>parseBridgeQuotes({...payload,timestamp:new Date(now+1001).toISOString()},request,now,30000));
  for(const bad of [{...route,totalAmountOut:'1'},{...route,type:'split'},{...route,hops:[hop,hop]},{...route,hops:[{...hop,tokenOut:TREE_TYPE}]},{...route,hops:[{...hop,amountOut:'-1'}]}]) {
    assert.deepEqual(parseBridgeQuotes({...payload,directRoutes:[bad],bestRoute:bad},request,now,30000),[]);
  }
});
test('mixed-venue simulation carries exact bridge units and remains explicitly unverified for execution',async()=>{
  const bridge=parseBridgeQuotes(payload,request,now,30000)[0];
  let received=0n;
  const pool={venue:'aftermath',poolId:'0x'+'2'.repeat(64),coinTypes:[coinOut,TREE_TYPE],reserves:{[coinOut]:'999999999999999',[TREE_TYPE]:'999999999999999'},verifiedAt:timestamp,quote:(_a:string,_b:string,n:bigint)=>{received=n;return n*2n;}};
  const tail=[{pool,coinIn:coinOut,coinOut:TREE_TYPE}];
  const result=await simulateBridgedRoute(bridge,tail,{now,maxAgeMs:30000});
  assert.equal(received,123456789123n);
  assert.equal(result.amountIn,request.amountIn);
  assert.equal(result.amountOut,'246913578246');
  assert.equal(result.executionVerified,false);
  await assert.rejects(simulateBridgedRoute(bridge,tail,{now:now+30001,maxAgeMs:30000}),/stale-bridge/);
  await assert.rejects(simulateBridgedRoute(bridge,[{...tail[0],pool:{...pool,poolId:bridge.poolId}}],{now,maxAgeMs:30000}),/invalid-bridge-tail/);
});
