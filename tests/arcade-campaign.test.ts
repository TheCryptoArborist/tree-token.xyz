import test from 'node:test';import assert from 'node:assert/strict';
import {createCampaignHandler} from '../netlify/functions/arcade-campaign.ts';
const origin='https://tree-token.xyz',token='a'.repeat(64),wallet='0x'+'b'.repeat(64);
const env={ARCADE_CAMPAIGNS_ENABLED:'true',ARCADE_GROWTH_SUPABASE_URL:'https://db.example',ARCADE_GROWTH_SUPABASE_SECRET_KEY:'server-only'};
const req=(body?:unknown,headers:Record<string,string>={})=>new Request(origin+'/api/arcade-campaign',{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const payload=()=>({progress:{wallet,campaignId:'first-round-v1',canClaim:false,learningStamps:0,tasks:{checkIn:false,quiz:false,game:false,share:false}}});
test('disabled/missing auth/foreign origin/client award flags cannot reach RPC',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('forbidden');};
 assert.equal((await createCampaignHandler({env:{ARCADE_CAMPAIGNS_ENABLED:'false'},fetchImpl})(req())).status,503);
 const handle=createCampaignHandler({env,fetchImpl});
 assert.equal((await handle(req(undefined,{Authorization:''}))).status,401);
 assert.equal((await handle(req(undefined,{Origin:'https://evil.example'}))).status,403);
 assert.equal((await handle(req({action:'claim',completed:true}))).status,400);
 assert.equal((await handle(req({action:'quiz',answers:['arcade','attendance','review'],passed:true}))).status,400);
 assert.equal((await handle(req({action:'quiz',answers:['arcade',null,'review']}))).status,400);assert.equal(calls,0);
});
test('answers go to server grading; raw bearer and key do not escape response',async()=>{
 const handle=createCampaignHandler({env,fetchImpl:async(url,options)=>{
  assert.equal(String(url),'https://db.example/rest/v1/rpc/arcade_campaign_v1');const body=JSON.parse(String(options?.body));
  assert.notEqual(body.p_token_sha256,token);assert.match(body.p_token_sha256,/^[a-f0-9]{64}$/);assert.deepEqual(body.p_answers,['chart','attendance','review']);assert.equal(body.p_action,'quiz');return Response.json({...payload(),quizResult:{score:2,passed:false,alreadyEarned:false}});
 }});const response=await handle(req({action:'quiz',answers:['chart','attendance','review']}));assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/server-only/);
});
test('storage private details are hidden; incomplete, expiry, throttling map to correct status',async()=>{
 for(const [message,code]of [['arcade-growth-invalid-session',401],['arcade-campaign-incomplete',409],['arcade-campaign-rate-limited',429],['private-db-error',503]] as const){const response=await createCampaignHandler({env,fetchImpl:async()=>Response.json({message},{status:400})})(req({action:'claim'}));assert.equal(response.status,code);assert.doesNotMatch(await response.text(),/private-db-error/);}
});
test('oversized and malformed bodies fail before storage',async()=>{
 let calls=0;const handle=createCampaignHandler({env,fetchImpl:async()=>{calls++;return Response.json(payload());}});
 assert.equal((await handle(req({action:'quiz',answers:['x'.repeat(2100),'attendance','review']}))).status,400);
 assert.equal((await handle(req({action:'start',answers:[]}))).status,400);assert.equal(calls,0);
});

test('release default enables only the new handler; explicit false disables it before storage',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('storage must not be called')};
 assert.equal((await createCampaignHandler({env:{},fetchImpl})(req(undefined,{Authorization:''}))).status,401);
 assert.equal((await createCampaignHandler({env:{ARCADE_CAMPAIGNS_ENABLED:'false'},fetchImpl})(req())).status,503);
 assert.equal(calls,0);
});
