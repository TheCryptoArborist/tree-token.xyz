const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const fields={open:[],frames:['id','revision','inputs'],next:[],quote:[],bind:['id','signed'],submit:['id'],redeem:['id'],cancel:['id'],reconcile:['id'],profile:[],setUsername:['username']};
export function createLeaderboardHTTP({service,report=console.error}){return async req=>{
 if(req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET'}});
 try{return Response.json(await service.leaderboard(),{headers});}
 catch{report({event:'breaker-leaderboard-error'});return Response.json({error:'The leaderboard is temporarily unavailable. Please retry.'},{status:503,headers});}
};}
export function createGameHTTP({service,authorize,enabled=false,report=console.error}){return async req=>{
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 try{
  await authorize(req);
  if(req.method==='GET')return reply(enabled?{enabled:true,invoices:await service.history(req)}:{enabled:false});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Use the game’s own page'},403);
  if(!enabled)return reply({error:'Canopy Breaker is awaiting activation. No TREE payment is available.'},503);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required'},415);
  const stream=req.body?.getReader();if(!stream)return reply({error:'JSON required'},400);const decoder=new TextDecoder();let size=0,text='';for(;;){const r=await stream.read();if(r.done)break;size+=r.value.byteLength;if(size>70000){await stream.cancel();return reply({error:'Request too large'},413);}text+=decoder.decode(r.value,{stream:true});}text+=decoder.decode();
  const b=JSON.parse(text);if(!b||!Object.hasOwn(fields,b.action)||Object.keys(b).some(k=>k!=='action'&&!fields[b.action].includes(k)))return reply({error:'Invalid game request'},400);
  const {action,...input}=b;return reply(await service[action](req,input));
 }catch(error){if(error instanceof SyntaxError)return reply({error:'Invalid JSON'},400);if(error?.status)return reply({error:error.message},error.status);report({event:'breaker-service-error',message:error?.message});return reply({error:'The forest connection was interrupted. Reconnect to recover your saved run or recorded payment.'},503);}
};}
