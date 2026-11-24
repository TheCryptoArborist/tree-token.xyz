// Unpublished server coordinator. Review tickets are not game sessions or payments.
import {createHash,randomBytes} from 'node:crypto';
import {BNB_ORIGIN,BNB_IDENTITY_SCOPE} from './bnb-game-access-core.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const SESSION=/^bnbtest_[0-9a-f]{64}$/,TICKET=/^bnbrun_[0-9a-f]{64}$/;
export class RunAuthorizationError extends Error {constructor(code){super(code);this.code=code;}}
const check=(v,code)=>{if(!v)throw new RunAuthorizationError(code);};
// Store is a trusted server dependency, not a client-supplied proof. See store
// contract in documentation: consume MUST atomically revalidate session+ticket.
export function createRunAuthorization({readSession,store,assess,approvedGeneration,clock=Date.now,entropy=randomBytes}){
 check(typeof readSession==='function'&&typeof assess==='function'&&typeof store?.insert==='function'&&typeof store?.read==='function'&&typeof store?.consume==='function','unavailable');
 check(typeof approvedGeneration==='string'&&/^[1-9][0-9]*$/.test(approvedGeneration)&&BigInt(approvedGeneration)<=0xffffffffffffffffn,'unreviewed-generation');
 async function session(raw){
  check(typeof raw==='string'&&SESSION.test(raw),'invalid-session');const hash=sha(raw),s=await readSession(hash),now=clock();
  check(s?.authenticated===true&&s.revoked===false&&s.origin===BNB_ORIGIN&&s.scope===BNB_IDENTITY_SCOPE&&s.chainId===56&&/^0x[0-9a-f]{40}$/.test(s.wallet||'')&&!/^0x0{40}$/.test(s.wallet),'invalid-session');
  const expiry=Date.parse(s.expiresAt);check(Number.isFinite(expiry)&&expiry>now&&expiry<=now+3600000,'expired-session');
  return {hash,wallet:s.wallet,expiresAt:expiry};
 }
 async function backing(s){
  const begin=clock(),p=await assess({wallet:s.wallet,approvedGeneration});const now=clock(),at=Date.parse(p?.checkedAt);
  check(now>=begin&&now-begin<=30000&&Number.isFinite(at)&&at>=begin&&at<=now,'stale-proof');
  check(p.backingEligible===true&&p.gameplayAuthorized===false&&p.wallet===s.wallet&&p.approvedGeneration===approvedGeneration,'backing-denied');
  check(p.bnb?.generation===approvedGeneration&&p.bnb.state===2&&p.bnb.canPlay===true&&p.bnb.owner?.toLowerCase()===s.wallet&&p.sui?.eligible===true&&p.sui.generation===approvedGeneration,'proof-mismatch');
 }
 function origin(value){check(value===BNB_ORIGIN,'wrong-origin');}
 return Object.freeze({
  async issue({sessionToken,origin:requestOrigin}){
   origin(requestOrigin);const s=await session(sessionToken);await backing(s);const fresh=await session(sessionToken);check(fresh.wallet===s.wallet,'session-changed');
   const now=clock(),token='bnbrun_'+entropy(32).toString('hex');check(TICKET.test(token),'unavailable');
   const row={hash:sha(token),sessionHash:s.hash,wallet:s.wallet,chainId:56,scope:'treeforce89-generation-review:v1',generation:approvedGeneration,issuedAt:now,expiresAt:Math.min(now+60000,fresh.expiresAt),consumed:false};
   check(await store.insert(row),'ticket-conflict');return {ticket:token,expiresAt:new Date(row.expiresAt).toISOString(),gameplayAuthorized:false};
  },
  async consume({sessionToken,ticket,origin:requestOrigin}){
   origin(requestOrigin);check(typeof ticket==='string'&&TICKET.test(ticket),'invalid-ticket');const s=await session(sessionToken),hash=sha(ticket),row=await store.read(hash),now=clock();
   check(row&&row.hash===hash&&row.sessionHash===s.hash&&row.wallet===s.wallet&&row.chainId===56&&row.scope==='treeforce89-generation-review:v1'&&row.generation===approvedGeneration&&row.consumed===false,'invalid-ticket');
   check(Number.isFinite(row.issuedAt)&&row.issuedAt<=now&&Number.isFinite(row.expiresAt)&&row.expiresAt>now&&row.expiresAt<=row.issuedAt+60000,'expired-ticket');
   await backing(s);const fresh=await session(sessionToken);check(fresh.wallet===s.wallet,'session-changed');
   // This operation must lock session and ticket in one durable transaction,
   // reject revoked/expired/mismatched state, and update consumed exactly once.
   check(await store.consume({hash,sessionHash:s.hash,wallet:s.wallet,generation:approvedGeneration,now:clock()}),'consumed-or-revoked');
   return {acceptedForReview:true,wallet:s.wallet,chainId:56,generation:approvedGeneration,gameplayAuthorized:false};
  }
 });
}
