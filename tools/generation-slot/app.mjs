import {connectApproved,approved} from './connection.mjs';
import {getWallets} from '@mysten/wallet-standard';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {verifyTransactionSignature} from '@mysten/sui/verify';
import {review,signReviewed,SENDER,CHAIN,check,requireSigningLocation,responseReviewClock} from './core.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
const client=new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql'});
const KEY='tree-generation-empty-slot-v1';let wallet,account,packet,reviewNow,sharedAccounts,unsubscribe,busy=false;
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
   $('refresh').disabled=!account||locked();status(account?'Connected '+account.address+'. Refresh the slot review.':'Slush no longer shares the approved account. Click Connect to review permissions.');}
 });
 account=await connectApproved(wallet,{status});
 // The connect result is authoritative even when the wallet getter updates later.
 sharedAccounts=[account];
 $('refresh').disabled=locked();status('Connected '+account.address+'. Refresh to verify the exact slot creation.');
});
$('refresh').onclick=run(async()=>{
 check(!pending(),'A slot creation is already pending. Check its receipt.');
 account=current();status('Refreshing identity and simulating the exact transaction…');
 const requestStarted=performance.now();
 const response=await fetch('/api/generation-slot',{cache:'no-store'});
 const next=await response.json();const received=performance.now();check(response.ok,next.error||'Review unavailable');
 const clock=responseReviewClock(next,{date:response.headers.get('date'),age:response.headers.get('age'),requestStarted,received});
 await review(next,account,clock());packet=next;reviewNow=clock;
 status('Verified empty slot creation. Estimated gas: '+Number(packet.estimatedNetGasMist)/1e9+' SUI. Maximum: 0.02 SUI.\nCreates one empty custody slot; no NFT deposit. Admin capabilities stay in your dev wallet.\nReview expires in two minutes. Slush will ask for your signature.');$('publish').disabled=false;
});
$('publish').onclick=run(async()=>{
 check(!pending(),'Check the existing slot creation receipt first.');check(packet,'Refresh the review first.');
 const selected=current();check(selected?.address===account?.address,'Wallet account changed.');
 status('Review the empty slot creation in Slush.');
 const signed=await signReviewed({packet,account:selected,now:reviewNow,sign:input=>wallet.features['sui:signTransaction'].signTransaction(input),verifySignature:(bytes,signature)=>verifyTransactionSignature(bytes,signature,{address:SENDER,client})});
 check(current()?.address===selected.address,'Wallet changed during signing. Nothing submitted.');
 // Persist first. If storage fails, never submit; if transport fails, retain digest.
 localStorage.setItem(KEY,signed.digest);check(pending()===signed.digest,'Cannot persist slot creation receipt.');
 status('Submitting '+signed.digest+'. Do not create another slot if the response is delayed.');
 await client.core.executeTransaction({transaction:signed.bytes,signatures:[signed.signature]});
 await receipt();
});
async function receipt(){const digest=pending();check(digest,'No pending receipt.');status('Checking '+digest+'…');const r=await fetchJSON('/api/generation-slot?digest='+encodeURIComponent(digest));status('Slot creation verified. Save this receipt and return to Codex.\n'+JSON.stringify(r,null,2));}
$('receipt').onclick=run(receipt);
if(locked())status('A slot creation was already submitted or attempted. Check its receipt before any further action.');

try{requireSigningLocation(window.location);if(!pending())status('Ready to connect · connection update 2. Select Connect desktop Slush.');}catch(e){for(const id of ['connect','refresh','publish','receipt'])$(id).disabled=true;status(e.message);}
