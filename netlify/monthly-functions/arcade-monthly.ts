import {createHash} from 'node:crypto';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {AMOUNT,DECIMALS,MonthlyError,ORIGINS,TREE_TYPE,memoFor,recoveryConfig,verifyRecoveryPayment,readRecoveryTransaction} from '../lib/arcade-monthly-core.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const environment=(key:string)=>(globalThis as any).Netlify?.env.get(key)??process.env[key];
const uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
function database(){
 let url:string|undefined,secret:string|undefined;
 for(const prefix of ['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL']){url=environment(prefix+'_SUPABASE_URL');secret=environment(prefix+'_SUPABASE_SECRET_KEY');if(url||secret)break;}
 if(!url||!secret||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw new MonthlyError('service-unavailable','Monthly progress is temporarily unavailable.',503);
 return async(name:string,args:any)=>{let r:Response;try{r=await fetch(url!.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret!,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});}catch{throw new MonthlyError('service-unavailable','Monthly progress is temporarily unavailable. Retry without paying again.',503);}
 const d=await r.json();if(!r.ok){const e=String(d.message||'');if(e.includes('arcade-growth-invalid-session'))throw new MonthlyError('invalid-session','Sign in to the Arcade again.',401);if(e.includes('already-checked-in'))throw new MonthlyError('already-checked-in','That date is already checked in.',409);if(e.includes('invalid-date'))throw new MonthlyError('invalid-date','Choose a missed date from the current UTC month.');if(e.includes('payment-used')||d.code==='23505')throw new MonthlyError('payment-used','That payment or date has already been used.',409);if(e.includes('invalid-intent')||e.includes('payment-time'))throw new MonthlyError('invalid-intent','This recovery checkout is invalid or the payment was outside its time window.');throw new MonthlyError('service-unavailable','Monthly progress is temporarily unavailable. Keep your payment digest and retry.',503);}return d;};
}
async function readBody(request:Request,keys:string[]){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new MonthlyError('invalid-request','Send JSON.');const reader=request.body?.getReader();let data='',size=0;const decoder=new TextDecoder();if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new MonthlyError('invalid-request','Request is too large.',413);}data+=decoder.decode(value,{stream:true});}let b:any;try{b=JSON.parse(data);}catch{throw new MonthlyError('invalid-request','Invalid request.');}if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!keys.includes(k)))throw new MonthlyError('invalid-request','Unsupported request fields.');return b;}
export function createMonthlyHandler(deps:any={}){return async(request:Request)=>{try{
 const action=new URL(request.url).searchParams.get('action')||'status';
 if(!['status','intent','verify'].includes(action))throw new MonthlyError('invalid-request','Unknown action.',404);
 if(request.method!==(action==='status'?'GET':'POST'))throw new MonthlyError('method-not-allowed','Method not allowed.',405);
 const config={recovery:recoveryConfig,monthlyReward:{requiredQuestDays:20,rewardDetails:'To be announced',eligibleEvidence:'completed-result',eligibleGames:['garden-bot','pvp','arborist-trials']}};
 const authorization=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'');
 if(action==='status'&&!request.headers.has('authorization'))return json({status:'ok',authenticated:false,configuration:config});
 if(!authorization)throw new MonthlyError('invalid-session','Sign in to the Arcade first.',401);
 const origin=request.headers.get('origin')||new URL(request.url).origin;
 if(!ORIGINS.includes(origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new MonthlyError('origin-not-allowed','Use the official TREE Arcade.',403);
 const rpc=deps.rpc||database(),base={p_token_sha256:hash(authorization[1]),p_origin:origin};
 const session=await rpc('arcade_growth_read_session_v1',base);
 const now=deps.now?.()??Date.now();
 if(session.revoked||session.origin!==origin||!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=now||!/^0x[0-9a-f]{64}$/.test(session.wallet))throw new MonthlyError('invalid-session','Sign in to the Arcade again.',401);
 if(action==='status')return json({status:'ok',authenticated:true,configuration:config,progress:await rpc('arcade_monthly_status_v1',base)});
 const client=()=>new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
 if(action==='intent'){
  const b=await readBody(request,['dateKey']);if(typeof b.dateKey!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.dateKey))throw new MonthlyError('invalid-date','Select a missed date.');
  let own:any;if(deps.ownership)own=await deps.ownership(session.wallet);else {const r=await fetch('https://tree-token.xyz/api/nftree-wallet?address='+session.wallet,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new MonthlyError('ownership-unavailable','NFTree ownership could not be checked.',503);own=await r.json();}
  if(own.address!==session.wallet||own.network!=='sui-mainnet'||!Number.isSafeInteger(own.nftreeCount)||own.nftreeCount<1)throw new MonthlyError('nftree-required','Hold an NFTree in this wallet to recover attendance.',403);
  const metadata=deps.metadata?await deps.metadata():await client().core.getCoinMetadata({coinType:TREE_TYPE,signal:AbortSignal.timeout(12000)});
  if(metadata.coinMetadata?.decimals!==DECIMALS)throw new MonthlyError('price-unavailable','TREE precision could not be verified. No payment was requested.',503);
  const intent=await rpc('arcade_recovery_intent_v1',{...base,p_date_key:b.dateKey});
  if(intent.wallet!==session.wallet||intent.dateKey!==b.dateKey||!uuid(intent.id)||Date.parse(intent.expiresAt)<=now)throw new MonthlyError('invalid-intent','Checkout could not be verified.');
  return json({status:'ok',intent:{...intent,...recoveryConfig,memo:memoFor(intent)}});
 }
 const b=await readBody(request,['intentId','digest']);if(!uuid(b.intentId)||typeof b.digest!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(b.digest))throw new MonthlyError('invalid-request','A valid checkout and transaction digest are required.');
 const intent=await rpc('arcade_recovery_intent_v1',{...base,p_date_key:null,p_intent_id:b.intentId});
 if(intent.wallet!==session.wallet||intent.id!==b.intentId)throw new MonthlyError('invalid-intent','Checkout identity mismatch.');
 const transaction=deps.getTransaction?await deps.getTransaction(b.digest):await readRecoveryTransaction(deps.client||client(),b.digest);
 const paidAt=verifyRecoveryPayment(transaction,intent,b.digest,now);
 const progress=await rpc('arcade_recovery_confirm_v1',{...base,p_intent_id:b.intentId,p_digest:b.digest,p_paid_at:paidAt});
 return json({status:'ok',authenticated:true,configuration:config,progress,receipt:{dateKey:intent.dateKey,digest:b.digest,price:'20000'}});
 }catch(error){const e=error instanceof MonthlyError?error:new MonthlyError('service-unavailable','Verification is temporarily unavailable. Keep your payment digest and retry without paying again.',503);return json({status:'error',error:e.code,message:e.message},e.status);}};}
export default createMonthlyHandler();
export const config={path:'/api/arcade-monthly',method:['GET','POST'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:60}};
