import test from 'node:test';import assert from 'node:assert/strict';
import {findRecentContinueReceipts} from '../treeforce89/paid/receipt-discovery.mjs';
import {TREE_RECIPIENT,TREE_COIN_TYPE} from '../treeforce89/paid/contract.mjs';
const wallet='0x'+'8'.repeat(64),startedAt=Date.now(),digest='C'.repeat(44);
const transaction=(patch={})=>({$kind:'Transaction',Transaction:{digest,timestampMs:startedAt+1,checkpoint:'123',
 status:{success:true},effects:{status:{success:true}},transaction:{sender:wallet},
 balanceChanges:[{address:TREE_RECIPIENT,coinType:TREE_COIN_TYPE,amount:'20000000000'}],...patch}});
const source=rows=>({network:'mainnet',core:{listTransactions:async options=>{
 assert.deepEqual(options.filter,{sender:wallet});assert.equal(options.order,'descending');
 return {transactions:rows,hasNextPage:false};}}});
test('discovers only recent successful TREE treasury receipts from this sender',async()=>{
 const client=source([transaction({timestampMs:1}),transaction({status:{success:false}}),
  transaction({transaction:{sender:'0x1'}}),transaction({balanceChanges:[{address:TREE_RECIPIENT,coinType:'0x2::sui::SUI',amount:'20000000000'}]}),transaction()]);
 assert.deepEqual(await findRecentContinueReceipts({client,wallet,startedAt}),[digest]);
});
test('trusted mainnet archival lookup recovers after gRPC lookup fails',async()=>{
 const client={network:'mainnet',core:{listTransactions:async()=>{throw Error('Indexer unavailable');}}};
 assert.deepEqual(await findRecentContinueReceipts({client,archivalClient:source([transaction()]),wallet,startedAt}),[digest]);
});
test('lookup is bounded and rejects a different network',async()=>{
 let count=0;const client={network:'mainnet',core:{listTransactions:async()=>{count++;return {transactions:[],hasNextPage:true,endCursor:'cursor'};}}};
 assert.deepEqual(await findRecentContinueReceipts({client,wallet,startedAt}),[]);assert.equal(count,2);
 await assert.rejects(findRecentContinueReceipts({client:{...client,network:'testnet'},wallet,startedAt}),/Mainnet/);
});
