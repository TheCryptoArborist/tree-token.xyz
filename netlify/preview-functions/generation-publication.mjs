// Preview only: fixed read/simulation requests, never accepts signatures or submits.
import {prepareHandoff} from '../../contracts/nftree-generation/scripts/wallet-handoff.mjs';
import {newClient,verifyPublication} from '../../contracts/nftree-generation/scripts/readiness.mjs';
export const config={path:'/api/generation-publication'};
export default async function handler(request) {
 const url=new URL(request.url);
 if(request.method!=='GET')return new Response('Read-only endpoint',{status:405});
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 try {
  const digest=url.searchParams.get('digest');
  if(digest){
   if(!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest))throw Error('Invalid digest');
   const result=await newClient().core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});
   return Response.json({digest,...verifyPublication(result)},{headers});
  }
  if(url.search)throw Error('Unexpected parameters');
  return Response.json(await prepareHandoff(),{headers});
 }catch(error){return Response.json({error:String(error.message)},{status:502,headers});}
}
