import {createHash} from 'node:crypto';
const playerId=wallet=>createHash('sha256').update('tree-arcade-weekly:'+String(wallet).toLowerCase()).digest('hex');
import {resolveSuiName} from './suins-names.mjs';
const headers={'Cache-Control':'no-store'};
const keyPattern=/^[a-f0-9]{32}$/;
export function createCompletionsHTTP({database,now=Date.now,resolveName=resolveSuiName}){
 return async request=>{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET'}});
  const url=new URL(request.url);
  if(url.searchParams.get('baseline')==='1')return Response.json({cursor:{at:now(),key:''},entries:[],hasMore:false},{headers});
  const at=Number(url.searchParams.get('after')??0),key=url.searchParams.get('key')||'';
  if(!Number.isSafeInteger(at)||at<0||at>now()+60000||key&&!keyPattern.test(key))return new Response('Invalid cursor',{status:400,headers});
  try{
   // No wallet, raw run ID, payment, session, or input data leaves this endpoint.
   const {rows}=await database.query(`SELECT md5(r.id::text) AS id,r.updated_at,r.wallet,
    r.state->>'status' AS outcome,r.state->>'score' AS score,r.state->>'level' AS level,p.username
    FROM breaker.runs r LEFT JOIN breaker.player_profiles p ON p.wallet=r.wallet
    WHERE r.state->>'status' IN ('won','gameover')
     AND (r.updated_at,md5(r.id::text))>($1::bigint,$2::text)
    ORDER BY r.updated_at ASC,md5(r.id::text) ASC LIMIT 101`,[at,key]);
   const entries=await Promise.all(rows.slice(0,100).map(async row=>({
    id:row.id,playerId:playerId(row.wallet),completedAt:Number(row.updated_at),outcome:row.outcome,
    score:Number(row.score),level:Number(row.level),
    suinsName:await resolveName(row.wallet),
    username:typeof row.username==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/.test(row.username)?row.username:null,
   })));
   if(entries.some(e=>!keyPattern.test(e.id)||!Number.isSafeInteger(e.completedAt)||!Number.isSafeInteger(e.score)||e.score<0||!Number.isInteger(e.level)||e.level<1||e.level>30||!['won','gameover'].includes(e.outcome)))throw Error('Invalid saved completion');
   const last=entries.at(-1);
   return Response.json({entries,cursor:last?{at:last.completedAt,key:last.id}:{at,key},hasMore:rows.length>100},{headers});
  }catch{return Response.json({error:'Completed games temporarily unavailable'},{status:503,headers});}
 };
}
