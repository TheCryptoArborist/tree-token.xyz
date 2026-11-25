// Fixed GET-only simulation/receipt service. No keys, signature input or submission.
import {prepareSlotHandoff,verifySlotReceipt} from '../../contracts/nftree-generation/scripts/slot-handoff.mjs';
export const config={path:'/api/generation-slot'};
export default async function handler(request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(request.method!=='GET')return new Response('Read-only endpoint',{status:405,headers});
 try{const url=new URL(request.url),digest=url.searchParams.get('digest');
  if(digest){if(!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest)||[...url.searchParams].length!==1)throw Error('Invalid receipt request');return Response.json(await verifySlotReceipt(digest),{headers});}
  if(url.search)throw Error('Unexpected parameters');return Response.json(await prepareSlotHandoff(),{headers});
 }catch(e){return Response.json({error:String(e.message)},{status:502,headers});}
}
