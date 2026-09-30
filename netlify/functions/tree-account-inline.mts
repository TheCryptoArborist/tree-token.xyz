import {getStore} from '@netlify/blobs';
import {digest} from '../lib/tree-account-core.mjs';
import {makeEvmMessage,verifyWalletProof} from '../lib/tree-account-signatures.mjs';
import {createInlineAccountHandler} from '../lib/tree-account-inline.mjs';
import {accountDeployment} from '../lib/recovery-candidate-config.mjs';
export default async(request:Request,context:{ip?:string})=>{
 const c=accountDeployment(request,Netlify.env);
 if(!c)return Response.json({error:'preview-not-configured'},{status:503,headers:{'Cache-Control':'no-store'}});
 const store=getStore({name:`tree-account-preview-v1-${digest(c.storedOrigin).slice(0,12)}`,consistency:'strong'});
 return createInlineAccountHandler({store,origin:c.origin,gameOrigin:c.gameOrigin,verifySignature:verifyWalletProof,evmMessage:makeEvmMessage})(request,{ip:context.ip||'unknown'});
};
export const config={path:'/api/tree-account-inline'};
