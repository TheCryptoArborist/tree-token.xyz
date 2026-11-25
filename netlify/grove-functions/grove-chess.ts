import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Chess} from '../../play/grove-chess/vendor/chess.js';
import {getCanonicalNftreeOwnership} from '../functions/nftree-wallet.ts';
import {validEventSession,requireEventHolder} from '../lib/arcade-event-access.ts';
const origins=['https://tree-token.xyz','https://www.tree-token.xyz'];
const env=(key:string)=>(globalThis as any).Netlify?.env?.get(key)??process.env[key];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function database(){
 let url,secret;for(const p of ['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL']){url=env(p+'_SUPABASE_URL');secret=env(p+'_SUPABASE_SECRET_KEY');if(url||secret)break;}
 if(!url||!secret||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw Error('service-unavailable');
 return async(name:string,args:any)=>{const r=await fetch(url!.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret!,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d?.message||'service-unavailable');return d;};
}
const messages:any={'nftree-required':'Connect your NFTree wallet and sign in to continue.','room-not-found':'This match could not be found.','invitation-expired':'This invitation has expired.','not-your-seat':'This seat belongs to another player.','revision-conflict':'The board changed. Refreshing the match…','wait-before-inviting':'Wait one minute before creating another invitation.','resume-existing-room':'Resume or finish your existing online match first.','game-ended':'This match has ended or expired.','room-already-started':'The match has already started.','illegal-move':'That move is not legal.','not-your-turn':'Wait for your opponent’s move.','invalid-request':'The request could not be verified.','invalid-session':'Sign in to the Arcade again.'};
export function createGroveHandler(deps:any={}){return async(req:Request)=>{
 let cookie='';
 const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
 try{
  const u=new URL(req.url),action=u.searchParams.get('action')||'read',rpc=deps.rpc||database();
  if(action==='invitations'&&req.method==='GET')return json(await rpc('grove_chess_v1',{p_action:action}));
  if(!['create','join','read','move','resign','cancel'].includes(action)||req.method!==(action==='read'?'GET':'POST'))return json({message:'Not found.'},404);
  const origin=req.headers.get('origin')||u.origin;
  if(!origins.includes(origin)||req.headers.get('sec-fetch-site')==='cross-site')return json({message:'Use the official TREE Arcade.'},403);
  let token=/(?:^|;\s*)__Host-grove-player=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];
  if(!token){token=randomBytes(32).toString('hex');cookie=`__Host-grove-player=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000`;}
  let b:any={};if(req.method==='POST'){if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('invalid-request');const raw=await req.text();if(raw.length>2048)throw Error('invalid-request');b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw Error('invalid-request');}
  const room=action==='create'?randomUUID():(b.room||u.searchParams.get('room'));if(!uuid.test(room||''))throw Error('invalid-request');
  const used=b.used??0;if(!Number.isInteger(used)||used<0||used>2)throw Error('invalid-request');
  let wallet=null;
  const bearer=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization')||'');
  if(bearer&&action!=='read'){
   const session=validEventSession(await rpc('arcade_growth_read_session_v1',{p_token_sha256:hash(bearer[1]),p_origin:origin}),origin,Date.now());
   await requireEventHolder(session,origin,deps.ownership||getCanonicalNftreeOwnership);wallet=session.wallet;
  }
  const args:any={p_action:action,p_actor:hash(token),p_room:room,p_used:used,p_wallet:wallet};
  if(action==='create')args.p_announce=b.announce===true;
  if(['move','resign','cancel'].includes(action)){
   if(!Number.isSafeInteger(b.revision)||b.revision<0)throw Error('invalid-request');args.p_revision=b.revision;
   if(action!=='cancel'){
    const current=await rpc('grove_chess_v1',{...args,p_action:'inspect'});if(!current.seat)throw Error('not-your-seat');if(current.revision!==b.revision)throw Error('revision-conflict');if(current.status!=='playing')throw Error('game-ended');
    const chess=new Chess();chess.loadPgn(current.pgn);
    if(action==='resign')args.p_result=current.seat==='w'?'Pine wins by resignation.':'Birch wins by resignation.';
    else{if(current.seat!==chess.turn())throw Error('not-your-turn');if(!/^[a-h][1-8]$/.test(b.from||'')||!/^[a-h][1-8]$/.test(b.to||'')||(b.promotion!==undefined&&!['q','r','b','n'].includes(b.promotion)))throw Error('illegal-move');try{chess.move({from:b.from,to:b.to,...b.promotion?{promotion:b.promotion}:{}});}catch{throw Error('illegal-move');}args.p_pgn=chess.pgn();args.p_result=chess.isCheckmate()?(chess.turn()==='w'?'Pine':'Birch')+' wins by checkmate.':chess.isDraw()?'A peaceful draw.':null;}
   }
  }
  const r=await rpc('grove_chess_v1',args);
  // Never expose player cookie hashes, wallets or authentication material.
  return json({room:{id:r.id,pgn:r.pgn,revision:r.revision,status:(r.status==='playing'&&Date.parse(r.updated_at)<Date.now()-86400000)?'expired':r.status,result:r.result,seat:r.seat,holderSeat:r.seat==='w'?Boolean(r.white_wallet):r.seat==='b'?Boolean(r.black_wallet):false,used:r.used,expiresAt:r.expires_at,updatedAt:r.updated_at}});
 }catch(e){const code=String((e as any).code||(e as Error).message);return json({message:messages[code]||'Online play is temporarily unavailable. Your match is saved.',code:messages[code]?code:'service-unavailable'},messages[code]?409:503);}
};}
export default createGroveHandler();
export const config={path:'/api/grove-chess',method:['GET','POST'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:90}};
