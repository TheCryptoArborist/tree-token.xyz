import assert from 'node:assert/strict';
import {test} from 'node:test';
import {STI,SUI,TREE,POOL,CONFIG,INTEGRATE,parseSui,units,makeQuote,validateQuote,validatePool,requireBalance,parseFeed,buildPurchase,checkSimulation} from '../dapp/sti-purchase-core.js';
const now=1790052751000;
const pool={id:POOL,coin_type_a:STI,coin_type_b:SUI,fee_rate:'2500',pool_status:{disable_swap:false},liquidity:'19616957339841',current_sqrt_price:'75118023302009553'};
const raw={pool_address:POOL,current_sqrt_price:pool.current_sqrt_price,estimated_amount_in:'100000000',estimated_amount_out:'6007891535512',estimated_fee_amount:'250000',is_exceed:false,amount:'100000000',a2b:false,by_amount_in:true};
const quote=()=>makeQuote(pool,raw,100000000n,now);
test('amounts are exact; rejects ambiguous and excessive precision inputs',()=>{
 assert.equal(parseSui('0.000000001'),1n);assert.equal(parseSui('1234567.123456789'),1234567123456789n);
 assert.equal(units(100000001n),'0.100000001');
 for(const input of ['0','-1','1e3','NaN','1,000','1.0000000001','18446744074','0x10','Infinity',''])assert.throws(()=>parseSui(input));
});
test('rejects wrong pool, pair, fees, paused swaps and empty liquidity',()=>{
 for(const change of [{id:'0x1'},{coin_type_a:TREE},{coin_type_b:STI},{fee_rate:'3000'},{pool_status:{disable_swap:true}},{liquidity:'0'}])assert.throws(()=>validatePool({...pool,...change}));
});
test('protects full input, minimum output, and 3% price impact',()=>{
 const q=quote();assert.equal(q.minOut,5947812620156n);assert.ok(q.impactBps<300n);
 const spot=100000000n*(1n<<128n)/(BigInt(pool.current_sqrt_price)**2n);
 assert.throws(()=>makeQuote(pool,{...raw,estimated_amount_out:String(spot*9600n/10000n)},100000000n,now),/This quote has 4\.0[01]% price impact, above the 3% limit.*No purchase was submitted/);
 for(const change of [{is_exceed:true},{a2b:true},{by_amount_in:false},{pool_address:'0x1'},{amount:'1'},{estimated_amount_in:'90000000'},{estimated_amount_out:'0'},{estimated_amount_out:'100000000'}])assert.throws(()=>makeQuote(pool,{...raw,...change},100000000n,now));
});
test('expired, future, changed amount or modified protection cannot execute',()=>{
 assert.equal(validateQuote(quote(),100000000n,now+29999).amount,100000000n);
 for(const [q,amount,time] of [[quote(),100000000n,now+30000],[quote(),1n,now],[quote(),100000000n,now-1],[{...quote(),minOut:1n},100000000n,now]])assert.throws(()=>validateQuote(q,amount,time));
});
test('gas reserve is preserved exactly',()=>{
 requireBalance(200000000n,100000000n);assert.throws(()=>requireBalance(199999999n,100000000n));
});
test('feed rejects stale data and spoofed TREE symbols; membership may end',()=>{
 const feed={at:now,holders:29,coins:[{type:TREE,share:.1,held:'1000000',decimals:6,retiring:false}]};
 assert.equal(parseFeed(feed,now).member,true);
 assert.equal(parseFeed({...feed,coins:[{...feed.coins[0],type:'0x1::fake::TREE'}]},now).member,false);
 assert.equal(parseFeed({...feed,coins:[{...feed.coins[0],retiring:true}]},now).member,false);
 for(const f of [{...feed,at:now-300001},{...feed,holders:-1},{...feed,coins:[{...feed.coins[0],share:2}]},{...feed,coins:[{...feed.coins[0],held:'<script>'}]}])assert.throws(()=>parseFeed(f,now));
});
const owner='0x'+'1'.repeat(64);
class Recorder {
 constructor(){this.calls=[];this.gas='gas';this.pure=Object.fromEntries(['u64','u128','bool'].map(t=>[t,v=>({[t]:String(v)})]));}
 setSender(x){this.sender=x;} setGasBudget(x){this.budget=x;} object(id){return{id};}
 moveCall(x){this.calls.push(x);return{result:this.calls.length-1};}
 splitCoins(coin,amounts){this.split={coin,amounts};return[{split:0}];}
}
test('locally constructed purchase spends only exact SUI through pinned Cetus function',()=>{
 const tx=buildPurchase(Recorder,owner,quote(),now);
 assert.equal(tx.sender,owner);assert.equal(tx.budget,50000000n);
 assert.deepEqual(tx.split,{coin:'gas',amounts:[{u64:'100000000'}]});
 assert.equal(tx.calls.length,2);assert.equal(tx.calls[0].target,'0x2::coin::zero');
 const call=tx.calls[1];assert.equal(call.target,`${INTEGRATE}::pool_script_v2::swap_b2a`);
 assert.deepEqual(call.typeArguments,[STI,SUI]);assert.deepEqual(call.arguments.slice(0,2),[{id:CONFIG},{id:POOL}]);
 assert.deepEqual(call.arguments[5],{u64:'100000000'});assert.deepEqual(call.arguments[6],{u64:quote().minOut.toString()});
 assert.throws(()=>buildPurchase(Recorder,'not-a-wallet',quote(),now));
});
const simulation=(changes,success=true)=>({Transaction:{effects:{status:{success}},balanceChanges:changes}});
test('simulation must deliver minimum STI to owner with bounded SUI spend',()=>{
 const good=[{address:owner,coinType:STI,amount:quote().out.toString()},{address:owner,coinType:SUI,amount:'-101463516'}];
 assert.equal(checkSimulation(simulation(good),owner,quote()).spent,101463516n);
 assert.throws(()=>checkSimulation(simulation(good,false),owner,quote()));
 assert.throws(()=>checkSimulation(simulation([{...good[0],address:'0x2'},good[1]]),owner,quote()));
 assert.throws(()=>checkSimulation(simulation([{...good[0],amount:'1'},good[1]]),owner,quote()));
 assert.throws(()=>checkSimulation(simulation([good[0],{...good[1],amount:'-200000000'}]),owner,quote()));
 assert.throws(()=>checkSimulation(simulation([...good,{address:owner,coinType:TREE,amount:'-1'}]),owner,quote()));
});
