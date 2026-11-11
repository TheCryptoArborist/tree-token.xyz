import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyEventFunctions} from '../scripts/arcade-events/release-function-guard.mjs';

const original={
 n:'arcade-events',d:'old-package',id:'old-function',oid:'old-provider-function',a:'934697152142',s:344451,c:'2026-11-11T17:40:53.670Z',
 bd:{bootstrapVersion:'2.24.0',runtimeAPIVersion:2},r:'nodejs22.x',im:'stream',m:1024,rg:'us-east-2',obl:'netlify-observability-extension',oblv:34,
 ro:[{p:'/api/arcade-events',l:'/api/arcade-events',e:null,m:['GET','POST'],ps:false}],
 tr:{action:{type:'rate_limit',config:{aggregate:{keys:[{type:'domain'},{type:'ip'}]},rate_limit_config:{algorithm:'sliding_window',window_size:60,window_limit:30}}}}
};
const other={n:'other-existing-handler',d:'untouched-package',id:'existing-function',oid:'existing-provider-function',a:'043306366455',s:500,c:'2026-11-01T00:00:00Z',r:'nodejs22.x',im:'stream',m:1024,rg:'us-east-2'};
const replacement={...structuredClone(original),d:'approved-new-package',id:'new-function',oid:'new-provider-function',a:'043306366455',s:345872,c:'2026-11-11T22:50:00Z',mo:1024,rgo:'us-east-2'};
const metadata={sha256:replacement.d,size:replacement.s,buildData:replacement.bd};
const fixture=()=>({functions:[structuredClone(other),structuredClone(replacement)],baseline:[structuredClone(original),structuredClone(other)],packageMetadata:structuredClone(metadata)});

test('authorized new event package can be provisioned in another Netlify account and pins the complete record',()=>{
 const args=fixture(),record=verifyEventFunctions(args);
 assert.deepEqual(record,replacement);
 assert.notEqual(record,args.functions[1]);
 assert.deepEqual(verifyEventFunctions({...args,pinnedEventRecord:record}),replacement);
});

test('a pinned event rejects later account or immutable identity drift',()=>{
 for(const [field,value]of [['a','999999999999'],['id','another-function'],['oid','another-provider-function'],['c','2026-11-11T23:59:00Z']]){
  const args=fixture(),pinnedEventRecord=verifyEventFunctions(args);
  args.functions[1][field]=value;
  assert.throws(()=>verifyEventFunctions({...args,pinnedEventRecord}),/Event provisioning record changed after candidate verification/,field);
 }
});

test('unrelated functions retain their exact provider account and all other fields',()=>{
 for(const [field,value]of [['a','999999999999'],['d','different-package'],['rg','eu-west-1']]){
  const args=fixture();args.functions[0][field]=value;
  assert.throws(()=>verifyEventFunctions(args),/Unrelated function changed/,field);
 }
});

test('initial event verification still rejects runtime, route, rate limit and resource drift',()=>{
 for(const [field,value]of [['r','nodejs24.x'],['im','buffer'],['m',2048],['rg','eu-west-1'],['oblv',35],['ro',[]],['tr',{}]]){
  const args=fixture();args.functions[1][field]=value;
  assert.throws(()=>verifyEventFunctions(args),/Event execution configuration changed/,field);
 }
});

test('event package content, size, metadata and provider account shape remain verified',()=>{
 for(const [field,value]of [['d','unapproved-package'],['s',1],['bd',{}],['a','not-an-account']]){
  const args=fixture();args.functions[1][field]=value;
  assert.throws(()=>verifyEventFunctions(args),/Wrong event|Invalid event provider account/,field);
 }
 const args=fixture();args.functions[1].d=original.d;args.packageMetadata.sha256=original.d;
 assert.throws(()=>verifyEventFunctions(args),/An unchanged event package cannot move provider accounts/);
});
