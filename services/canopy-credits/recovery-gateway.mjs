/** Storage-only gateway. Verifies a central TREE session; never creates a quote, receipt or entitlement. */
export const AUTH_ORIGIN='https://deploy-preview-48--tree-token.netlify.app';
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const fail=(ok,code,status=400)=>{if(!ok)throw Object.assign(Error(code),{status});};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export function canonicalSnapshot(value){
 let nodes=0;
 function visit(v,depth=0){
  fail(++nodes<=20000&&depth<=16,'checkpoint-too-complex');
  if(v===null||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='string'){fail(v.length<=1000,'checkpoint-string-too-long');return JSON.stringify(v);}
  if(typeof v==='number'){fail(Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER,'invalid-checkpoint-number');return JSON.stringify(v);}
  fail(v&&typeof v==='object','invalid-checkpoint-value');
  if(Array.isArray(v)){fail(v.length<=512,'checkpoint-array-too-long');return '['+v.map(x=>visit(x,depth+1)).join(',')+']';}
  fail(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null,'invalid-checkpoint-object');
  const keys=Object.keys(v).sort();fail(keys.length<=128&&!keys.some(k=>['__proto__','constructor','prototype'].includes(k)),'invalid-checkpoint-key');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+visit(v[k],depth+1)).join(',')+'}';
 }
 const text=visit(value);fail(new TextEncoder().encode(text).length<=262144,'checkpoint-too-large',413);return text;
}
async function body(request){
 const reader=request.body?.getReader();fail(reader,'invalid-command');const parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>280000){await reader.cancel();fail(false,'request-too-large',413);}parts.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(false,'invalid-json');}
}
export function createRecoveryGateway({verifySession,invokeStorage,now=Date.now}){
 return async request=>{
  try{
   if(request.method==='GET')return json({mode:'recovery-preview',paymentsEnabled:false,restoreAuthorized:false});
   fail(request.method==='POST','method-not-allowed',405);
   fail(!request.headers.has('origin')&&!request.headers.has('sec-fetch-site'),'server-channel-required',403);
   const token=(request.headers.get('authorization')||'').match(/^Bearer ([a-f0-9]{64})$/)?.[1];fail(token,'sign-in-required',401);
   fail(request.headers.get('content-type')?.split(';')[0].trim()==='application/json','json-required',415);
   const c=await body(request),fields={list:[],save:['runId','requestId','snapshot'],recover:['runId']};
   fail(c&&Object.hasOwn(fields,c.action)&&Object.keys(c).length===fields[c.action].length+1&&Object.keys(c).every(k=>k==='action'||fields[c.action].includes(k)),'invalid-command');
   if(c.action!=='list')fail(id(c.runId),'invalid-run');
   if(c.action==='save')fail(id(c.requestId),'invalid-request');
   const identity=await verifySession(token);
   fail(identity?.authenticated===true&&identity.environment==='preview'&&id(identity.accountId)&&identity.wallet?.family==='sui'&&/^0x[0-9a-f]{64}$/.test(identity.wallet.address||'')&&identity.expiresAt>now(),'sign-in-required',401);
   let snapshotText=null,checkpointHash=null;
   if(c.action==='save'){
    const s=c.snapshot;
    fail(s?.format==='treeforce89.checkpoint.v1'&&s.ruleset==='treeforce89.v1'&&s.runId===c.runId&&s.lives===0&&s.continuesUsed===0&&Number.isInteger(s.wave)&&s.wave>=1&&s.wave<=10&&Number.isInteger(s.score)&&s.score>=0&&s.score<=9999999999&&s.scene&&typeof s.scene==='object','invalid-checkpoint');
    fail(Object.keys(s).length===8&&Object.keys(s).every(k=>['format','ruleset','runId','wave','score','lives','continuesUsed','scene'].includes(k)),'unexpected-checkpoint-field');
    snapshotText=canonicalSnapshot(s);checkpointHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshotText))),b=>b.toString(16).padStart(2,'0')).join('');
   }
   const result=await invokeStorage({p_account:identity.accountId,p_payer:identity.wallet.address,p_action:c.action,p_run:c.runId||null,p_request:c.requestId||null,p_snapshot:snapshotText,p_hash:checkpointHash});
   return json({status:'ok',mode:'recovery-preview',accountId:identity.accountId,result,paymentsEnabled:false,restoreAuthorized:false});
  }catch(e){const safe=[400,401,403,405,413,415,429].includes(e.status);return json({error:safe?e.message:'recovery-service-unavailable',paymentsEnabled:false,restoreAuthorized:false},safe?e.status:503);}
 };
}
