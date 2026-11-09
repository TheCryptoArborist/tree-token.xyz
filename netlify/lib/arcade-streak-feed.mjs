import {resolveSuiName} from './streak-suins.mjs';
const badgeIds=['seedling','sapling','deep-roots','full-canopy','arcade-passport'];
const validDays=n=>Number.isSafeInteger(n)&&(n===3||n===7||n===14||n>=30&&n%30===0);
export function createStreakFeed({rpc,resolveName=resolveSuiName,now=Date.now}){return async req=>{
 const headers={'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method!=='GET')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET'}});
 const u=new URL(req.url),kind=u.searchParams.get('kind')||'streaks',at=Number(u.searchParams.get('after')||0),key=u.searchParams.get('key')||'';
 if(!['streaks','badges'].includes(kind)||!Number.isSafeInteger(at)||at<0||at>now()+60000||!/^([a-f0-9]{32})?$/.test(key))return new Response('Invalid cursor',{status:400,headers});
 try{const rows=await rpc({p_after:at,p_key:key},kind);if(!Array.isArray(rows)||rows.some(r=>!/^[a-f0-9]{32}$/.test(r.id)||!/^0x[0-9a-f]{64}$/.test(r.wallet)||(kind==='streaks'?!validDays(r.days):!badgeIds.includes(r.badge_id)||!/^\d{4}-\d{2}-\d{2}$/.test(r.month_key)||r.streak_id!==null&&!/^[a-f0-9]{32}$/.test(r.streak_id))||!Number.isSafeInteger(Number(r.at))||kind==='streaks'&&!/^\d{4}-\d{2}-\d{2}$/.test(r.date_key)))throw Error('Invalid saved milestone');
 const entries=await Promise.all(rows.slice(0,100).map(async r=>({id:r.id,at:Number(r.at),...(kind==='streaks'?{days:r.days,date:r.date_key}:{badgeId:r.badge_id,month:r.month_key.slice(0,7),streakId:r.streak_id}),suinsName:await resolveName(r.wallet),walletLabel:r.wallet.slice(0,8)+'…'+r.wallet.slice(-6),badges:Array.isArray(r.badges)?r.badges.filter(x=>['seedling','sapling','deep-roots','full-canopy','arcade-passport'].includes(x)):[]})));
 const last=entries.at(-1);return Response.json({entries,cursor:last?{at:last.at,key:last.id}:{at,key},hasMore:rows.length>100},{headers});
 }catch{return Response.json({error:'Streak milestones temporarily unavailable'},{status:503,headers});}
};}
