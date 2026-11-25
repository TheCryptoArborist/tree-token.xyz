import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../play/grove-chess/online.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export function/g,'function');
function setup(fetch){const nodes=new Map(),storage=new Map();const context=vm.createContext({document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}},TRIAL_KEY:'trial',holderAccess:{isHolder:()=>false},onHolderChange(){},fetch,AbortSignal,URLSearchParams,location:{search:'',origin:'https://tree-token.xyz'},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){}});vm.runInContext(source,context);const online=vm.runInContext('createOnline({onRoom(){}})',context);return {context,online,nodes,storage};}
const old={id:'12345678-1234-4123-8123-123456789012',revision:5,pgn:'',seat:'w',status:'finished',used:1,holderSeat:false};
test('old result reads preserve a different active trial and its resume entitlement',()=>{const {context}=setup();context.previous={used:2,active:'local-game',finished:false};context.room=old;const merged=vm.runInContext('mergeOnlineTrial(previous,room)',context);assert.equal(merged.used,2);assert.equal(merged.active,'local-game');assert.equal(merged.finished,false);context.room={...old,id:'local-game',used:2};assert.equal(vm.runInContext('mergeOnlineTrial(previous,room).finished',context),true);});
test('a delayed old-room poll cannot replace a newly created invitation',async()=>{
 let resolvePoll,reads=0;const next={...old,id:'22345678-1234-4123-8123-123456789012',revision:0,status:'waiting',expiresAt:new Date(Date.now()+900000).toISOString()};
 const {online,nodes,storage}=setup(async url=>{if(url.includes('action=create'))return Response.json({room:next});if(++reads===1)return Response.json({room:old});return await new Promise(resolve=>{resolvePoll=resolve;});});
 storage.set('grove-chess:online-room:v1',old.id);await online.activate();assert.equal(reads,2);
 await nodes.get('#online-private').onclick();assert.equal(online.room.id,next.id);
 resolvePoll(Response.json({room:old}));await new Promise(resolve=>setImmediate(resolve));assert.equal(online.room.id,next.id);assert.equal(storage.get('grove-chess:online-room:v1'),next.id);
});
