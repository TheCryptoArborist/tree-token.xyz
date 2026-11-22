import test from 'node:test';import assert from 'node:assert/strict';
import {Transaction,Inputs} from '@mysten/sui/transactions';import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';import {toBase64} from '@mysten/sui/utils';
import {createSignedInspector} from '../server/payments/signed.mjs';import {TREE_TYPE} from '../server/payments/tree.mjs';import {TREE_PAYMENT_RECIPIENT} from '../server/payments/config.mjs';
const digest='11111111111111111111111111111111',coin='0x'+'3'.repeat(64),gas='0x'+'9'.repeat(64);
async function fixture(mutate=()=>{}){const key=Ed25519Keypair.generate(),wallet=key.toSuiAddress(),invoice={network:'mainnet',wallet,recipient:TREE_PAYMENT_RECIPIENT,product:'shield',decimals:6,amount:'3000000000'};const tx=new Transaction();tx.setSender(wallet);tx.setGasOwner(wallet);tx.setGasPrice(1000);tx.setGasBudget(10000000);tx.setGasPayment([{objectId:gas,version:'1',digest}]);const c=tx.object(Inputs.ObjectRef({objectId:coin,version:'1',digest}));const[s]=tx.splitCoins(c,[tx.pure.u64(3000000000n)]);tx.transferObjects([s],tx.pure.address(TREE_PAYMENT_RECIPIENT));mutate(tx);const bytes=await tx.build();const sig=await key.signTransaction(bytes);const signed={bytes:toBase64(bytes),signature:sig.signature};const client={network:'mainnet',getObjects:async({objectIds})=>({objects:objectIds.map(objectId=>({objectId,version:'1',digest,owner:{$kind:'AddressOwner',AddressOwner:wallet},type:`0x2::coin::Coin<${objectId===gas?'0x2::sui::SUI':TREE_TYPE}>`}))})};return{signed,invoice,client,key,tx};}
test('actual signed BCS binds only the exact TREE transfer and derives its digest',async()=>{const f=await fixture();assert.equal(await createSignedInspector(f.client)(f.signed,f.invoice),await f.tx.getDigest());});
test('extra transfers or Move calls cannot hide in a checkout transaction',async()=>{for(const mutate of [t=>t.transferObjects([t.gas],t.pure.address('0x4')),t=>t.moveCall({target:'0x2::sui::transfer',arguments:[]})]){const f=await fixture(mutate);await assert.rejects(createSignedInspector(f.client)(f.signed,f.invoice));}});
test('wrong signer, type, recipient, amount, version and excessive gas fail before binding',async()=>{const f=await fixture();const wrong=await Ed25519Keypair.generate().signTransaction(await f.tx.build());await assert.rejects(createSignedInspector(f.client)({...f.signed,signature:wrong.signature},f.invoice));for(const patch of [{recipient:'0x4'},{amount:'1'}])await assert.rejects(createSignedInspector(f.client)(f.signed,{...f.invoice,...patch}));for(const property of ['type','version']){const client={...f.client,getObjects:async q=>{const r=await f.client.getObjects(q);r.objects[0][property]='wrong';return r;}};await assert.rejects(createSignedInspector(client)(f.signed,f.invoice));}const expensive=await fixture(t=>t.setGasBudget(50000001));await assert.rejects(createSignedInspector(expensive.client)(expensive.signed,expensive.invoice));});

test('signed validator distinguishes gas payer, budget, input changes and a Sui lookup outage',async()=>{
 const gasOwner=await fixture(t=>t.setGasOwner('0x4'));await assert.rejects(createSignedInspector(gasOwner.client)(gasOwner.signed,gasOwner.invoice),e=>e.paymentCode==='GAS_OWNER');
 const budget=await fixture(t=>t.setGasBudget(50000001));await assert.rejects(createSignedInspector(budget.client)(budget.signed,budget.invoice),e=>e.paymentCode==='GAS_BUDGET');
 const f=await fixture();await assert.rejects(createSignedInspector({...f.client,getObjects:async()=>{throw Error('network unavailable');}})(f.signed,f.invoice),e=>e.paymentCode==='COIN_LOOKUP');
 await assert.rejects(createSignedInspector({...f.client,getObjects:async q=>{const r=await f.client.getObjects(q);r.objects[0].version='2';return r;}})(f.signed,f.invoice),e=>e.paymentCode==='COIN_CHANGED');
 const wrong=await Ed25519Keypair.generate().signTransaction(await f.tx.build());await assert.rejects(createSignedInspector(f.client)({...f.signed,signature:wrong.signature},f.invoice),e=>e.paymentCode==='SIGNATURE_INVALID');
});

const gasChain='11111111111111111111111111111111';
async function addressGasFixture(mutate=()=>{}){
 const f=await fixture(t=>{t.setGasPayment([]);t.setExpiration({ValidDuring:{minEpoch:'100',maxEpoch:'101',minTimestamp:null,maxTimestamp:null,chain:gasChain,nonce:7}});mutate(t);});
 Object.assign(f.client,{getProtocolConfig:async()=>({protocolConfig:{featureFlags:{enable_address_balance_gas_payments:true}}}),getChainIdentifier:async()=>({chainIdentifier:gasChain}),getCurrentSystemState:async()=>({systemState:{epoch:'100'}}),getBalance:async()=>({balance:{addressBalance:'100000000',coinBalance:'0',balance:'100000000'}})});return f;
}
test('a valid signed TREE transfer can pay SUI gas from address balance with no gas coins',async()=>{
 const f=await addressGasFixture();assert.deepEqual(f.tx.getData().gasData.payment,[]);assert.equal(await createSignedInspector(f.client)(f.signed,f.invoice),await f.tx.getDigest());
});
test('address-balance gas retains the positive 0.05 SUI cap and exact payer requirement',async()=>{
 for(const value of [0,50000001]){const f=await addressGasFixture(t=>t.setGasBudget(value));await assert.rejects(createSignedInspector(f.client)(f.signed,f.invoice),e=>e.paymentCode==='GAS_BUDGET');}
 const owner=await addressGasFixture(t=>t.setGasOwner('0x4'));await assert.rejects(createSignedInspector(owner.client)(owner.signed,owner.invoice),e=>e.paymentCode==='GAS_OWNER');
 const cap=await addressGasFixture(t=>t.setGasBudget(50000000));assert.equal(await createSignedInspector(cap.client)(cap.signed,cap.invoice),await cap.tx.getDigest());
});
test('address-balance gas rejects missing, broad, expired and wrong-chain replay protection',async()=>{
 const no=await addressGasFixture(t=>t.setExpiration({None:true}));await assert.rejects(createSignedInspector(no.client)(no.signed,no.invoice),e=>e.paymentCode==='GAS_REPLAY');
 const broad=await addressGasFixture(t=>t.setExpiration({ValidDuring:{minEpoch:'100',maxEpoch:'102',minTimestamp:null,maxTimestamp:null,chain:gasChain,nonce:1}}));await assert.rejects(createSignedInspector(broad.client)(broad.signed,broad.invoice),e=>e.paymentCode==='GAS_REPLAY');
 for(const patch of [{getCurrentSystemState:async()=>({systemState:{epoch:'102'}})},{getChainIdentifier:async()=>({chainIdentifier:'other-network'})}]){const f=await addressGasFixture();Object.assign(f.client,patch);await assert.rejects(createSignedInspector(f.client)(f.signed,f.invoice),e=>e.paymentCode==='GAS_REPLAY');}
});
test('gas must be covered by SUI address balance, not merely by total or TREE balance',async()=>{
 const f=await addressGasFixture();f.client.getBalance=async q=>{assert.equal(q.coinType,'0x2::sui::SUI');assert.equal(q.owner,f.invoice.wallet);return{balance:{addressBalance:'1',coinBalance:'1000000000',balance:'1000000001'}};};
 await assert.rejects(createSignedInspector(f.client)(f.signed,f.invoice),e=>e.paymentCode==='GAS_BALANCE');
});
test('disabled address gas and unavailable Mainnet checks fail closed',async()=>{
 const f=await addressGasFixture();f.client.getProtocolConfig=async()=>({protocolConfig:{featureFlags:{}}});await assert.rejects(createSignedInspector(f.client)(f.signed,f.invoice),e=>e.paymentCode==='GAS_MODE');
 const down=await addressGasFixture();down.client.getBalance=async()=>{throw Error('offline');};await assert.rejects(createSignedInspector(down.client)(down.signed,down.invoice),e=>e.paymentCode==='GAS_LOOKUP');
});
