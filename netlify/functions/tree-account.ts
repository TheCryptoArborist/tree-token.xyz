import {getStore} from '@netlify/blobs';
import {makeEvmMessage,verifyWalletProof} from '../lib/tree-account-signatures.mjs';
import {createAccountService,digest} from '../lib/tree-account-core.mjs';
import {accountDeployment} from '../lib/recovery-candidate-config.mjs';
export default async(request:Request,context:{ip?:string})=>{
 const c=accountDeployment(request,Netlify.env);
 if(!c)return Response.json({status:'error',error:'preview-not-configured'},{status:503,headers:{'Cache-Control':'no-store'}});
 const store=getStore({name:`tree-account-preview-v1-${digest(c.storedOrigin).slice(0,12)}`,consistency:'strong'});
 return createAccountService({store,origin:c.origin,gameOrigin:c.gameOrigin,evmMessage:makeEvmMessage,verifySignature:verifyWalletProof})(request,{ip:context.ip||'unknown'});
};
export const config={path:'/api/tree-account'};
