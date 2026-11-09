import {createStreakFeed} from '../lib/arcade-streak-feed.mjs';
const env=(k:string)=>(globalThis as any).Netlify?.env.get(k)??process.env[k];
async function rpc(args:any,kind:string){let url,secret;for(const p of ['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL']){url=env(p+'_SUPABASE_URL');secret=env(p+'_SUPABASE_SECRET_KEY');if(url||secret)break;}
 if(!url||!secret||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw Error('Unavailable');
 const r=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+(kind==='badges'?'arcade_badge_notifications_v1':'arcade_streak_milestones_v1'),{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Unavailable');return r.json();}
export default createStreakFeed({rpc});
export const config={path:'/api/arcade-streak-milestones',rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['domain','ip']}};
