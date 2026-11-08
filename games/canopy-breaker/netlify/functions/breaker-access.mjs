import {createCompletionsHTTP} from '../../server/completions.mjs';
import {createHash} from 'node:crypto';
import {getDeployStore} from '@netlify/blobs';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {fromBase64} from '@mysten/sui/utils';
import {createAccessHandler} from '../../server/access.mjs';
import {nftreeOwnership} from '../../server/ownership.mjs';
import {createTreeReader} from '../../server/payments/tree.mjs';
import {createSignedInspector} from '../../server/payments/signed.mjs';
import {transactionDatabase} from '../../server/payments/database.mjs';
import {createGameService} from '../../server/game-service.mjs';
import {createGameHTTP,createLeaderboardHTTP} from '../../server/http.mjs';
import {createLeaderboardService} from '../../server/leaderboard.mjs';
import {canonicalProductionRequest} from '../../server/canonical-production.mjs';
import {databaseHealth} from '../../server/health.mjs';
import sources from '../../server/runtime-source.json' with {type:'json'};
const prefix='/play/canopy-breaker/',cookie='__Secure-breaker-session';
const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
export default async request=>{
 request=canonicalProductionRequest(request);if(!request)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 if(new URL(request.url).pathname===prefix+'api/health'){
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  try{return await databaseHealth(transactionDatabase());}catch{return Response.json({ready:false},{status:503,headers:{'Cache-Control':'private, no-store'}});}
 }
 if(new URL(request.url).pathname===prefix+'api/leaderboard')return createLeaderboardHTTP({service:{leaderboard:()=>createLeaderboardService({database:transactionDatabase()}).leaderboard()}})(request);
 if(new URL(request.url).pathname===prefix+'api/completions')return createCompletionsHTTP({database:transactionDatabase()})(request);
 const store=getDeployStore({name:'breaker-access-v1',consistency:'strong'});
 if(new URL(request.url).pathname!==prefix+'api/game')return createAccessHandler({store,sources,prefix,cookieName:cookie})(request);
 let checked=null;
 const authorize=async()=>{
  const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
  const denied=()=>Object.assign(Error('Verify your NFTree wallet again'),{status:401});if(!/^[a-f0-9]{64}$/.test(token||''))throw denied();
  const key='session/'+createHash('sha256').update(token).digest('hex'),s=await store.get(key,{type:'json'});if(!s||s.expiresAt<=Date.now()||s.origin!==new URL(request.url).origin)throw denied();
  if(checked!==s.address&&Date.now()-s.verifiedAt>=30000){const owned=await nftreeOwnership(s.address);if(owned.count<1){await store.delete(key);throw Object.assign(Error('An NFTree is required'),{status:403});}s.verifiedAt=Date.now();await store.setJSON(key,s);checked=s.address;}return s;
 };
 let instance;const service=new Proxy({}, {get:(_,method)=>async(...args)=>{if(!instance){const database=transactionDatabase(),leaderboard=createLeaderboardService({database,authorize});instance={...createGameService({database,authorize,reader:createTreeReader(client),inspectSigned:createSignedInspector(client),executeSigned:async(signed,digest)=>{const result=await client.executeTransaction({transaction:fromBase64(signed.bytes),signatures:[signed.signature]});if(result.$kind==='FailedTransaction'||result.Transaction.digest!==digest)throw Error('Payment submission could not be confirmed');await client.waitForTransaction({digest,signal:AbortSignal.timeout(20000)});}}),profile:leaderboard.profile,setUsername:leaderboard.setUsername};}return instance[method](...args);}});
 return createGameHTTP({service,authorize,enabled:process.env.BREAKER_ENABLED==='true'})(request);
};
export const config={path:['/play/canopy-breaker/api/access','/play/canopy-breaker/api/game','/play/canopy-breaker/api/health','/play/canopy-breaker/api/leaderboard','/play/canopy-breaker/api/completions','/play/canopy-breaker/src/*'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:180}};
