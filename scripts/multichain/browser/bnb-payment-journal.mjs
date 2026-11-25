// Recovery bridge only. No signature, transfer or chain verification is performed here.
export function createBnbPaymentJournal({getSession,transport,storage,locks}){
 if(typeof getSession!=='function'||!storage?.getItem||!storage?.setItem||!storage?.removeItem||!locks?.request)throw Error('durable-bnb-journal-required');
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),tx=v=>typeof v==='string'&&/^0x[a-f0-9]{64}$/.test(v);
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
 const actor=()=>{const s=getSession();if(!s||!/^0x[a-f0-9]{64}$/.test(s.wallet||'')||!uuid(s.runId)||!/^grove-[a-f0-9]{32}$/.test(s.nativeRunId||'')||!hash(s.sessionToken)||typeof s.epoch!=='string')throw Error('native-session-required');return {...s};};
 const key=s=>'tree-bnb-continue.v2:'+s.wallet;
 const same=s=>{const n=actor();if(['wallet','runId','nativeRunId','sessionToken','epoch'].some(k=>n[k]!==s[k]))throw Error('session-changed-review-required');};
 const save=(k,p)=>{const text=JSON.stringify(p);storage.setItem(k,text);if(storage.getItem(k)!==text)throw Error('durable-bnb-journal-required');};
 const load=s=>{const p=JSON.parse(storage.getItem(key(s))||'null');if(!p||!hash(p.checkoutId)||!uuid(p.runId)||!/^0x[a-f0-9]{40}$/.test(p.payer||'')||(p.txHash&&!tx(p.txHash))||(p.paymentId&&!uuid(p.paymentId)))throw Error('receipt-review-required');return p;};
 const locked=fn=>{const s=actor();return locks.request(key(s),{mode:'exclusive'},()=>{same(s);return fn(s);});};
 return Object.freeze({
  pending(){try{const s=actor();if(storage.getItem(key(s))===null)return {kind:'none',canPay:true};const p=load(s);return {kind:'bnb',canPay:false,hasHash:!!p.txHash,canRecover:!!p.paymentId};}catch{return {kind:'review',canPay:false};}},
  begin({checkoutId,payer}){return locked(async s=>{if(storage.getItem(key(s))!==null)throw Error('recover-existing-payment');if(!hash(checkoutId)||!/^0x[a-f0-9]{40}$/.test(payer||''))throw Error('invalid-checkout');save(key(s),{source:'bnb-usdt',checkoutId,payer,runId:s.runId,nativeRunId:s.nativeRunId,status:'pending'});});},
  record({txHash}={}){return locked(async s=>{const p=load(s),hashValue=p.txHash||txHash;if(!tx(hashValue)||(p.txHash&&txHash&&p.txHash!==txHash))throw Error('receipt-review-required');
   const r=await transport['bnb-record']({runId:p.runId,checkoutId:p.checkoutId,txHash:hashValue});same(s);
   if(r?.source!=='bnb-usdt'||r.status!=='recorded'||r.restoreAuthorized!==false||r.requiresPayment!==false||r.checkoutId!==p.checkoutId||r.runId!==p.runId||r.nativeRunId!==p.nativeRunId||r.txHash!==hashValue||r.payer!==p.payer||!uuid(r.paymentId)||!new RegExp('^56:'+hashValue+':[0-9]+$').test(r.receiptId||''))throw Error('payment-review-required');
   save(key(s),{...p,txHash:hashValue,receiptId:r.receiptId,paymentId:r.paymentId,status:'recorded'});return r;
  });},
  recover(){return locked(async s=>{const p=load(s);if(!uuid(p.paymentId))throw Error('receipt-review-required');const r=await transport.recover({paymentId:p.paymentId});same(s);if(r?.paymentId!==p.paymentId||r.runId!==p.runId||r.nativeRunId!==p.nativeRunId||r.restoreAuthorized!==false||r.requiresPayment!==false||!['recovered','review-required'].includes(r.status))throw Error('recovery-review-required');return r;});},
  archive(){return locked(async s=>{const original=storage.getItem(key(s)),p=load(s);if(!uuid(p.paymentId))throw Error('receipt-review-required');const r=await transport.complete({paymentId:p.paymentId});same(s);
   if(r?.source!=='bnb-usdt'||r.status!=='completed'||r.archiveAllowed!==true||r.restoreAuthorized!==false||r.requiresPayment!==false||['paymentId','checkoutId','runId','nativeRunId','payer','txHash','receiptId'].some(k=>r[k]!==p[k])||storage.getItem(key(s))!==original)throw Error('completion-review-required');
   save(key(s)+':completed:'+p.paymentId,{...p,status:'completed'});storage.removeItem(key(s));if(storage.getItem(key(s))!==null)throw Error('pending-removal-failed');return {status:'archived',restoreAuthorized:false,requiresPayment:false};
  });},
 });
}
