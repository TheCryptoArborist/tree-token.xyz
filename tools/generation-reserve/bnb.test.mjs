import test from 'node:test';import assert from 'node:assert/strict';import {encodeFunctionData,parseAbi,keccak256} from 'viem';
import {verifyReserveBnb} from '../../contracts/nftree-generation/scripts/reserve-bnb.mjs';
import {payload,guid} from '../../contracts/nftree-generation/scripts/reserve-review.mjs';
import reads from '../../docs/multichain/generation-milestone/bnb-configuration-completed/verified/rpc-reads.json' with {type:'json'};
const abi=parseAbi(['function state() view returns(uint8)','function generation() view returns(uint64)','function delivered(bytes32) view returns(bytes32)']);
const selectors=Object.fromEntries(['state','generation','delivered'].map(name=>[name,encodeFunctionData({abi,functionName:name,args:name==='delivered'?[guid]:[]})]));
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const fixture=(ready=false,change)=>async(_,options)=>{const q=JSON.parse(options.body);const name=q.method==='eth_call'&&Object.keys(selectors).find(n=>selectors[n]===q.params[0].data);let result;
 if(name)result=name==='delivered'?(ready?keccak256(payload):word(0)):word(ready?1:0);
 else{const row=reads.find(x=>x.method===q.method&&(['eth_call','eth_getCode'].includes(q.method)?JSON.stringify(x.params[0]).toLowerCase()===JSON.stringify(q.params[0]).toLowerCase():JSON.stringify(x.params||[])===JSON.stringify(q.params||[])));assert(row,'Unexpected RPC '+q.method);result=structuredClone(row.result);}
 if(change)result=change(q,name,result);return Response.json({jsonrpc:'2.0',id:q.id,result});};
for(const ready of [false,true])test('accept exact '+(ready?'delivered Ready':'pending Unconfirmed')+' state',async()=>assert.equal((await verifyReserveBnb(fixture(ready))).destinationVerified,ready));
for(const [label,change]of [['active',(_,n,r)=>n==='state'?word(2):r],['wrong payload',(_,n,r)=>n==='delivered'?word(3):r],['wrong generation',(_,n,r)=>n==='generation'?word(2):r],['runtime changed',(q,n,r)=>q.method==='eth_getCode'?'0x00':r]])test('reject '+label,async()=>assert.rejects(verifyReserveBnb(fixture(true,change))));
