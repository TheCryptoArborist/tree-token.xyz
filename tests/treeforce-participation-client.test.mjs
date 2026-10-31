import assert from 'node:assert/strict';
import test from 'node:test';
import {createTreeForceParticipationReporter,shouldTrackTreeForceStart} from '../treeforce89/frontend/participation-client.mjs';

const wallet='0x'+'1'.repeat(64),otherWallet='0x'+'2'.repeat(64);
const runId='grove-'+'a'.repeat(32),nextRun='grove-'+'c'.repeat(32),token='b'.repeat(64);
const pendingKey='treeforce89.arcade-participation.pending.v1:'+wallet;
const settle=()=>new Promise(done=>setImmediate(done));
const receipt=(run=runId,overrides={})=>({status:'ok',participation:{saved:true,runId:run,
 sourceId:`run:${run}:${wallet}`,dateKey:'2026-10-31',recordedAt:'2026-10-31T23:59:58.000Z',alreadyRecorded:false,...overrides}});
const reply=(body=receipt(),status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function fixture({fetchImpl=async()=>reply(),storageFailure=false}={}){
 let session={wallet,runId,sessionToken:token},serial=0;
 const data=new Map(),timers=new Map(),calls=[],states=[];
 const storage={getItem:key=>{if(storageFailure)throw Error('Storage disabled');return data.get(key)??null;},
  setItem:(key,value)=>{if(storageFailure)throw Error('Storage disabled');data.set(key,value);},
  removeItem:key=>{if(storageFailure)throw Error('Storage disabled');data.delete(key);}};
 const reporter=createTreeForceParticipationReporter({getSession:()=>session,storage,
  fetchImpl:(url,options)=>{calls.push({url,options});return fetchImpl(url,options,calls.length);},
  onChange:state=>states.push(state),setTimer:(callback,delay)=>{timers.set(++serial,{callback,delay});return serial;},
  clearTimer:id=>timers.delete(id)});
 const fire=async delay=>{
  const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry,'Expected timer '+delay);
  timers.delete(entry[0]);entry[1].callback();await settle();
 };
 return {reporter,data,timers,calls,states,fire,setSession:value=>{session=value;},session:()=>session};
}

test('only a normal first wave of a server-managed new run is eligible',()=>{
 const normal={runId,serverRunId:runId,wave:0,resumed:false,homeOnly:false,hasTestEntry:false,debug:false};
 assert.equal(shouldTrackTreeForceStart(normal),true);
 for(const change of [{homeOnly:true},{resumed:true},{hasTestEntry:true},{debug:true},{wave:1},
  {serverRunId:undefined},{serverRunId:nextRun},{runId:'offline'},{resumed:undefined}])
  assert.equal(shouldTrackTreeForceStart({...normal,...change}),false,JSON.stringify(change));
});

test('constructing, signing in without an event, and mismatched run IDs send no request',()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.reporter.recoverPending(),false);
 assert.equal(f.reporter.start(nextRun),false);assert.equal(f.calls.length,0);f.reporter.dispose();
});

test('actual start sends only the run ID with the current game credential and waits for a receipt',async()=>{
 let finish;const f=fixture({fetchImpl:()=>new Promise(resolve=>{finish=resolve;})});
 assert.equal(f.reporter.start(runId),true);assert.equal(f.calls.length,1);
 assert.equal(f.reporter.getState().status,'saving');assert.equal(f.reporter.retry(),false);
 const {url,options}=f.calls[0];assert.equal(url,'/api/arcade-growth?action=treeforce-play');
 assert.deepEqual(JSON.parse(options.body),{runId});assert.equal(options.headers.Authorization,'Bearer '+token);
 assert.equal(options.credentials,'omit');assert.equal(options.mode,'same-origin');assert.equal(options.redirect,'error');
 assert.deepEqual(JSON.parse(f.data.get(pendingKey)),{version:1,runId});assert.equal(f.data.get(pendingKey).includes(token),false);
 finish(reply());await settle();assert.equal(f.reporter.getState().status,'saved');assert.equal(f.data.has(pendingKey),false);
 assert.equal(f.reporter.start(runId),false);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
});

test('network, 429 and 503 retries are bounded, then an explicit manual retry can save',async()=>{
 const f=fixture({fetchImpl:async(_url,_options,count)=>{
  if(count===1)return reply({},503);if(count===2)return reply({},429);if(count===3)throw Error('Offline');return reply();
 }});
 f.reporter.start(runId);await settle();await f.fire(1000);await f.fire(4000);
 assert.equal(f.calls.length,3);assert.equal(f.timers.size,0);assert.equal(f.reporter.getState().status,'retry');
 assert.equal(f.reporter.retry(),true);await settle();assert.equal(f.calls.length,4);assert.equal(f.reporter.getState().status,'saved');
});

test('HTTP 408 and every 5xx response retry instead of permanently blocking progress',async()=>{
 for(const status of [408,...Array.from({length:100},(_,i)=>500+i)]){
  const f=fixture({fetchImpl:async(_url,_options,count)=>count===1?reply({},status):reply()});
  f.reporter.start(runId);await settle();assert.equal(f.reporter.getState().status,'saving','HTTP '+status);
  await f.fire(1000);assert.equal(f.reporter.getState().status,'saved','HTTP '+status);
  assert.equal(f.calls.length,2);assert.equal(f.timers.size,0);
 }
});

for(const status of [401,403,409])test('HTTP '+status+' stops automatic retries without claiming a save',async()=>{
 const f=fixture({fetchImpl:async()=>reply({},status)});f.reporter.start(runId);await settle();
 assert.equal(f.reporter.getState().status,'blocked');assert.equal(f.reporter.retry(),false);
 assert.equal(f.timers.size,0);assert.equal(f.calls.length,1);assert.ok(f.data.has(pendingKey));
});

test('late responses after account changes cannot show a save for the new account',async()=>{
 let finish;const f=fixture({fetchImpl:()=>new Promise(resolve=>{finish=resolve;})});f.reporter.start(runId);
 f.setSession({wallet:otherWallet,runId,sessionToken:token});f.reporter.reset();finish(reply());await settle();
 assert.equal(f.calls[0].options.signal.aborted,true);assert.equal(f.reporter.getState().status,'idle');
 assert.equal(f.states.some(state=>state.status==='saved'),false);assert.ok(f.data.has(pendingKey));
});

test('a new actual run supersedes an old pending marker; an old response cannot erase it',async()=>{
 const finishes=[];const f=fixture({fetchImpl:()=>new Promise(resolve=>finishes.push(resolve))});f.reporter.start(runId);
 f.setSession({wallet,runId:nextRun,sessionToken:token});assert.equal(f.reporter.start(nextRun),true);
 finishes[0](reply());await settle();assert.equal(JSON.parse(f.data.get(pendingKey)).runId,nextRun);
 assert.equal(f.reporter.getState().runId,nextRun);finishes[1](reply(receipt(nextRun)));await settle();
 assert.equal(f.reporter.getState().status,'saved');assert.equal(f.data.has(pendingKey),false);
});

test('pending recovery is allowed only for the exact same wallet and current run',async()=>{
 const f=fixture();f.data.set(pendingKey,JSON.stringify({version:1,runId:nextRun}));
 assert.equal(f.reporter.recoverPending(),false);assert.equal(f.calls.length,0);
 f.data.set(pendingKey,JSON.stringify({version:1,runId}));assert.equal(f.reporter.recoverPending(),true);await settle();
 assert.equal(f.calls.length,1);assert.equal(f.reporter.getState().status,'saved');
});

test('storage failures do not stop an in-tab save or the game',async()=>{
 const f=fixture({storageFailure:true});assert.equal(f.reporter.start(runId),true);await settle();
 assert.equal(f.reporter.getState().status,'saved');assert.equal(f.calls.length,1);
});

test('an invalid saved receipt never becomes saved UI and remains retryable',async()=>{
 const f=fixture({fetchImpl:async()=>reply(receipt(nextRun))});f.reporter.start(runId);await settle();
 await f.fire(1000);await f.fire(4000);assert.equal(f.reporter.getState().status,'retry');
 assert.equal(f.states.some(state=>state.status==='saved'),false);assert.ok(f.data.has(pendingKey));
});

test('a receipt for the same run but a different wallet is never shown as saved',async()=>{
 const f=fixture({fetchImpl:async()=>reply(receipt(runId,{sourceId:`run:${runId}:${otherWallet}`}))});
 f.reporter.start(runId);await settle();await f.fire(1000);await f.fire(4000);
 assert.equal(f.reporter.getState().status,'retry');assert.ok(f.data.has(pendingKey));
 assert.equal(f.states.some(state=>state.status==='saved'),false);
});

test('a valid duplicate receipt keeps the original server UTC date across midnight',async()=>{
 const f=fixture({fetchImpl:async()=>reply(receipt(runId,{alreadyRecorded:true}))});f.reporter.start(runId);await settle();
 assert.equal(f.reporter.getState().receipt.dateKey,'2026-10-31');assert.equal(f.reporter.getState().receipt.alreadyRecorded,true);
 assert.match(f.reporter.getState().message,/2026-10-31/);assert.equal(f.calls.length,1);
});

test('another tab replacing the pending marker is not cleared by this run receipt',async()=>{
 let finish;const f=fixture({fetchImpl:()=>new Promise(resolve=>{finish=resolve;})});f.reporter.start(runId);
 f.data.set(pendingKey,JSON.stringify({version:1,runId:nextRun}));finish(reply());await settle();
 assert.equal(f.reporter.getState().status,'saved');assert.equal(JSON.parse(f.data.get(pendingKey)).runId,nextRun);
});

test('request timeouts retry within the same bound and dispose cancels pending work',async()=>{
 const f=fixture({fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true}))});
 f.reporter.start(runId);
 assert.equal([...f.timers.values()].some(timer=>timer.delay===65000),true);
 assert.equal([...f.timers.values()].some(timer=>timer.delay===10000),false);
 await f.fire(65000);assert.equal(f.calls[0].options.signal.aborted,true);
 await f.fire(1000);assert.equal(f.calls.length,2);f.reporter.dispose();await settle();
 assert.equal(f.timers.size,0);assert.equal(f.reporter.start(runId),false);assert.equal(f.calls.length,2);
});
