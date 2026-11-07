import {resolveSuiName} from './suins-names.mjs';
export async function treeForceCompletions(pool,url,{now=Date.now,resolveName=resolveSuiName}={}){
 if(url.searchParams.get('baseline')==='1')return {cursor:{at:now(),key:''},entries:[],hasMore:false};
 const at=Number(url.searchParams.get('after')||0),key=url.searchParams.get('key')||'';
 if(!Number.isSafeInteger(at)||at<0||at>now()+60000||key&&!/^[a-f0-9]{32}$/.test(key))throw Object.assign(Error('Invalid completion cursor'),{status:400});
 const {rows}=await pool.query(`SELECT md5(r.wallet||':'||r.run_id||':'||r.score::text) AS id,r.wallet,p.username,r.score,r.stats,r.badges,
 floor(extract(epoch FROM r.updated_at)*1000)::bigint AS completed_at
 FROM treeforce89_pilot_runs r LEFT JOIN treeforce89_pilot_profiles p ON p.wallet=r.wallet
 WHERE (floor(extract(epoch FROM r.updated_at)*1000)::bigint,md5(r.wallet||':'||r.run_id||':'||r.score::text))>($1::bigint,$2::text)
 ORDER BY floor(extract(epoch FROM r.updated_at)*1000)::bigint ASC,id ASC LIMIT 101`,[at,key]).catch(error=>{if(error.code==='42P01')return {rows:[]};throw error;});
 const entries=await Promise.all(rows.slice(0,100).map(async r=>({id:r.id,completedAt:Number(r.completed_at),score:Number(r.score),wave:Number(r.stats.wave)+1,cleared:r.stats.cleared===true,badges:Array.isArray(r.badges)?r.badges.length:0,username:r.username||null,suinsName:await resolveName(r.wallet)})));
 if(entries.some(e=>!Number.isSafeInteger(e.completedAt)||!Number.isSafeInteger(e.score)||e.score<0||!Number.isInteger(e.wave)||e.wave<1||e.wave>10))throw Error('Invalid saved completion');
 const last=entries.at(-1);return {entries,cursor:last?{at:last.completedAt,key:last.id}:{at,key},hasMore:rows.length>100,scoreType:'Community scores · recorded by the game client'};
}
