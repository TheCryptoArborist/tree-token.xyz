import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authPresentation,createAuthControls} from '../client/auth-controls.mjs';

function setup(initial={},options={}){
 const state={address:null,principal:null,busy:false,loading:false,loaded:false,...initial};
 const calls={connect:0,verify:0,changes:0,errors:[],events:[]};
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,hidden:false,focus(){calls.events.push('focus:'+id);}});return nodes.get(id);};
 const panel={scrollIntoView(){calls.events.push('panel');}};
 const native={disabled:false,focus(){calls.events.push('focus:connect');},click(){calls.connect++;calls.events.push('connect');}};
 const trigger={updateComplete:Promise.resolve(),shadowRoot:{querySelector:selector=>selector==='button[part~="trigger"]'?native:null}};
 const connect={updateComplete:Promise.resolve(),shadowRoot:{querySelector:selector=>selector==='internal-button'?trigger:null}};
 const document={
  fullscreenElement:null,getElementById:node,
  querySelector:selector=>selector==='.access'?panel:selector==='mysten-dapp-kit-connect-button'?connect:null,
  async exitFullscreen(){calls.events.push('exit');document.fullscreenElement=null;},
 };
 const controls=createAuthControls({document,getState:()=>state,verify:options.verify||(async()=>{calls.verify++;calls.events.push('verify');}),onError:error=>calls.errors.push(error),onChange:()=>calls.changes++});
 controls.render();
 return {state,calls,nodes,node,native,trigger,connect,panel,document,controls};
}

test('entry CTA describes connection, verification and opening without an inert unlock state',()=>{
 const s=setup();
 assert.equal(s.node('primary').textContent,'Connect Wallet');
 assert.equal(s.node('primary').disabled,false);
 assert.equal(s.node('verify').disabled,true);
 s.state.address='holder';s.controls.render();
 assert.equal(s.node('primary').textContent,'Verify NFTree');
 assert.equal(s.node('verify').disabled,false);
 s.state.busy=true;s.controls.render();
 assert.equal(s.node('primary').textContent,'Verifying NFTree…');
 assert.equal(s.node('primary').disabled,true);
 s.state.busy=false;s.state.principal={address:'holder'};s.state.loading=true;s.controls.render();
 assert.equal(s.node('primary').textContent,'Opening game…');
 assert.equal(s.node('verify').textContent,'NFTree verified');
 assert.equal(s.node('primary').disabled,true);
 s.state.loaded=true;s.node('primary').textContent='Launch seed';s.controls.render();
 assert.equal(s.node('primary').textContent,'Launch seed');
 assert.deepEqual(authPresentation({address:null,principal:null}),{label:'Connect Wallet',disabled:false});
});

test('disconnected entry opens the existing wallet component native trigger',async()=>{
 const s=setup();
 assert.equal(await s.controls.open(),true);
 assert.equal(s.calls.connect,1);
 assert.equal(s.calls.verify,0);
 assert.deepEqual(s.calls.events,['panel','focus:connect','connect']);
 assert.equal(s.controls.busy,false);
 assert.equal(s.node('primary').disabled,false);
 // Dismissing the wallet picker leaves the same connect action available.
 assert.equal(await s.controls.open(),true);
 assert.equal(s.calls.connect,2);
});

test('connected entry focuses and invokes existing NFTree verification only',async()=>{
 const s=setup({address:'holder'});
 assert.equal(await s.controls.open(),true);
 assert.equal(s.calls.connect,0);
 assert.equal(s.calls.verify,1);
 assert.deepEqual(s.calls.events,['panel','focus:verify','verify']);
});

test('auth panel outside the fullscreen cabinet becomes visible before wallet or verification',async()=>{
 for(const address of [null,'holder']){
  const s=setup({address});
  s.document.fullscreenElement={contains:()=>false};
  await s.controls.open();
  assert.equal(s.document.fullscreenElement,null);
  assert.deepEqual(s.calls.events.slice(0,2),['exit','panel']);
  assert.equal(s.calls.connect,address?0:1);
  assert.equal(s.calls.verify,address?1:0);
 }
});

test('failed fullscreen exit reports a visible retryable error without opening a hidden picker',async()=>{
 const s=setup();
 s.document.fullscreenElement={contains:()=>false};
 s.document.exitFullscreen=async()=>{};
 assert.equal(await s.controls.open(),false);
 assert.equal(s.calls.connect,0);
 assert.equal(s.calls.verify,0);
 assert.match(s.calls.errors[0],/Exit fullscreen/);
 assert.equal(s.controls.busy,false);
 assert.equal(s.node('primary').disabled,false);
});

test('auth panel already inside fullscreen remains in fullscreen',async()=>{
 const s=setup();
 s.document.fullscreenElement={contains:value=>value===s.panel};
 await s.controls.open();
 assert.equal(s.calls.events.includes('exit'),false);
 assert.equal(s.calls.connect,1);
});

test('double click and busy/loading states cannot create duplicate wallet prompts',async()=>{
 const s=setup();
 let release;
 s.connect.updateComplete=new Promise(resolve=>release=resolve);
 const first=s.controls.open();
 assert.equal(s.node('primary').textContent,'Opening wallet…');
 assert.equal(await s.controls.open(),false);
 release();await first;
 assert.equal(s.calls.connect,1);
 for(const state of [{busy:true},{busy:false,loading:true},{loading:false,principal:{address:'holder'}}]){
  Object.assign(s.state,state);
  assert.equal(await s.controls.open(),false);
 }
 assert.equal(s.calls.connect,1);
});

test('cancelled verification restores a retryable CTA and does not open a payment action',async()=>{
 let attempts=0;
 const s=setup({address:'holder'},{verify:async()=>{attempts++;throw Error('Sign-in cancelled');}});
 assert.equal(await s.controls.open(),false);
 assert.equal(s.controls.busy,false);
 assert.equal(s.node('primary').disabled,false);
 assert.equal(s.controls.label,'Verify NFTree');
 assert.equal(s.calls.connect,0);
 assert.deepEqual(s.calls.errors,['Sign-in cancelled']);
 await s.controls.open();
 assert.equal(attempts,2);
});

test('wallet change while leaving fullscreen cannot sign for the previous account',async()=>{
 const s=setup({address:'first'});
 s.document.fullscreenElement={contains:()=>false};
 s.document.exitFullscreen=async()=>{s.state.address='second';s.document.fullscreenElement=null;};
 assert.equal(await s.controls.open(),false);
 assert.equal(s.calls.verify,0);
});

test('missing native trigger fails clearly and can retry after the component is ready',async()=>{
 const s=setup();
 const shadow=s.connect.shadowRoot;s.connect.shadowRoot=null;
 assert.equal(await s.controls.open(),false);
 assert.match(s.calls.errors[0],/Connect Wallet in the NFTree access panel/);
 assert.equal(s.controls.busy,false);
 s.connect.shadowRoot=shadow;
 assert.equal(await s.controls.open(),true);
});

test('native trigger selector matches the pinned wallet component and uses its own modal',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../node_modules/@mysten/dapp-kit-core/package.json',import.meta.url)));
 assert.equal(manifest.version,'1.6.41');
 const source=fs.readFileSync(new URL('../node_modules/@mysten/dapp-kit-core/src/web/dapp-kit-connect-button.ts',import.meta.url),'utf8');
 const button=fs.readFileSync(new URL('../node_modules/@mysten/dapp-kit-core/src/web/internal/button.ts',import.meta.url),'utf8');
 assert.match(source,/<internal-button exportparts="trigger" @click=\$\{this\.#openModal\}/);
 assert.match(source,/this\._modal\.show\(\)/);
 assert.match(button,/<button\s+part="trigger"/);
});

test('gateway CTA verifies a personal sign-in and recovers from cancellation without any TREE payment',async()=>{
 const s=setup(),requests=[];
 let connection,signs=0,transactions=0;
 const kit={stores:{$connection:{subscribe(fn){connection=fn;}}},signPersonalMessage:async()=>{signs++;throw Error('Sign-in cancelled');},signTransaction:async()=>{transactions++;},disconnectWallet:async()=>{}};
 const window={dispatchEvent(event){s.calls.events.push(event.type);}};
 const location={origin:'https://tree-token.xyz'};
 const fetch=async(path,options)=>{
  const body=options?.body?JSON.parse(options.body):null;requests.push({path,body});
  if(body?.action==='challenge'){
   const nonce='a'.repeat(64),expiresAt=Date.now()+120000;
   const message=['Canopy Breaker NFTree access','Origin: '+location.origin,'Network: sui:mainnet','Wallet: holder','Nonce: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),'Sign in only. No transaction, token transfer, or token approval.'].join('\n');
   return {ok:true,json:async()=>({address:'holder',origin:location.origin,nonce,expiresAt,message})};
  }
  return {ok:false,status:401,json:async()=>({error:'Verify your NFTree to enter.'})};
 };
 s.document.addEventListener=()=>{};
 const source=fs.readFileSync(new URL('../client/gateway.mjs',import.meta.url),'utf8').replace(/^import .+;\n/gm,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('createDAppKit','SuiGrpcClient','paymentTransaction','createCheckoutFlow','createAuthControls','document','window','fetch','location','Event','setInterval','TextEncoder',source)(()=>kit,class{},()=>{transactions++;},()=>({phase:'idle'}),createAuthControls,s.document,window,fetch,location,Event,()=>{},TextEncoder);
 assert.equal(s.node('primary').textContent,'Connect Wallet');
 assert.equal(await s.node('primary').onclick(),true);
 assert.equal(s.calls.connect,1);
 connection({isConnected:true,account:{address:'holder',chains:['sui:mainnet']}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.node('primary').textContent,'Verify NFTree');
 assert.equal(await s.node('primary').onclick(),true);
 assert.equal(signs,1);
 assert.equal(transactions,0);
 assert.equal(window.breakerSession.authBusy,false);
 assert.equal(s.node('primary').textContent,'Verify NFTree');
 assert.equal(s.node('verify').disabled,false);
 assert.match(s.node('gate-status').textContent,/Sign-in cancelled/);
 assert.equal(requests.some(request=>request.path==='./api/game'),false);
 assert.equal(requests.filter(request=>request.body?.action==='challenge').length,1);
 assert.equal(requests.some(request=>request.body?.action==='verify'),false);
 assert.equal(s.calls.events.includes('breaker-ready'),true);
});
