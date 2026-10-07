/** Read-only credential acceptance. NO quote signer, order, receipt, or delivery call.
 * Authentication is a dedicated setup bearer secret, not a Supabase platform key.
 * This endpoint is not the payment gateway and cannot enable payment processing.
 */
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
export const PROJECT = 'lehswszuekjqottolmsf';
export const MODES = Object.freeze(['orders','settlement','storage','delivery','recovery']);
export const ENV_NAMES = Object.freeze(Object.fromEntries(MODES.map(m=>[m,`TREE_CONTINUE_${m.toUpperCase()}_DB_URL`])));
const CHECK_SECRET='TREE_CONTINUE_SETUP_TOKEN';
const EXPECTED=Object.freeze({
 orders:['commerce_policy_read()','commerce_read(uuid,text,text,text,uuid)','commerce_save_order(uuid,text,text,text,uuid,jsonb,text,jsonb)'],
 settlement:['commerce_policy_read()','commerce_read(uuid,text,text,text,uuid)','commerce_settle(uuid,text,text,text,uuid,uuid,jsonb)'],
 storage:['read_recovery(uuid,text,text,text,uuid)','register_flight(uuid,text,text,text,uuid)','store_checkpoint(uuid,text,text,text,uuid,uuid,text,text)'],
 delivery:['paid_delivery(uuid,text,text,text,uuid,text,text,uuid,uuid,text)'],
 recovery:['lookup_purchases(uuid,text,text,text,uuid,uuid)','reserve_receipt_scan(uuid,text,text,text,uuid)'],
});
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=(ok,code)=>{if(!ok)fail(code);};
const ADMIN='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const PILOT='0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6';
export const ROLE_QUERY=`SELECT current_user::text AS effective_user,session_user::text AS login,
 (SELECT rolcanlogin AND rolinherit AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  FROM pg_roles WHERE rolname=session_user) AS restricted,
 (SELECT datdba<>(SELECT oid FROM pg_roles WHERE rolname=session_user)
  FROM pg_database WHERE datname=current_database()) AS not_owner,
 coalesce((SELECT jsonb_agg(g.rolname ORDER BY g.rolname) FROM pg_auth_members m
  JOIN pg_roles g ON g.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE u.rolname=session_user),'[]'::jsonb) AS member_roles,
 coalesce((SELECT bool_and(m.inherit_option AND NOT m.admin_option AND NOT m.set_option)
  FROM pg_auth_members m JOIN pg_roles u ON u.oid=m.member WHERE u.rolname=session_user),false) AS restricted_membership,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='tree_continue_v1' AND c.relkind IN ('r','p','v','m','f')
  AND has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS direct_tables,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='tree_continue_v1' AND c.relkind='S'
  AND has_sequence_privilege(session_user,c.oid,'SELECT,USAGE,UPDATE')) AS direct_sequences,
 has_schema_privilege(session_user,'tree_continue_v1','CREATE') OR
 has_schema_privilege(session_user,'public','CREATE') AS can_create,
 coalesce((SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='tree_continue_v1' AND has_function_privilege(session_user,p.oid,'EXECUTE')),'[]'::jsonb) AS functions`;

export function poolSettings(value,mode) {
 check(MODES.includes(mode)&&typeof value==='string'&&value.length<=1024,'configuration-required');
 let u;try{u=new URL(value);}catch{fail('configuration-required');}
 const login=`tree_continue_${mode}_app_v1`;
 check(u.protocol==='postgresql:'&&/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)&&
  u.port==='6543'&&u.pathname==='/postgres'&&u.search===''&&u.hash===''&&
  u.username===`${login}.${PROJECT}`&&/^[A-Za-z0-9_-]{48}$/.test(u.password),'configuration-required');
 return {host:u.hostname,port:6543,database:'postgres',user:u.username,password:u.password,
  ssl:{rejectUnauthorized:true},max:1,idleTimeoutMillis:1000,connectionTimeoutMillis:5000,
  query_timeout:8000,application_name:'tree-runtime-check-v1'};
}

export function checkRole(row,mode) {
 const expected=EXPECTED[mode].map(f=>'tree_continue_v1.'+f).sort();
 const login=`tree_continue_${mode}_app_v1`;
 check(row&&row.login===login&&row.effective_user===login&&row.restricted===true&&row.not_owner===true&&
  row.restricted_membership===true&&row.direct_tables===false&&row.direct_sequences===false&&row.can_create===false&&
  JSON.stringify(row.member_roles)===JSON.stringify([`tree_continue_${mode}`])&&
  Array.isArray(row.functions)&&JSON.stringify([...row.functions].sort())===JSON.stringify(expected),'role-verification-failed');
}

function checkPolicy(p){
 check(p&&p.newOrdersEnabled===false&&p.settlementEnabled===false&&p.deployment===null&&
  p.totalLimitRaw==='0'&&p.reservedRaw==='0'&&p.environment==='release-candidate'&&
  p.authOrigin==='https://deploy-preview-48--tree-token.netlify.app'&&p.adminWallet===ADMIN&&p.pilotWallet===PILOT,
  'policy-not-disabled');
}

export async function inspectConnections({getEnv,createPool}) {
 check(typeof getEnv==='function'&&typeof createPool==='function','configuration-required');
 const settings=MODES.map(mode=>poolSettings(getEnv(ENV_NAMES[mode]),mode));
 check(new Set(settings.map(s=>`${s.host}:${s.port}`)).size===1&&
  new Set(settings.map(s=>s.password)).size===MODES.length,'configuration-required');
 const pools=[];
 try {
  for(let i=0;i<MODES.length;i++){
   const mode=MODES[i],pool=createPool(settings[i]);pools.push(pool);
   const db=await pool.connect();
   try{
    await db.query('BEGIN READ ONLY');
    await db.query("SET LOCAL statement_timeout='5s'");
    const r=await db.query(ROLE_QUERY);check(r.rows?.length===1,'role-verification-failed');checkRole(r.rows[0],mode);
    if(mode==='orders'){
     const p=await db.query('SELECT tree_continue_v1.commerce_policy_read() AS result');
     check(p.rows?.length===1,'policy-not-disabled');checkPolicy(p.rows[0].result);
    }
    await db.query('COMMIT');
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
   finally{db.release();}
  }
  return {protocol:'tree-runtime-check.v1',projectRef:PROJECT,credentialsVerified:true,
   checkedRoles:[...MODES],policyDisabled:true,paymentsEnabled:false,restoreAuthorized:false};
 }finally{await Promise.allSettled(pools.map(p=>p.end()));}
}

async function command(request){
 const reader=request.body?.getReader();check(reader,'invalid-request');let total=0,parts=[];
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;
   check(total<=512,'invalid-request');parts.push(value);}
 }finally{await reader.cancel().catch(()=>{});}
 const joined=new Uint8Array(total);let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.length;}
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined));}catch{fail('invalid-request');}
 check(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===1&&value.action==='check','invalid-request');
}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export function createRuntimeCheck({getEnv,inspect,now=Date.now}){
 let running=false,lastAttempt=-Infinity;
 return async request=>{
  const flags={protocol:'tree-runtime-check.v1',projectRef:PROJECT,credentialsVerified:false,paymentsEnabled:false,restoreAuthorized:false};
  try{
   if(request.method!=='POST')return json({...flags,error:'method-not-allowed'},405);
   if(request.headers.has('origin')||request.headers.has('sec-fetch-site'))return json({...flags,error:'server-channel-required'},403);
   const expected=getEnv(CHECK_SECRET);
   if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))return json({...flags,error:'setup-not-configured'},503);
   const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return json({...flags,error:'unauthorized'},401);
   if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({...flags,error:'invalid-request'},415);
   await command(request);
   if(running||now()-lastAttempt<5000)return json({...flags,error:'check-busy'},429);
   running=true;lastAttempt=now();
   try{return json(await inspect());}finally{running=false;}
  }catch(error){
   const allowed=new Set(['configuration-required','role-verification-failed','policy-not-disabled','invalid-request']);
   const code=allowed.has(error?.code)?error.code:'connection-check-failed';
   return json({...flags,error:code},code==='invalid-request'?400:503);
  }
 };
}
