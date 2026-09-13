import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// TEST ADAPTER ONLY. Production remains a private transactional Postgres ledger.
export const POLICY = Object.freeze({
  version: 'tree-continue-sim-v1', mode: 'simulation', game: 'treeforce89',
  sku: 'treeforce89.continue.test.v1', cost: 100, lives: 3, limit: 1,
  baseCC: 1000, bonusBps: 1000, quoteMs: 45000, holdMs: 90000,
  mockTreeUsdMicro: 1000, treeDecimals: 6, maxTopups: 5,
});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const actions = {
  balance: [], quote: ['requestId'], simulate: ['requestId','quoteId','signature'],
  'open-run': ['requestId','clientRunId'], reserve: ['requestId','runId'],
  commit: ['requestId','reservationId'], deliver: ['requestId','reservationId'],
  release: ['requestId','reservationId'], finish: ['requestId','runId'],
};
export class CreditError extends Error { constructor(code, status=400) { super(code); this.status=status; } }
const check = (ok, code, status=400) => { if (!ok) throw new CreditError(code,status); };
export function validateCommand(command) {
  check(command && typeof command==='object' && !Array.isArray(command), 'invalid-command');
  check(Object.hasOwn(actions,command.action),'unsupported-action');
  const keys=actions[command.action];
  check(Object.keys(command).every(k=>k==='action'||keys.includes(k)), 'unexpected-field');
  for (const key of keys) check(key==='signature' ? /^[A-Za-z0-9_-]{43}$/.test(command[key]||'') : uuid.test(command[key]||''), `invalid-${key}`);
}
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
export const signQuote = (quote,key) => createHmac('sha256',key).update(canonical(quote)).digest('base64url');
const same = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const emptyLedger = accountId => ({version:1,mode:'simulation',accountId,events:[],lots:[],quotes:{},runs:{},reservations:{},requests:{}});
function post(s,kind,lines,at,reference,allocations=[],metadata={}) {
  check(lines.every(l=>Number.isSafeInteger(l.delta)) && lines.reduce((n,l)=>n+l.delta,0)===0,'unbalanced-journal',500);
  s.events.push({id:randomUUID(),sequence:s.events.length+1,kind,at,reference,lines,allocations,metadata});
}
const line=(ledger,delta)=>({ledger,delta});
export function balances(s) {
  const b={available:0,held:0,spent:0,issued:0};
  for(const e of s.events) {
    check(e.lines.reduce((n,l)=>n+l.delta,0)===0,'damaged-journal',503);
    for(const l of e.lines) if(Object.hasOwn(b,l.ledger)) b[l.ledger]+=l.delta;
    if(e.kind==='issue') b.issued+=e.lines.filter(l=>l.ledger==='available').reduce((n,l)=>n+l.delta,0);
  }
  check(Object.values(b).every(n=>Number.isSafeInteger(n)&&n>=0)&&b.available+b.held+b.spent===b.issued,'damaged-balance',503);
  return b;
}
function availableLots(s) {
  const lots=s.lots.map(l=>({...l,available:l.cc})); const index=new Map(lots.map(l=>[l.id,l]));
  for(const e of s.events) if(['reserve','release','refund'].includes(e.kind)) for(const a of e.allocations) {
    const lot=index.get(a.lotId); check(lot,'damaged-provenance',503);
    lot.available+=(e.kind==='reserve'?-1:1)*a.cc;
  }
  check(lots.every(l=>Number.isSafeInteger(l.available)&&l.available>=0&&l.available<=l.cc),'damaged-provenance',503);
  check(lots.reduce((n,l)=>n+l.available,0)===balances(s).available,'provenance-mismatch',503);
  return lots;
}
function allocate(s,amount) {
  let left=amount; const allocations=[];
  for(const lot of availableLots(s)) { const cc=Math.min(left,lot.available); if(cc){allocations.push({lotId:lot.id,cc});left-=cc;} if(!left)break; }
  check(!left,'insufficient-test-credits',409); return allocations;
}
function release(s,r,at,reason) {
  if(r.status==='reserved') post(s,'release',[line('held',-r.cost),line('available',r.cost)],at,r.id,r.allocations,{reason});
  else if(r.status==='committed') post(s,'refund',[line('spent',-r.cost),line('available',r.cost)],at,r.id,r.allocations,{reason,reverses:r.commitEvent});
  else return;
  r.status=r.status==='reserved'?'released':'refunded'; r.closedAt=at;
}
function sweep(s,at) {
  for(const r of Object.values(s.reservations)) if((r.status==='reserved'&&r.expiresAt<=at)||(r.status==='committed'&&r.deliveryDeadline<=at)) release(s,r,at,'expired-undelivered');
  for(const q of Object.values(s.quotes)) if(q.status==='open'&&q.quote.expiresAt<=at) {q.status='expired';post(s,'quote-expired',[],at,q.quote.id);}
}
const reservationResult = r => ({reservationId:r.id,runId:r.runId,status:r.status,cost:r.cost,lives:POLICY.lives,expiresAt:r.expiresAt,deliveryDeadline:r.deliveryDeadline||null});
export function summary(s) {
  availableLots(s);
  return {mode:'simulation',accountId:s.accountId,...balances(s),policy:POLICY,
    recent:s.events.slice(-8).reverse().map(e=>({kind:e.kind,reference:e.reference,at:e.at,delta:e.lines.filter(l=>l.ledger==='available').reduce((n,l)=>n+l.delta,0)}))};
}
export function reduceLedger(previous, command, {key,now=Date.now(),paused=false}={}) {
  validateCommand(command); check(previous.version===1&&previous.mode==='simulation','wrong-ledger',503);
  const s=structuredClone(previous); sweep(s,now);
  if(command.action==='balance') return {state:s,result:summary(s)};
  const fingerprint=canonical(command),memo=s.requests[command.requestId];
  if(memo) {check(memo.fingerprint===fingerprint,'idempotency-conflict',409);
    const result=memo.result.reservationId ? reservationResult(s.reservations[memo.result.reservationId]) : memo.result;
    return {state:s,result,duplicate:true};}
  check(!paused||['release','deliver','finish'].includes(command.action),'simulation-paused',503);
  check(s.events.length<400||['release','deliver','finish','commit'].includes(command.action),'test-ledger-limit',429);
  check(Object.keys(s.requests).length<1000||['release','deliver','finish'].includes(command.action),'test-ledger-limit',429);
  let result;
  if(command.action==='quote') {
    check(Object.values(s.quotes).filter(q=>q.status==='open').length<10,'too-many-test-quotes',429);
    const baseCC=POLICY.baseCC,bonusCC=Math.floor(baseCC*POLICY.bonusBps/10000);
    const usdMicro=baseCC*1000,unit=10n**BigInt(POLICY.treeDecimals),price=BigInt(POLICY.mockTreeUsdMicro);
    const quote={id:randomUUID(),orderId:randomUUID(),accountId:s.accountId,mode:'simulation',asset:'SIMULATED_TREE',network:'simulation',
      baseCC,bonusCC,totalCC:baseCC+bonusCC,usdMicro,mockTreeUsdMicro:POLICY.mockTreeUsdMicro,treeDecimals:POLICY.treeDecimals,
      requiredRaw:((BigInt(usdMicro)*unit+price-1n)/price).toString(),issuedAt:now,expiresAt:now+POLICY.quoteMs,policy:POLICY.version};
    const signature=signQuote(quote,key); s.quotes[quote.id]={quote,signature,status:'open'};
    post(s,'quote',[],now,quote.id); result={quote,signature};
  } else if(command.action==='simulate') {
    const q=s.quotes[command.quoteId]; check(q,'quote-not-found',404);
    check(same(q.signature,command.signature)&&same(signQuote(q.quote,key),command.signature),'quote-signature-mismatch',401);
    if(q.status==='credited') result={receiptId:q.receiptId,totalCC:q.quote.totalCC};
    else {
      check(q.status==='open'&&q.quote.expiresAt>now,'quote-expired',409);
      check(s.events.filter(e=>e.kind==='issue').length<POLICY.maxTopups,'test-topup-limit',429);
      q.status='credited'; q.receiptId=`SIM-${q.quote.orderId}`;
      const lots=[{id:`${q.quote.id}:base`,cc:q.quote.baseCC,source:'simulated-tree-payment'},{id:`${q.quote.id}:bonus`,cc:q.quote.bonusCC,source:'tree-bonus'}];
      s.lots.push(...lots.map(l=>({...l,quoteId:q.quote.id,issuedAt:now,policy:q.quote.policy})));
      post(s,'issue',[line('available',q.quote.totalCC),line('source:simulated-tree',-q.quote.baseCC),line('source:tree-bonus',-q.quote.bonusCC)],now,q.receiptId,[],{quoteId:q.quote.id,baseCC:q.quote.baseCC,bonusCC:q.quote.bonusCC,policy:q.quote.policy,mode:'simulation'});
      result={receiptId:q.receiptId,totalCC:q.quote.totalCC};
    }
  } else if(command.action==='open-run') {
    const existing=Object.values(s.runs).find(r=>r.clientRunId===command.clientRunId);
    if(existing) result={runId:existing.id};
    else {check(Object.keys(s.runs).length<100,'test-run-limit',429);
      const run={id:randomUUID(),clientRunId:command.clientRunId,game:POLICY.game,createdAt:now,expiresAt:now+7200000,status:'open',reservationId:null};
      s.runs[run.id]=run;post(s,'run-open',[],now,run.id);result={runId:run.id};}
  } else if(command.action==='reserve') {
    const run=s.runs[command.runId];check(run,'run-not-found',404);check(run.status==='open'&&run.expiresAt>now,'run-closed',409);
    if(run.reservationId) {const r=s.reservations[run.reservationId];check(['reserved','committed','delivered'].includes(r.status),'continue-attempt-closed',409);result=reservationResult(r);}
    else {
      const cost=POLICY.cost,allocations=allocate(s,cost);
      const r={id:randomUUID(),runId:run.id,sku:POLICY.sku,cost,status:'reserved',expiresAt:now+POLICY.holdMs,allocations};
      s.reservations[r.id]=r;run.reservationId=r.id;
      post(s,'reserve',[line('available',-cost),line('held',cost)],now,r.id,allocations,{sku:POLICY.sku,runId:run.id});result=reservationResult(r);
    }
  } else if(command.action==='finish') {
    const run=s.runs[command.runId];check(run,'run-not-found',404);
    if(run.status!=='closed'){if(run.reservationId)release(s,s.reservations[run.reservationId],now,'run-ended');run.status='closed';post(s,'run-close',[],now,run.id);}
    result={runId:run.id,status:run.status};
  } else {
    const r=s.reservations[command.reservationId];check(r,'reservation-not-found',404);
    if(command.action==='commit') {
      check(['reserved','committed','delivered'].includes(r.status),'reservation-closed',409);
      if(r.status==='reserved'){post(s,'commit',[line('held',-r.cost),line('spent',r.cost)],now,r.id,r.allocations,{sku:r.sku,runId:r.runId});r.commitEvent=s.events.at(-1).id;r.status='committed';r.deliveryDeadline=now+POLICY.holdMs;}
    } else if(command.action==='deliver') {
      check(['committed','delivered'].includes(r.status),'reservation-not-committed',409);
      if(r.status==='committed'){r.status='delivered';post(s,'delivered',[],now,r.id);}
    } else if(command.action==='release') {
      check(r.status!=='delivered','already-delivered',409);release(s,r,now,'game-cancelled-or-failed');
    }
    result=reservationResult(r);
  }
  s.requests[command.requestId]={fingerprint,result}; summary(s);
  return {state:s,result};
}
export function createSimulationLedger({store,key,now=Date.now,paused=false}) {
  check(typeof key==='string'&&key.length>=32,'signer-unavailable',503);
  return async (accountId,command) => {
    check(uuid.test(accountId||''),'invalid-account',401); validateCommand(command);
    const storageKey=`accounts/${accountId}`;
    for(let attempt=0;attempt<12;attempt++) {
      const before=await store.getWithMetadata(storageKey,{type:'json'}), previous=before?.data||emptyLedger(accountId);
      check(previous.accountId===accountId,'account-mismatch',503);
      const next=reduceLedger(previous,command,{key,now:now(),paused});
      if(JSON.stringify(next.state)===JSON.stringify(previous))return {result:next.result,ledger:summary(next.state)};
      const write=await store.setJSON(storageKey,next.state,before?{onlyIfMatch:before.etag}:{onlyIfNew:true});
      if(write.modified===true)return {result:next.result,ledger:summary(next.state)};
    }
    throw new CreditError('retry-same-request',409);
  };
}
export async function readJson(request,limit=4096) {
  check(request.headers.get('content-type')?.split(';')[0].trim()==='application/json','json-required',415);
  const reader=request.body?.getReader();check(reader,'invalid-json');let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new CreditError('request-too-large',413);}chunks.push(value);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new CreditError('invalid-json');}
}
