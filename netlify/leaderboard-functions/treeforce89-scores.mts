import {getCanonicalDevelopmentDatabase} from '../preview-lib/treeforce89-database.mjs';
import {createAuthenticatedSessionResolver} from '../preview-lib/treeforce89-source/game/authenticated-session.mjs';
import {earnedBadges,validateRun,validateUsername} from '../../treeforce89/achievements/rules.mjs';
const headers={'Cache-Control':'no-store'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
// Additive tables in the already isolated game database; no existing schema changes.
const schema=`CREATE TABLE IF NOT EXISTS treeforce89_pilot_profiles(wallet text PRIMARY KEY,username text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS treeforce89_pilot_runs(wallet text NOT NULL,run_id text NOT NULL,score integer NOT NULL,stats jsonb NOT NULL,badges jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(wallet,run_id));
CREATE INDEX IF NOT EXISTS treeforce89_pilot_scores ON treeforce89_pilot_runs(score DESC);`;
export function createScoresHandler({database=getCanonicalDevelopmentDatabase,resolve=createAuthenticatedSessionResolver}={}){
let ready;
return async function handler(request,context){
 if(context.site.id!=='aa62f324-b880-47d6-85b8-4ba0700ff5bf'||context.deploy.context!=='production')return reply({error:'Unavailable'},503);
 try{
 const {pool}=database();
 if(request.method==='GET'){
  try{
   const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
   if(token){const session=await resolve(pool)({sessionToken:token});const profile=await pool.query('SELECT username FROM treeforce89_pilot_profiles WHERE wallet=$1',[session.wallet]);const own=await pool.query("SELECT coalesce(jsonb_agg(DISTINCT badge),'[]'::jsonb) AS badges FROM treeforce89_pilot_runs r CROSS JOIN LATERAL jsonb_array_elements_text(r.badges) badge WHERE wallet=$1",[session.wallet]);return reply({username:profile.rows[0]?.username||'',badges:own.rows[0].badges});}

   const result=await pool.query(`WITH best AS (SELECT DISTINCT ON(wallet) wallet,score,stats,updated_at FROM treeforce89_pilot_runs ORDER BY wallet,score DESC,updated_at ASC)
   SELECT p.username,b.score,(b.stats->>'wave')::int+1 AS wave,b.updated_at,
   (SELECT coalesce(jsonb_agg(DISTINCT badge),'[]'::jsonb) FROM treeforce89_pilot_runs r CROSS JOIN LATERAL jsonb_array_elements_text(r.badges) badge WHERE r.wallet=b.wallet) AS badges
   FROM best b JOIN treeforce89_pilot_profiles p ON p.wallet=b.wallet ORDER BY score DESC,b.updated_at ASC,b.wallet ASC LIMIT 50`);
   return reply({entries:result.rows,scoreType:'Community scores · recorded by the game client'});
  }catch(e){if(e.code==='42P01')return reply({entries:[]});throw e;}
 }
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Origin not permitted'},403);
 const sessionToken=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
 if(!sessionToken)return reply({error:'Verify your NFTree to save your pilot profile.'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required'},415);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Request too large'},413);
 const body=JSON.parse(raw),username=validateUsername(body.username);
 const session=await resolve(pool)({sessionToken});
 const run=body.run?validateRun(body.run):null;
 if(run&&run.runId!==session.runId)return reply({error:'This run is no longer current.'},409);
 // Gameplay remains client simulated. These checks reject malformed/test runs;
 // they do not claim server-authoritative anti-cheat or qualify financial prizes.
 if(run&&(run.score>Math.max(1,Date.now()-session.createdAt)*20||run.kills>Math.max(1,Date.now()-session.createdAt)/20))return reply({error:'Run statistics exceed gameplay limits.'},400);
 if(!ready)ready=pool.query(schema).catch(e=>{ready=undefined;throw e;});await ready;
 const db=await pool.connect();
 try{await db.query('BEGIN');
 await db.query(`INSERT INTO treeforce89_pilot_profiles(wallet,username) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET username=EXCLUDED.username,updated_at=now()`,[session.wallet,username]);
 if(run)await db.query(`INSERT INTO treeforce89_pilot_runs(wallet,run_id,score,stats,badges) VALUES($1,$2,$3,$4,$5) ON CONFLICT(wallet,run_id) DO UPDATE SET score=EXCLUDED.score,stats=EXCLUDED.stats,badges=EXCLUDED.badges,updated_at=now() WHERE EXCLUDED.score>=treeforce89_pilot_runs.score`,[session.wallet,run.runId,run.score,JSON.stringify(run),JSON.stringify(earnedBadges(run))]);
 const own=await db.query(`SELECT coalesce(jsonb_agg(DISTINCT badge),'[]'::jsonb) AS badges FROM treeforce89_pilot_runs r CROSS JOIN LATERAL jsonb_array_elements_text(r.badges) badge WHERE wallet=$1`,[session.wallet]);
 await db.query('COMMIT');return reply({saved:true,username,badges:own.rows[0].badges});
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){if(e.code==='SESSION_REQUIRED')return reply({error:'Session expired. Verify your NFTree again.'},401);if(e instanceof SyntaxError||/Use 3|run|statistics/i.test(e.message))return reply({error:e.message},400);console.error('treeforce89 leaderboard unavailable',e.code||'service');return reply({error:'Leaderboard unavailable. Please retry.'},503);}
}
}
export default createScoresHandler();
export const config={path:'/api/treeforce89-leaderboard',rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:60}};
