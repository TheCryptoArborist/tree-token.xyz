import {connectApproved,approved} from '../generation-slot/connection.mjs';
import {getWallets} from '@mysten/wallet-standard';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {verifyTransactionSignature} from '@mysten/sui/verify';
import {review,signReviewed,SENDER,CHAIN,check,requireSigningLocation,responseReviewClock} from './core.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
const client=new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql'});
const KEY='tree-generation-binding-v1';let wallet,account,packet,reviewNow,sharedAccounts,unsubscribe,busy=false;
const pending=()=>localStorage.getItem(KEY);
const locked=()=>{if(pending()){$('publish').disabled=true;$('refresh').disabled=true;$('receipt').hidden=false;return true;}return false;};
const run=fn=>async()=>{if(busy)return;busy=true;$('publish').disabled=true;try{requireSigningLocation(window.location);await fn();}catch(e){status(String(e.message));}finally{busy=false;locked();}};
async function fetchJSON(url){const r=await fetch(url,{cache:'no-store'});const j=await r.json();check(r.ok,j.error||'Review unavailable');return j;}
function current(){return approved(sharedAccounts??wallet?.accounts);}
$('connect').onclick=run(async()=>{
 packet=null;account=undefined;$('refresh').disabled=true;status('Checking desktop Slush…');
 wallet=getWallets().get().find(w=>w.name==='Slush');
 unsubscribe?.();sharedAccounts=undefined;
 unsubscribe=wallet?.features['standard:events']?.on('change',change=>{
  if(change.accounts){sharedAccounts=change.accounts;account=current();packet=null;$('publish').disabled=true;
   $('refresh').disabled=!account||locked();status(account?'Connected '+account.address+'. Refresh the binding review.':'Slush no longer shares the approved account. Click Connect to review permissions.');}
 });
 account=await connectApproved(wallet,{status});
 // The connect result is authoritative even when the wallet getter updates later.
 sharedAccounts=[account];
 $('refresh').disabled=locked();status('Connected '+account.address+'. Refresh to verify the exact binding.');
});
$('refresh').onclick=run(async()=>{
 check(!pending(),'A binding is already pending. Check its receipt.');
 account=current();status('Refreshing identity and simulating the exact transaction…');
 const requestStarted=performance.now();
 const response=await fetch('/api/generation-binding',{cache:'no-store'});
 const next=await response.json();const received=performance.now();check(response.ok,next.error||'Review unavailable');
 const clock=responseReviewClock(next,{date:response.headers.get('date'),age:response.headers.get('age'),requestStarted,received});
 await review(next,account,clock());packet=next;reviewNow=clock;
 status('Verified binding review. Estimated gas: '+Number(packet.estimatedNetGasMist)/1e9+' SUI. Maximum for this step: 0.1 SUI.\nStep 6 of 6: binds the empty Sui vault to the verified new BNB adapter. No NFT deposit, sales or gameplay activation. Admin capabilities stay in your dev wallet.\nReview expires in two minutes. Slush will ask for your signature.');$('publish').disabled=false;
});
async function publishBinding(){
 check(!pending(),'Check the existing binding receipt first.');check(packet,'Refresh the review first.');
 const selected=current();check(selected?.address===account?.address,'Wallet account changed.');
 status('Review the binding in Slush.');
 const signed=await signReviewed({packet,account:selected,now:reviewNow,sign:input=>wallet.features['sui:signTransaction'].signTransaction(input),verifySignature:(bytes,signature)=>verifyTransactionSignature(bytes,signature,{address:SENDER,client})});
 check(current()?.address===selected.address,'Wallet changed during signing. Nothing submitted.');
 // Persist first. If storage fails, never submit; if transport fails, retain digest.
 localStorage.setItem(KEY,signed.digest);check(pending()===signed.digest,'Cannot persist binding receipt.');
 status('Submitting '+signed.digest+'. Do not repeat binding if the response is delayed.');
 await client.core.executeTransaction({transaction:signed.bytes,signatures:[signed.signature]});
 await receipt();
}
$('publish').onclick=run(async()=>{check(navigator.locks?.request,'Use your current desktop browser for signing coordination.');await navigator.locks.request(KEY,{ifAvailable:true},async lock=>{check(lock,'Another tab is handling binding.');await publishBinding();});});
async function receipt(){const digest=pending();check(digest,'No pending receipt.');status('Checking '+digest+'…');const r=await fetchJSON('/api/generation-binding?digest='+encodeURIComponent(digest));status('Binding verified. Save this receipt and return to Codex.\n'+JSON.stringify(r,null,2));}
$('receipt').onclick=run(receipt);
if(locked())status('A binding was already submitted or attempted. Check its receipt before any further action.');

try{requireSigningLocation(window.location);if(!pending())status('Ready to configure the new application. Select Connect desktop Slush.');}catch(e){for(const id of ['connect','refresh','publish','receipt'])$(id).disabled=true;status(e.message);}
