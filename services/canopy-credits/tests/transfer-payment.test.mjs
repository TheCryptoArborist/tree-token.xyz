import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFixedContinueTerms,TRANSFER_DEPLOYMENT,DIRECT_CONTINUE as P,transferReference} from '../continue-product.mjs';
import {transferPaymentVerifier} from '../transfer-payment.mjs';
import {MAINNET,paymentReferences} from '../mainnet-reader.mjs';
import {createReceiptDiscovery,TRANSFER_DISCOVERY_QUERY} from '../receipt-discovery.mjs';
function fixture(){
 const now=Date.now(),actor={authenticated:true,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+'1'.repeat(64)}},flight={accountId:actor.accountId,runId:randomUUID(),lives:0,continuesUsed:0,ruleset:'treeforce89.v1',checkpointHash:'a'.repeat(64)};
 const terms=createFixedContinueTerms({actor,flight,deployment:TRANSFER_DEPLOYMENT,metadata:{network:P.network,coinType:P.coinType,decimals:6},now});
 const tx={digest:MAINNET.genesisDigest,finalized:true,simulated:false,status:'success',sender:terms.payer,checkpoint:'1',timestampMs:now+2000,paymentReferences:[transferReference(terms)],balanceChanges:[{owner:terms.payer,coinType:P.coinType,amount:'-'+P.requiredRaw},{owner:P.recipient,coinType:P.coinType,amount:P.requiredRaw}]};
 const network={network:P.network,chainIdentifier:P.chainIdentifier};
 return{terms,tx,network,verify:transferPaymentVerifier({getNetworkIdentity:async()=>network,getFinalizedTransaction:async()=>tx})};
}
test('standard payment verifies exact TREE effects and saved-flight reference without any checkout event',async()=>{
 const f=fixture(),e=await f.verify(f.terms,f.tx.digest);assert.equal(e.orderId,f.terms.orderId);assert.equal(e.amountRaw,P.requiredRaw);assert.equal(e.eventIndex,'0');assert.equal(e.paymentMethod,'tree-transfer-v1');
});
for(const [name,change] of [
 ['failed',f=>f.tx.status='failed'],['unfinalized',f=>f.tx.finalized=false],['simulation',f=>f.tx.simulated=true],
 ['wrong sender',f=>f.tx.sender='0x'+'2'.repeat(64)],['other flight reference',f=>f.tx.paymentReferences=['TREE_FORCE_CONTINUE_V1:'+'b'.repeat(64)]],
 ['two order references',f=>f.tx.paymentReferences.push(f.tx.paymentReferences[0])],['missing reference',f=>delete f.tx.paymentReferences],
 ['wrong amount',f=>f.tx.balanceChanges[1].amount='1'],['wrong recipient',f=>f.tx.balanceChanges[1].owner='0x'+'2'.repeat(64)],
 ['wrong coin',f=>f.tx.balanceChanges[1].coinType='0x2::sui::SUI'],['third TREE recipient',f=>f.tx.balanceChanges.push({owner:'0x'+'2'.repeat(64),coinType:P.coinType,amount:'1'})],
 ['old payment',f=>f.tx.timestampMs=f.terms.issuedAtMs-1],['other network',f=>f.network.chainIdentifier='bad'],['missing checkpoint',f=>delete f.tx.checkpoint]
])test('standard receipt rejects '+name,async()=>{const f=fixture();change(f);await assert.rejects(f.verify(f.terms,MAINNET.genesisDigest));});
test('late wallet approval still receives its continue, since ordinary transfers cannot enforce an app deadline',async()=>{const f=fixture();f.tx.timestampMs+=9000000;assert.equal((await f.verify(f.terms,f.tx.digest)).status,'success');});
test('reference decoding requires the real stdlib call and canonical BCS input',()=>{
 const f=fixture(),text=transferReference(f.terms),bytes=Uint8Array.from([text.length,...Buffer.from(text)]);
 const ptb={inputs:[{kind:1,pure:bytes}],commands:[{command:{oneofKind:'moveCall',moveCall:{package:'0x1',module:'string',function:'utf8',typeArguments:[],arguments:[{kind:2,input:0}]}}}]};
 const kind={data:{oneofKind:'programmableTransaction',programmableTransaction:ptb}};
 assert.deepEqual(paymentReferences(kind),[text]);
 ptb.inputs[0].pure=Uint8Array.from([...bytes,0]);assert.deepEqual(paymentReferences(kind),[]);
 ptb.inputs[0].pure=bytes;ptb.commands[0].command.moveCall.package='0x2';assert.deepEqual(paymentReferences(kind),[]);
});
test('lost wallet response discovers a transaction candidate and independently rechecks it',async()=>{
 const f=fixture();let calls=0;
 const discover=createReceiptDiscovery({endpoint:'https://graphql.mainnet.sui.io/graphql',verify:f.verify,fetcher:async(_url,r)=>{
  calls++;const body=JSON.parse(r.body);assert.equal(body.query,TRANSFER_DISCOVERY_QUERY);assert.equal(body.variables.payer,f.terms.payer);assert.equal(body.variables.type,undefined);
  return Response.json({data:{chainIdentifier:P.chainIdentifier,transactions:{nodes:[{digest:f.tx.digest}],pageInfo:{hasPreviousPage:false,startCursor:null}}}});
 }});
 assert.deepEqual(await discover(f.terms),{status:'found',digest:f.tx.digest});assert.equal(calls,1);
 f.tx.paymentReferences=[];assert.deepEqual(await discover(f.terms),{status:'pending'});
});
