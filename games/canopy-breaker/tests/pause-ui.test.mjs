import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,step,PICKUPS,BIOMES} from '../src/engine.js';

// Run the shipped app event handlers and RAF loop with a controllable browser,
// network and clock. Physics remains the same deterministic engine as production.
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace(/await Promise\.all\(\[loadPickupArt\(\),loadBlockArt\(\),loadBackgroundArt\(\)\]\);\nawait open\(\);requestAnimationFrame\(frame\);\s*$/,'');

const settle=async()=>{for(let n=0;n<16;n++)await Promise.resolve();};
function playing(id='run-a'){
 const state=createGame(123);state.status='playing';state.balls=[{x:400,y:550,vx:0,vy:315,primary:true,attached:false}];
 return {id,revision:0,state};
}
function acknowledged(base,call){
 const result=structuredClone(base);for(const input of call.input.inputs)step(result.state,input);result.revision=call.input.revision+1;return result;
}
function harness(){
 let now=0,subscriber=null,pad={axis:0,fire:false,startPressed:false,firePressed:false},drawn=null;
 const elements=new Map(),events=new Map(),docEvents=new Map(),calls=[],dispatched=[];
 const add=(map,name,fn)=>map.set(name,[...(map.get(name)||[]),fn]);
 const context=new Proxy({},{get:(object,key)=>object[key]??(()=>{}),set:(object,key,value)=>(object[key]=value,true)});
 function element(id){
  if(!elements.has(id))elements.set(id,{
   id,textContent:'',hidden:true,disabled:false,open:false,events:new Map(),tagName:'DIV',
   replaceChildren(){},append(){},classList:{add(){},remove(){},toggle(){}},
   addEventListener(name,fn){add(this.events,name,fn);},setAttribute(){},focus(){},setPointerCapture(){},
   getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,width:800,height:900}),
   showModal(){this.open=true;},close(){this.open=false;for(const fn of this.events.get('close')||[])fn();},
  });return elements.get(id);
 }
 const api={
  account:{address:'wallet-a'},
  request(action,input){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});calls.push({action,input,resolve,reject});return promise;},
  history:async()=>[],subscribe(fn){subscriber=fn;},openAuth(){},
 };
 const window={breakerSession:api,addEventListener(name,fn){add(events,name,fn);},dispatchEvent(event){dispatched.push(event.type);},location:{assign(){}}};
 const document={getElementById:element,querySelectorAll:()=>[],querySelector:selector=>element(selector==='.field'?'field':'cabinet'),addEventListener(name,fn){add(docEvents,name,fn);},hidden:false,createElement:()=>element('created')};
 const prelude=`const sound=()=>{},wakeAudio=async()=>{},setSound=()=>{},createControllerTracker=()=>({poll:readPad,pad:null}),createControllerCalibration=()=>({}),pickupIcon=()=>({});`;
 const boot=new Function('window','document','matchMedia','localStorage','requestAnimationFrame','setTimeout','clearTimeout','performance','step','PICKUPS','BIOMES','draw','readPad',prelude+source+`
 return {replace,frame,primary,togglePause,flush,open,pauseGame,requestResume,
  snapshot:()=>({run:structuredClone(run),queue:structuredClone(queue),paused,clock,resumeAt,target,syncError,sending:!!sending})};`);
 const app=boot(window,document,()=>({matches:false}),{},()=>{},()=>1,()=>{},{now:()=>now},step,PICKUPS,BIOMES,(_ctx,state)=>{drawn=structuredClone(state);},()=>pad);
 function emit(map,name,event={}){for(const fn of map.get(name)||[])fn(event);}
 return {
  app,api,calls,dispatched,document,element,
  frameAt(time){now=time;app.frame(time);},
  drawn:()=>structuredClone(drawn),
  event(name,event){emit(events,name,event);},
  key(key,repeat=false){emit(events,'keydown',{key,repeat,target:{tagName:'CANVAS'},preventDefault(){}});},
  pointer(x){emit(element('field').events,'pointermove',{clientX:x});},
  setHidden(hidden){document.hidden=hidden;emit(docEvents,'visibilitychange');},
  refresh(){subscriber(api.account);},
  logout(){api.account=null;subscriber(null);},
  login(address='wallet-b'){api.account={address};subscriber(api.account);},
  setPad(input){pad={axis:0,fire:false,startPressed:false,firePressed:false,...input};},
 };
}

test('manual, focus, hidden-tab and leaderboard pauses explain their actual trigger',()=>{
 const manual=harness();manual.app.replace(playing());manual.key('p');assert.equal(manual.app.snapshot().paused,true);manual.key('p',true);assert.equal(manual.app.snapshot().paused,true);
 const focus=harness();focus.app.replace(playing());focus.event('blur');assert.equal(focus.app.snapshot().paused,true);assert.match(focus.element('overlay-text').textContent,/focus|window/i);
 const hidden=harness();hidden.app.replace(playing());hidden.setHidden(true);assert.equal(hidden.app.snapshot().paused,true);assert.match(hidden.element('overlay-text').textContent,/tab|hidden|background/i);
 const leaderboard=harness();leaderboard.app.replace(playing());leaderboard.event('breaker-view-leaderboard');assert.equal(leaderboard.app.snapshot().paused,true);assert.match(leaderboard.element('overlay-text').textContent,/leaderboard/i);
});

test('network backpressure holds physics and drains every queued input before resume',async()=>{
 const h=harness(),base=playing();h.app.replace(structuredClone(base));let time=0;
 while(!h.app.snapshot().paused&&time<5000)h.frameAt(time+=20);
 const held=h.app.snapshot();assert.equal(held.paused,true);assert.equal(held.queue.length,120);assert.equal(h.calls.length,1);assert.equal(h.element('primary').disabled,true);assert.match(h.element('overlay-text').textContent,/sav|connection|reconnect/i);
 h.frameAt(time+=1000);const frozen=h.drawn();
 const first=acknowledged(base,h.calls[0]);h.calls[0].resolve(first);await settle();
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].input.revision,1);assert.equal(h.app.snapshot().paused,true);
 h.frameAt(time+=20);assert.deepEqual(h.drawn(),frozen);
 const second=acknowledged(first,h.calls[1]);h.calls[1].resolve(second);await settle();
 assert.equal(h.app.snapshot().queue.length,0);assert.equal(h.app.snapshot().sending,false);assert.equal(h.app.snapshot().run.state.tick,held.run.state.tick);
 assert.equal(h.calls.reduce((sum,call)=>sum+call.input.inputs.length,0),held.run.state.tick-base.state.tick);
 assert.equal(h.element('primary').disabled,false);assert.equal(h.app.snapshot().paused,true);
});

test('a late resync cannot move the paused picture; resume countdown runs no physics or paddle teleport',async()=>{
 const h=harness();h.app.replace(playing());for(let time=20;time<=200;time+=20)h.frameAt(time);h.app.togglePause();h.frameAt(220);const frozen=h.drawn();
 assert.equal(h.calls.length,1);const resync=playing();resync.resync=true;resync.revision=8;resync.state.tick=100;resync.state.balls[0].y=770;
 h.calls[0].resolve(resync);await settle();h.frameAt(240);assert.deepEqual(h.drawn(),frozen);assert.equal(h.app.snapshot().run.state.balls[0].y,770);
 await h.app.primary();const before=h.app.snapshot();assert.equal(before.paused,true);assert.equal(before.resumeAt,3240);
 h.pointer(700);h.frameAt(1240);assert.equal(h.app.snapshot().target,700);assert.equal(h.app.snapshot().run.state.paddle,before.run.state.paddle);assert.equal(h.drawn().paddle,before.run.state.paddle);assert.equal(h.app.snapshot().run.state.tick,before.run.state.tick);
 h.frameAt(3239);assert.equal(h.app.snapshot().run.state.tick,before.run.state.tick);assert.equal(h.app.snapshot().paused,true);
 h.frameAt(3240);assert.equal(h.app.snapshot().paused,false);assert.equal(h.app.snapshot().run.state.tick,before.run.state.tick);
 h.frameAt(3260);assert(h.app.snapshot().run.state.tick>before.run.state.tick);assert(h.app.snapshot().run.state.tick<=before.run.state.tick+2);
 assert(h.app.snapshot().run.state.paddle<=before.run.state.paddle+32);
});

test('a hidden tab cancels countdown and returning does not restart gameplay',async()=>{
 const h=harness();h.app.replace(playing());h.app.togglePause();await h.app.primary();assert(h.app.snapshot().resumeAt>0);h.setHidden(true);assert.equal(h.app.snapshot().resumeAt,0);
 h.frameAt(5000);h.setHidden(false);h.frameAt(6000);assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().run.state.tick,0);
});

test('controller changes pause with a reason and interrupt a pending resume',async()=>{
 const h=harness();h.app.replace(playing());h.setPad({disconnected:true});h.frameAt(0);h.setPad({});await settle();
 assert.equal(h.app.snapshot().paused,true);assert.match(h.element('overlay-text').textContent,/controller.*changed|controller.*disconnected/i);await h.app.primary();assert(h.app.snapshot().resumeAt>0);
 h.setPad({disconnected:true});h.frameAt(1000);h.setPad({});await settle();assert.equal(h.app.snapshot().resumeAt,0);h.frameAt(5000);assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().run.state.tick,0);
});

test('opening controller setup interrupts countdown and closing it requires another resume',async()=>{
 const h=harness();h.app.replace(playing());h.app.togglePause();await h.app.primary();assert(h.app.snapshot().resumeAt>0);h.element('controller-setup').onclick();await settle();
 assert.equal(h.element('controller-dialog').open,true);assert.equal(h.app.snapshot().resumeAt,0);assert.match(h.element('overlay-text').textContent,/controller setup/i);h.frameAt(5000);h.element('controller-dialog').close();h.frameAt(6000);assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().run.state.tick,0);
 await h.app.primary();assert.equal(h.app.snapshot().resumeAt,9000);
});

test('an externally opened modal cancels countdown instead of resuming immediately when closed',async()=>{
 for(const modal of ['checkout','controller-dialog']){
  const h=harness();h.app.replace(playing());h.app.togglePause();await h.app.primary();h.element(modal).showModal();h.frameAt(1000);await settle();assert.equal(h.app.snapshot().resumeAt,0);assert.equal(h.app.snapshot().paused,true);
  h.frameAt(5000);h.element(modal).close();h.frameAt(6000);assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().run.state.tick,0);await h.app.primary();assert.equal(h.app.snapshot().resumeAt,9000);
 }
});

test('logout or a replacement run cancels an old resume countdown',async()=>{
 const logout=harness();logout.app.replace(playing());logout.app.togglePause();await logout.app.primary();logout.logout();logout.frameAt(5000);assert.equal(logout.app.snapshot().run,null);assert.equal(logout.app.snapshot().resumeAt,0);assert.equal(logout.calls.length,0);
 const replaced=harness();replaced.app.replace(playing());replaced.app.togglePause();await replaced.app.primary();const next=playing('run-b');next.state.status='ready';next.state.balls[0].attached=true;next.state.balls[0].vx=0;next.state.balls[0].vy=0;replaced.app.replace(next);assert.equal(replaced.app.snapshot().resumeAt,0);replaced.frameAt(5000);assert.equal(replaced.app.snapshot().run.id,'run-b');assert.equal(replaced.app.snapshot().run.state.status,'ready');
});

test('same-account access refresh neither pauses gameplay nor cancels an intended resume',async()=>{
 const h=harness();h.app.replace(playing());h.refresh();assert.equal(h.app.snapshot().paused,false);h.app.togglePause();await h.app.primary();const deadline=h.app.snapshot().resumeAt;h.refresh();assert.equal(h.app.snapshot().resumeAt,deadline);h.frameAt(deadline);h.frameAt(deadline+20);assert.equal(h.app.snapshot().paused,false);assert(h.app.snapshot().run.state.tick>0);
});

test('a failed or lost checkpoint retries the same revision and cannot advance accepted inputs twice',async()=>{
 const h=harness(),base=playing();h.app.replace(structuredClone(base));for(let time=20;time<=200;time+=20)h.frameAt(time);h.app.togglePause();
 const accepted=acknowledged(base,h.calls[0]),originalInputs=structuredClone(h.calls[0].input);h.calls[0].reject(Error('Connection interrupted'));await settle();
 assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().syncError,'Connection interrupted');assert.equal(h.app.snapshot().queue.length,originalInputs.inputs.length);
 const reconnect=h.app.primary();await settle();assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].input,originalInputs);
 h.calls[1].resolve({...accepted,resync:true});await reconnect;await settle();
 assert.equal(h.app.snapshot().syncError,'');assert.equal(h.app.snapshot().run.state.tick,accepted.state.tick);assert.equal(h.app.snapshot().queue.length,0);assert.equal(h.app.snapshot().paused,true);assert.equal(h.app.snapshot().resumeAt,0);
 await h.app.primary();assert(h.app.snapshot().resumeAt>0);assert.equal(h.app.snapshot().run.state.tick,accepted.state.tick);
});

test('old-wallet frame acknowledgements cannot overwrite the replacement wallet run',async()=>{
 const h=harness(),old=playing();h.app.replace(structuredClone(old));h.frameAt(20);h.app.togglePause();assert.equal(h.calls[0].action,'frames');h.logout();h.login();assert.equal(h.calls[1].action,'open');
 h.calls[0].resolve(acknowledged(old,h.calls[0]));await settle();assert.equal(h.app.snapshot().run,null);
 h.calls[1].resolve(playing('wallet-b-run'));await settle();assert.equal(h.app.snapshot().run.id,'wallet-b-run');assert.equal(h.app.snapshot().paused,false);assert.equal(h.app.snapshot().resumeAt,0);
});

test('a pending old-wallet open cannot block a fresh wallet open or publish its late error',async()=>{
 const h=harness(),oldOpen=h.app.open();assert.equal(h.calls.length,1);h.logout();h.login();assert.equal(h.calls.length,2);assert.equal(h.calls[1].action,'open');
 h.calls[0].reject(Error('Expired old-wallet session'));await oldOpen;await settle();assert.equal(h.app.snapshot().syncError,'');h.calls[1].resolve(playing('wallet-b-run'));await settle();assert.equal(h.app.snapshot().run.id,'wallet-b-run');assert.equal(h.app.snapshot().syncError,'');
});

test('terminal saved state releases pause and preserves game-over actions and score notification',async()=>{
 const h=harness();h.app.replace(playing());h.frameAt(20);h.app.togglePause();assert.equal(h.calls.length,1);
 const terminal=playing();terminal.resync=true;terminal.revision=3;terminal.state.status='gameover';terminal.state.lives=0;terminal.state.balls=[];terminal.state.score=18500;h.calls[0].resolve(terminal);await settle();
 assert.equal(h.app.snapshot().paused,false);assert.equal(h.app.snapshot().resumeAt,0);assert.equal(h.element('primary').textContent,'Continue · 20,000 TREE');assert.equal(h.element('secondary').hidden,false);assert.equal(h.element('secondary').textContent,'Start New Game · Free');assert.equal(h.app.snapshot().run.state.score,18500);assert.deepEqual(h.dispatched,['breaker-score-saved']);
});

test('a predicted game over notifies completion listeners only after its terminal inputs are saved',async()=>{
 const h=harness(),base=playing();base.state.lives=1;base.state.balls[0].x=700;base.state.balls[0].y=500;h.app.replace(structuredClone(base));let time=0;
 while(h.app.snapshot().run.state.status!=='gameover'&&time<2000)h.frameAt(time+=20);
 assert.equal(h.app.snapshot().run.state.status,'gameover');assert.equal(h.calls.length,1);const first=acknowledged(base,h.calls[0]);assert.equal(first.state.status,'playing');h.calls[0].resolve(first);await settle();assert.deepEqual(h.dispatched,[]);
 const saving=h.app.flush();assert.equal(h.calls.length,2);const terminal=acknowledged(first,h.calls[1]);assert.equal(terminal.state.status,'gameover');h.calls[1].resolve(terminal);await saving;assert.deepEqual(h.dispatched,['breaker-score-saved']);
});
