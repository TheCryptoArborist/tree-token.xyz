import {randomBytes,createHash} from 'node:crypto';
import {createAuthenticatedSessionResolver} from './treeforce89-source/game/authenticated-session.mjs';
import {createMainnetTransactionReader} from '../../treeforce89/paid/mainnet-transaction-reader.mjs';
import {TREE_COIN_TYPE,TREE_RECIPIENT,PRICE,baseUnits,normalizedAddress,validateSnapshot} from '../../treeforce89/paid/contract.mjs';

const failure=(code,message)=>Object.assign(Error(message),{code});
const hash=token=>createHash('sha256').update(token).digest('hex');
const offerColumns=['continue_offer_id','continue_offer_created_at','continue_offer_expires_at','continue_offer_checkpoint','continue_snapshot'];
export async function paidContinueSchemaReady(pool) {
 const r=await pool.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN ('tree_game_sessions','tree_continue_redemptions')`);
 const column=(table,name,type)=>r.rows.some(x=>x.table_name===table&&x.column_name===name&&x.data_type===type&&x.is_nullable==='YES');
 const types=['text','timestamp with time zone','timestamp with time zone','text','jsonb'];
 if(!offerColumns.every((c,i)=>column('tree_game_sessions',c,types[i]))||
  !Object.entries({offer_id:'text',snapshot:'jsonb',payment_timestamp_ms:'bigint',checkpoint:'text'})
   .every(([c,type])=>column('tree_continue_redemptions',c,type)))return false;
 const {rows:indexes}=await pool.query(`SELECT t.relname AS table_name,i.indisunique,i.indisvalid,i.indisready,
  pg_get_expr(i.indpred,i.indrelid) AS predicate,
  array(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum,n)
   JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum ORDER BY k.n) AS columns
  FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND t.relname IN ('tree_game_sessions','tree_continue_redemptions')`);
 return [['tree_game_sessions','continue_offer_id'],['tree_continue_redemptions','offer_id']].every(([table,key])=>
  indexes.some(i=>i.table_name===table&&i.indisunique&&i.indisvalid&&i.indisready&&
   JSON.stringify(i.columns)===JSON.stringify([key])&&i.predicate?.replace(/[()\s]/g,'')===key+'ISNOTNULL'));
}
export function createPaidContinueService({pool,client,archivalClient,ownershipChecker,enabled=false,now=()=>Date.now()}) {
 const resolveSession=createAuthenticatedSessionResolver(pool);
 const readTransaction=createMainnetTransactionReader(client,{archivalClient});
 const atomic=async operation=>{
  const db=await pool.connect();
  try{await db.query('BEGIN');const result=await operation(db);await db.query('COMMIT');return result;}
  catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
 };
 const requireEnabled=()=>{if(!enabled)throw failure('PAYMENTS_DISABLED','Paid continues are not enabled.');};
 const authenticatedRow=async(db,session,token)=>{
  const r=await db.query('SELECT * FROM tree_game_sessions WHERE session_id=$1 FOR UPDATE',[session.sessionId]);
  const row=r.rows[0];
  if(!row||row.session_token_hash!==hash(token)||new Date(row.expires_at).getTime()<=now())
   throw failure('SESSION_REQUIRED','Verify your NFTree again.');
  return row;
 };
 const publicOffer=(row,decimals)=>({enabled:true,recipientConfirmed:true,offerId:row.continue_offer_id,
  wallet:row.wallet,runId:row.run_id,network:'sui:mainnet',coinType:TREE_COIN_TYPE,recipient:TREE_RECIPIENT,
  price:PRICE,decimals,amountBaseUnits:baseUnits(decimals).toString(),lives:3,
  expiresAt:new Date(row.continue_offer_expires_at).getTime()});
 const metadata=async()=>{
  const {coinMetadata}=await client.core.getCoinMetadata({coinType:TREE_COIN_TYPE,signal:AbortSignal.timeout(15000)});
  const decimals=coinMetadata?.decimals;baseUnits(decimals);return decimals;
 };
 return {
  async offer({sessionToken,runId,snapshot,lives}) {
   requireEnabled();if(lives!==0)throw failure('RUN_NOT_ELIGIBLE','Continue is available after all lives are lost.');
   const session=await resolveSession({sessionToken});
   if(session.runId!==runId)throw failure('RUN_CHANGED','This run has changed.');
   let saved;try{saved=validateSnapshot(snapshot,runId);}catch{throw failure('INVALID_REQUEST','Invalid interrupted run.');}
   if(session.wallet===TREE_RECIPIENT)throw failure('RUN_NOT_ELIGIBLE','Use a player wallet different from the receiving treasury.');
   if(await ownershipChecker({wallet:session.wallet})!==true)throw failure('NFTREE_REQUIRED','A directly held NFTree is required.');
   const [decimals,anchor]=await Promise.all([metadata(),client.ledgerService.getCheckpoint({
    checkpointId:{oneofKind:undefined},readMask:{paths:['sequence_number']}},{abort:AbortSignal.timeout(15000)})]);
   const checkpoint=anchor?.response?.checkpoint?.sequenceNumber?.toString();
   if(!/^\d+$/.test(checkpoint||''))throw Error('Mainnet checkpoint unavailable');
   return atomic(async db=>{
    const row=await authenticatedRow(db,session,sessionToken);
    if(row.run_id!==runId||row.cleared)throw failure('RUN_CHANGED','This run is not eligible.');
    if(row.continue_pending&&row.continue_offer_id){
     if(new Date(row.continue_offer_expires_at).getTime()<=now())throw failure('OFFER_EXPIRED','Checkout expired. Start a new run.');
     if(JSON.stringify(validateSnapshot(row.continue_snapshot,runId))!==JSON.stringify(saved))
      throw failure('RUN_CHANGED','The interrupted run does not match the open checkout.');
     return publicOffer(row,decimals);
    }
    // Trust policy: this is an authenticated client-reported, non-reward game
    // checkpoint. It is not proof of score/lives for prizes or token rewards.
    const r=await db.query(`UPDATE tree_game_sessions SET game_over=TRUE,continue_pending=TRUE,wave=$2,
     continue_offer_id=$3,continue_offer_created_at=clock_timestamp(),
     continue_offer_expires_at=expires_at,continue_snapshot=$4::jsonb,continue_offer_checkpoint=$5
     WHERE session_id=$1 RETURNING *`,[session.sessionId,saved.wave,randomBytes(24).toString('hex'),JSON.stringify(saved),checkpoint]);
    return publicOffer(r.rows[0],decimals);
   });
  },
  async redeem({sessionToken,offerId,digest}) {
   requireEnabled();
   if(!/^[a-f0-9]{48}$/.test(offerId||'')||!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest||''))
    throw failure('INVALID_REQUEST','Invalid payment reference.');
   const authenticated=await resolveSession({sessionToken});
   const lookup=await pool.query('SELECT * FROM tree_game_sessions WHERE continue_offer_id=$1 AND wallet=$2',[offerId,authenticated.wallet]);
   const offer=lookup.rows[0];if(!offer)throw failure('OFFER_REQUIRED','Checkout does not belong to this wallet.');
   const existing=await pool.query('SELECT * FROM tree_continue_redemptions WHERE offer_id=$1',[offerId]);
   let receipt;
   if(!existing.rows.length){
    const tx=await readTransaction(digest),decimals=await metadata();
    const start=new Date(offer.continue_offer_created_at).getTime(),end=new Date(offer.continue_offer_expires_at).getTime();
    if(!/^\d+$/.test(offer.continue_offer_checkpoint||'')||BigInt(tx.checkpoint)<=BigInt(offer.continue_offer_checkpoint)||
     tx.timestampMs<start-30_000||tx.timestampMs>=end||normalizedAddress(tx.sender)!==authenticated.wallet)
     throw failure('PAYMENT_MISMATCH','The payment does not match this checkout.');
    const received=tx.balanceChanges.reduce((sum,c)=>c.coinType===TREE_COIN_TYPE&&c.owner?.kind==='AddressOwner'&&
     normalizedAddress(c.owner.address)===TREE_RECIPIENT?sum+BigInt(c.amount):sum,0n);
    if(received<baseUnits(decimals))throw failure('PAYMENT_MISMATCH','20,000 TREE has not been confirmed at the treasury.');
    receipt=tx;
   }
   return atomic(async db=>{
    // Deterministic lock order also covers recovery after a new signed login.
    const rows=await db.query('SELECT * FROM tree_game_sessions WHERE session_id=ANY($1::text[]) ORDER BY session_id FOR UPDATE',
     [[authenticated.sessionId,offer.session_id]]);
    const auth=rows.rows.find(r=>r.session_id===authenticated.sessionId),row=rows.rows.find(r=>r.session_id===offer.session_id);
    if(!auth||auth.session_token_hash!==hash(sessionToken)||new Date(auth.expires_at).getTime()<=now())
     throw failure('SESSION_REQUIRED','Verify your NFTree again.');
    if(!row||row.wallet!==authenticated.wallet||row.continue_offer_id!==offerId||row.cleared)
     throw failure('RUN_CHANGED','The interrupted run has changed.');
    const prior=await db.query('SELECT * FROM tree_continue_redemptions WHERE offer_id=$1',[offerId]);
    if(prior.rows.length){
     const used=prior.rows[0];
     if(used.digest!==digest||Number(row.continuation_number)!==Number(used.continuation_number)+1||row.continue_pending)
      throw failure('PAYMENT_USED','This payment has already been used.');
    }else{
     if(!receipt||!row.continue_pending||!row.game_over||row.continuation_number!==offer.continuation_number)
      throw failure('RUN_CHANGED','This checkout is no longer pending.');
     const inserted=await db.query(`INSERT INTO tree_continue_redemptions
      (digest,session_id,continuation_number,wallet,run_id,offer_id,snapshot,payment_timestamp_ms,checkpoint)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) ON CONFLICT DO NOTHING RETURNING digest`,
      [digest,row.session_id,row.continuation_number,row.wallet,row.run_id,offerId,JSON.stringify(row.continue_snapshot),receipt.timestampMs,receipt.checkpoint]);
     if(inserted.rows.length!==1)throw failure('PAYMENT_USED','This payment has already been used.');
     await db.query(`UPDATE tree_game_sessions SET game_over=FALSE,continue_pending=FALSE,
      continuation_number=continuation_number+1 WHERE session_id=$1`,[row.session_id]);
     row.continuation_number++;row.continue_pending=false;row.game_over=false;
    }
    if(auth.session_id!==row.session_id){
     // A fresh wallet signature/NFTree login may recover the same paid flight.
     // Move only the current credential lease; never store or expose raw tokens.
     await db.query('UPDATE tree_game_sessions SET session_token_hash=NULL,expires_at=clock_timestamp() WHERE session_id=$1',[auth.session_id]);
     await db.query('UPDATE tree_game_sessions SET session_token_hash=$2,expires_at=$3 WHERE session_id=$1',
      [row.session_id,hash(sessionToken),auth.expires_at]);
    }
    return {authorized:true,offerId,digest,runId:row.run_id,lives:3,wave:row.wave,
     continuationNumber:Number(row.continuation_number),snapshot:row.continue_snapshot,
     session:{wallet:row.wallet,runId:row.run_id,sessionToken,expiresAt:new Date(auth.expires_at).getTime()}};
   });
  },
 };
}

export function createPaidContinueHttpHandler({action,getService}) {
 if(!['offer','redeem'].includes(action))throw Error('Unknown paid continue action');
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
 const reply=(body,status)=>Response.json(body,{status,headers});
 return async request=>{
  if(request.method!=='POST')return reply({error:'POST required'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')
   return reply({error:'Origin not permitted'},403);
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return reply({code:'SESSION_REQUIRED',error:'Verify your NFTree again.'},401);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply({error:'JSON required'},415);
  let input;
  try{
   const reader=request.body?.getReader();if(!reader)throw Error();let length=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
    if(length>2048){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}
   const buffer=new Uint8Array(length);let offset=0;for(const part of chunks){buffer.set(part,offset);offset+=part.length;}
   input=JSON.parse(new TextDecoder().decode(buffer));
   const fields=action==='offer'?['runId','snapshot','lives']:['offerId','digest'];
   if(!input||Array.isArray(input)||Object.keys(input).length!==fields.length||!fields.every(k=>Object.hasOwn(input,k)))throw Error();
  }catch{return reply({code:'INVALID_REQUEST',error:'Invalid checkout request.'},400);}
  try{return reply(await(await getService())[action]({...input,sessionToken:token}),200);}
  catch(e){const codes={SESSION_REQUIRED:401,NFTREE_REQUIRED:403,INVALID_REQUEST:400,RUN_NOT_ELIGIBLE:409,
   RUN_CHANGED:409,OFFER_REQUIRED:409,OFFER_EXPIRED:409,PAYMENT_MISMATCH:402,PAYMENT_USED:409,PAYMENTS_DISABLED:503};
   return Object.hasOwn(codes,e.code)?reply({code:e.code,error:e.message},codes[e.code]):
    reply({code:'RETRY_VERIFICATION',error:action==='redeem'?'Payment not confirmed yet. Retry verification; do not pay again.':'Checkout is unavailable. Please retry.'},503);}
 };
}
