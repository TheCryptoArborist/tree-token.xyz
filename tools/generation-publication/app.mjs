import {getWallets} from '@mysten/wallet-standard';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {verifyTransactionSignature} from '@mysten/sui/verify';
import {review,signReviewed,SENDER,CHAIN,check} from './core.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
const client=new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql'});
const KEY='tree-generation-empty-publication-v1';let wallet,account,packet,busy=false;
const pending=()=>localStorage.getItem(KEY);
const locked=()=>{if(pending()){$('publish').disabled=true;$('refresh').disabled=true;$('receipt').hidden=false;return true;}return false;};
const run=fn=>async()=>{if(busy)return;busy=true;$('publish').disabled=true;try{await fn();}catch(e){status(String(e.message));}finally{busy=false;locked();}};
async function fetchJSON(url){const r=await fetch(url,{cache:'no-store'});const j=await r.json();check(r.ok,j.error||'Review unavailable');return j;}
function current(){return wallet?.accounts.find(a=>a.address.toLowerCase()===SENDER);}
$('connect').onclick=run(async()=>{
 wallet=getWallets().get().find(w=>w.name==='Slush');check(wallet,'Open this page in the desktop browser with Slush installed.');
 await wallet.features['standard:connect'].connect();account=current();check(account,'Select your approved dev account in Slush.');
 check(wallet.features['sui:signTransaction']?.version==='2.0.0','Slush must support transaction signing v2.');
 wallet.features['standard:events']?.on('change',()=>{packet=null;$('publish').disabled=true;account=current();status('Wallet changed. Refresh the review.');});
 $('refresh').disabled=locked();status('Connected '+account.address+'. Refresh to verify the exact publication.');
});
$('refresh').onclick=run(async()=>{
 check(!pending(),'A publication is already pending. Check its receipt.');
 account=current();status('Refreshing identity and simulating the exact transaction…');
 packet=await fetchJSON('/api/generation-publication');await review(packet,account);
 status('Verified empty publication. Estimated gas: '+Number(packet.estimatedNetGasMist)/1e9+' SUI. Maximum: 0.1 SUI.\nNew upgrade and admin capabilities stay in your dev wallet.\nReview expires in two minutes. Slush will ask for your signature.');$('publish').disabled=false;
});
$('publish').onclick=run(async()=>{
 check(!pending(),'Check the existing publication receipt first.');check(packet,'Refresh the review first.');
 const selected=current();check(selected?.address===account?.address,'Wallet account changed.');
 status('Review the empty publication in Slush.');
 const signed=await signReviewed({packet,account:selected,sign:input=>wallet.features['sui:signTransaction'].signTransaction(input),verifySignature:(bytes,signature)=>verifyTransactionSignature(bytes,signature,{address:SENDER,client})});
 check(current()?.address===selected.address,'Wallet changed during signing. Nothing submitted.');
 // Persist first. If storage fails, never submit; if transport fails, retain digest.
 localStorage.setItem(KEY,signed.digest);check(pending()===signed.digest,'Cannot persist publication receipt.');
 status('Submitting '+signed.digest+'. Do not publish again if the response is delayed.');
 await client.core.executeTransaction({transaction:signed.bytes,signatures:[signed.signature]});
 await receipt();
});
async function receipt(){const digest=pending();check(digest,'No pending receipt.');status('Checking '+digest+'…');const r=await fetchJSON('/api/generation-publication?digest='+encodeURIComponent(digest));status('Publication verified. Save this receipt and return to Codex.\n'+JSON.stringify(r,null,2));}
$('receipt').onclick=run(receipt);
if(locked())status('A publication was already submitted or attempted. Check its receipt before any further action.');
