// Source-only review UI. Inject existing personal-message wallet adapters; no sends.
const check=(ok)=>{if(!ok)throw Error('review-required');};
const hex=(v,n)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export function createBnbCheckoutReview({transport,getContext,signSuiMessage,signBnbMessage,clock=Date.now}){
 let busy=false,disposed=false,context=null,challenge=null,suiSignature=null,bnbSignature=null,phase='idle',quote=null;
 const identity=c=>JSON.stringify(c);
 function current(){const c=structuredClone(getContext());check(c&&hex(c.sessionToken,64)&&/^0x[a-f0-9]{64}$/.test(c.suiWallet)&&/^0x[a-f0-9]{40}$/.test(c.payer)&&!/^0x0{40}$/.test(c.payer)&&uuid(c.accountId)&&uuid(c.runId)&&c.chainId===56&&c.network==='sui:mainnet'&&Number.isSafeInteger(c.sequence)&&c.sequence>0&&typeof c.epoch==='string'&&c.epoch.length&&c.expiresAt>clock());return c;}
 function fresh(){check(!disposed&&context&&identity(current())===identity(context)&&(!challenge||challenge.expiresAt>clock()));}
 async function run(fn){check(!busy&&!disposed);busy=true;try{return await fn();}finally{busy=false;}}
 function clear(){challenge=null;suiSignature=null;bnbSignature=null;quote=null;}
 const api={
  state(){return {busy,phase,message:challenge?.message||'',quote:quote?structuredClone(quote):null};},
  request:()=>run(async()=>{
   check(!['opening','uncertain','reviewed'].includes(phase));clear();phase='idle';context=current();
   const c=await transport['bnb-challenge']({payer:context.payer});fresh();
   check(hex(c?.id,64)&&Number.isSafeInteger(c.expiresAt)&&c.expiresAt>clock()&&c.expiresAt<=Math.min(clock()+300000,context.expiresAt)&&c.paymentEnabled===false&&c.restoreAuthorized===false);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(context.sessionToken))),b=>b.toString(16).padStart(2,'0')).join('');fresh();
   const expected=['TREE Arcade BNB Continue Wallet Link','Version: 1','Origin: https://tree-token.xyz','Sui wallet: '+context.suiWallet,'BNB wallet: '+context.payer,'Chain ID: 56','Account: '+context.accountId,'Delivery protocol: tree-paid-delivery.v2','Session binding: '+hash,'Run: '+context.runId,'Continue number: '+context.sequence,'Nonce: '+c.id,'Expires: '+new Date(c.expiresAt).toISOString(),'Purpose: Link these wallets for one 1 USDT continue checkout. This signature does not transfer funds or approve tokens.'].join('\n');
   check(c.message===expected);challenge={id:c.id,message:c.message,expiresAt:c.expiresAt};phase='challenge';
  }),
  signSui:()=>run(async()=>{fresh();check(phase==='challenge');const s=await signSuiMessage({address:context.suiWallet,message:new TextEncoder().encode(challenge.message)});fresh();check(typeof s==='string'&&s.length>0&&s.length<=6000);suiSignature=s;phase='sui-signed';}),
  signBnb:()=>run(async()=>{fresh();check(phase==='sui-signed');const s=await signBnbMessage({address:context.payer,message:challenge.message,chainId:56});fresh();check(typeof s==='string'&&/^0x[a-fA-F0-9]{130}$/.test(s));bnbSignature=s;phase='signed';}),
  review:()=>run(async()=>{
   fresh();check(phase==='signed');phase='opening';
   try{
    const q=await transport['bnb-open']({id:challenge.id,suiSignature,bnbSignature});fresh();
    check(q?.id===challenge.id&&q.paymentEnabled===false&&q.reviewOnly===true&&q.restoreAuthorized===false&&q.continueAuthorized===false&&q.gameplayAuthorized===false&&q.chainId===56&&q.product==='treeforce89.continue.v1'&&q.restoreLives===3&&q.token==='0x55d398326f99059ff775485246999027b3197955'&&q.recipient==='0xc440f06bbc7e58b0d055815f915447e4ae0e3720'&&q.amount==='1000000000000000000'&&q.expiresAt===challenge.expiresAt);
    quote={chainId:q.chainId,amount:'1 USDT',recipient:q.recipient,token:q.token,expiresAt:q.expiresAt};phase='reviewed';
   }catch(error){phase='uncertain';throw error;}finally{suiSignature=null;bnbSignature=null;}
  }),
  destroy(){disposed=true;clear();context=null;phase='disposed';},
 };return Object.freeze(api);
}
export function mountBnbCheckoutReview({root,review}){
 const doc=root.ownerDocument,section=doc.createElement('section'),status=doc.createElement('p'),message=doc.createElement('pre'),terms=doc.createElement('p');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 terms.textContent='Review a 1 USDT BNB continue. Link signatures prove wallet control only. Payments are disabled.';
 const actions=[['request','Review wallet-link message'],['signSui','Sign link in Sui wallet'],['signBnb','Sign link in BNB wallet'],['review','Verify link and review terms']];
 const buttons=actions.map(([action,label])=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{const pending=review[action]();refresh();try{await pending;refresh();}catch{refresh('Review could not finish. No payment was requested. Check your accounts and session before continuing.');}});return b;});
 section.append(terms,message,...buttons,status);root.append(section);let disposed=false;
 function refresh(error){if(disposed)return;const s=review.state();message.textContent=s.message;
  const allowed=[['idle','challenge','sui-signed','signed'],['challenge'],['sui-signed'],['signed']];buttons.forEach((b,i)=>{b.disabled=s.busy||!allowed[i].includes(s.phase);});
  status.textContent=error||(s.phase==='reviewed'?`Review verified: ${s.quote.amount} on BNB. Recipient: ${s.quote.recipient}. Payments remain disabled.`:s.phase==='uncertain'?'Verification outcome needs review. No payment was requested.':s.busy?'Waiting for your wallet or review response…':'Review the message, then approve each wallet signature separately.');
 }
 refresh();return {refresh,destroy(){disposed=true;review.destroy();section.remove();}};
}
