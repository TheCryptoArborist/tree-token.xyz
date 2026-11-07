import {createDAppKit} from '@mysten/dapp-kit-core';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import '@mysten/dapp-kit-core/web';
import {paymentTransaction} from './payment-transaction.mjs';
import {createCheckoutFlow} from './checkout-flow.mjs';
import {createAuthControls} from './auth-controls.mjs';
const kit=createDAppKit({networks:['mainnet'],defaultNetwork:'mainnet',autoConnect:true,storageKey:'canopy-breaker-wallet',createClient:network=>new SuiGrpcClient({network,baseUrl:'https://fullnode.mainnet.sui.io:443'})});
const $=id=>document.getElementById(id),status=$('gate-status');document.querySelector('mysten-dapp-kit-connect-button').instance=kit;
let address=null,principal=null,revision=0,busy=false,loaded=false,loading=false;
const auth=createAuthControls({document,getState:()=>({address,principal,busy,loaded,loading}),verify:()=>verifyNFTree(),onError:text=>{status.textContent=text;if(!principal)$('overlay-note').textContent=text;},onChange:()=>window.dispatchEvent(new Event('breaker-auth-change'))});
const listeners=new Set(),notify=()=>listeners.forEach(fn=>fn(principal));
function lock(text){principal=null;status.textContent=text;auth.render();notify();}
const post=async(body,path='./api/access')=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){if(r.status===401||r.status===403)lock(d.error);throw Error(d.error||'Connection interrupted');}return d;};
function validate(d){if(d.verified!==true||d.address!==address||!Number.isSafeInteger(d.count)||d.count<1||!Number.isInteger(d.rarity)||d.rarity<0||d.rarity>5||!Number.isFinite(d.expiresAt)||d.expiresAt<=Date.now())throw Error('Verify an NFTree in the connected wallet');return Object.freeze({address:d.address,count:d.count,rarity:d.rarity,expiresAt:d.expiresAt});}
async function accept(d,stamp){if(stamp!==revision)return;principal=validate(d);status.textContent=`NFTree verified · ${principal.count} held · ${address.slice(0,8)}…${address.slice(-6)}`;auth.render();notify();if(!loaded){loading=true;auth.render();try{await import('./src/app.js');loaded=true;}catch(e){loaded=false;lock('The game could not open. Verify again to retry.');}finally{loading=false;auth.render();}}}
async function refresh(){if(!address||busy||loading)return;const stamp=revision;try{const r=await fetch('./api/access',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(stamp!==revision)return;if(!r.ok)throw Error(d.error);await accept(d,stamp);}catch(e){if(stamp===revision)lock(e.message||'Verify your NFTree again');}}
async function verifyNFTree(){if(!address||busy||loading||principal)return;busy=true;const stamp=revision;auth.render();try{
 status.textContent='Preparing your sign-in message…';const c=await post({action:'challenge',address});
 const expected=['Canopy Breaker NFTree access','Origin: '+location.origin,'Network: sui:mainnet','Wallet: '+address,'Nonce: '+c.nonce,'Expires: '+new Date(c.expiresAt).toISOString(),'Sign in only. No transaction, token transfer, or token approval.'].join('\n');
 if(c.address!==address||c.origin!==location.origin||!/^[a-f0-9]{64}$/.test(c.nonce)||c.expiresAt<=Date.now()||c.expiresAt>Date.now()+360000||c.message!==expected||stamp!==revision)throw Error('Sign-in message expired or invalid');
 $('sign-message').textContent=c.message;$('sign-details').open=true;status.textContent='Approve the displayed sign-in message. No token transfer or gas fee.';
 const signed=await kit.signPersonalMessage({message:new TextEncoder().encode(c.message)});if(stamp!==revision)throw Error('Wallet changed. Verify again.');const d=await post({action:'verify',address,nonce:c.nonce,signature:signed.signature});if(stamp!==revision){await post({action:'logout'});return;}await accept(d,stamp);
 }catch(e){if(stamp===revision)lock(e.message||'Sign-in cancelled. Try again.');}finally{busy=false;auth.render();}}
$('verify').onclick=verifyNFTree;
function wallet(){if(!principal||principal.expiresAt<=Date.now()||principal.address!==address)throw Error('Verify your NFTree wallet again');return principal.address;}
const request=async(action,input={})=>{wallet();return post({action,...input},'./api/game');};
const flow=createCheckoutFlow({
 sign:async invoice=>{const owner=wallet(),tx=await paymentTransaction(kit.getClient('mainnet'),invoice,owner);if(BigInt(invoice.amount)!==20000n*10n**BigInt(invoice.decimals)||invoice.product!=='continue')throw Error('Unexpected restart price');const signed=await kit.signTransaction({transaction:tx,network:'mainnet'});if(wallet()!==owner)throw Error('Wallet changed; no payment was submitted');return signed;},
 bind:(id,signed)=>request('bind',{id,signed}),execute:async(signed,digest,id,owner)=>{if(wallet()!==owner)throw Error('Reconnect the original wallet to recover this recorded payment');const r=await request('submit',{id});if(r.digest!==digest)throw Error('Unexpected payment digest');},submitStored:id=>request('submit',{id}),redeem:id=>request('redeem',{id}),onChange:()=>{$('checkout-status').textContent=flow.phase==='idle'?'':({signing:'Waiting for wallet approval…',binding:'Recording your signed payment…',submitting:'Submitting the recorded transfer…',verifying:'Verifying the Mainnet receipt…'}[flow.phase]||'');}
});
window.breakerSession=Object.freeze({
 get account(){return principal;},get authLabel(){return auth.label;},get authBusy(){return auth.busy;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},request,
 openAuth:()=>auth.open(),
 async history(){wallet();const r=await fetch('./api/game',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);if(!d.enabled)throw Error('The game is awaiting activation. No payment is available.');flow.observeHistory(d.invoices??[]);return d.invoices;},
 pay:invoice=>flow.pay(invoice),recover:id=>flow.recover(id),resume:id=>flow.resume(id),
 async cancel(id){const r=await request('cancel',{id});flow.clearUnsigned(id);return r;},async reconcile(id){const r=await request('reconcile',{id});flow.clearUnsigned(id);return r;}
});
window.dispatchEvent(new Event('breaker-ready'));
$('primary').onclick=()=>window.breakerSession.openAuth();
$('disconnect').onclick=async()=>{revision++;lock('Wallet disconnected. Connect an NFTree holder wallet.');await post({action:'logout'}).catch(()=>{});await kit.disconnectWallet();};
kit.stores.$connection.subscribe(c=>{const next=c.isConnected&&c.account?.chains?.includes('sui:mainnet')?c.account.address:null;if(next===address)return;address=next;revision++;$('disconnect').hidden=!address;lock(address?'Wallet connected. Verify your NFTree to enter.':'Connect a Sui Mainnet wallet to begin.');if(address)refresh();else post({action:'logout'}).catch(()=>{});});
auth.render();
setInterval(()=>{if(principal&&principal.expiresAt<=Date.now())lock('Your session expired. Verify your NFTree again.');},1000);
setInterval(()=>{if(principal&&!document.hidden)refresh();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
