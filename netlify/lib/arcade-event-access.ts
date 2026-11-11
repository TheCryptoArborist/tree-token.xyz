import {NFTREE_TYPE} from './tree-nftree-overview.ts';
export class EventError extends Error {
  code:string; status:number;
  constructor(code:string,message:string,status=400){super(message);this.code=code;this.status=status;}
}
export const EVENT_ORIGINS=['https://tree-token.xyz','https://www.tree-token.xyz'];
export function validEventSession(session:any,origin:string,now:number){
  if(!Number.isFinite(now)||!session||session.revoked!==false||session.origin!==origin||!/^0x[0-9a-f]{64}$/.test(session.wallet||'')||!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=now)
    throw new EventError('invalid-session','Sign in to the Arcade again.',401);
  return session;
}
// Only inject a trusted server-side chain reader here, never a browser ownership assertion.
// Called independently at checkout and run start: no eligibility cache or alternate access path.
export async function requireEventHolder(session:any,origin:string,readOwnership:(wallet:string)=>Promise<any>,clock=Date.now){
  validEventSession(session,origin,clock());
  let ownership:any;
  try{ownership=await readOwnership(session.wallet);}catch{throw new EventError('ownership-unavailable','NFTree ownership could not be verified. No payment was requested.',503);}
  validEventSession(session,origin,clock());
  if(ownership?.address!==session.wallet||ownership.network!=='sui-mainnet'||ownership.nftreeType!==NFTREE_TYPE||ownership.methodology!=='canonical-nftree-direct-and-kiosk-cap-v2'||!Number.isSafeInteger(ownership.nftreeCount)||ownership.nftreeCount<0||!Number.isSafeInteger(ownership.directCount)||ownership.directCount<0||!Number.isSafeInteger(ownership.kioskCount)||ownership.kioskCount<0||ownership.directCount+ownership.kioskCount!==ownership.nftreeCount)
    throw new EventError('ownership-unavailable','NFTree ownership could not be verified. No payment was requested.',503);
  if(ownership.nftreeCount===0)throw new EventError('nftree-required','This tournament is for NFTree holders only.',403);
  return {wallet:session.wallet,nftreeCount:ownership.nftreeCount,checkedAt:new Date(clock()).toISOString(),requirement:'nftree-holder-only'};
}
