import {SENDER,check} from './core.mjs';
export const approved=accounts=>accounts?.find(a=>a.address?.toLowerCase()===SENDER);
export async function connectApproved(wallet,{status=()=>{},timeoutMs=15000}={}){
 check(wallet,'Slush was not detected. Open this page in the desktop browser with the Slush extension enabled.');
 check(wallet.features['sui:signTransaction']?.version==='2.0.0','Slush must support transaction signing v2.');
 const existing=approved(wallet.accounts);
 if(existing)return existing;
 status('Waiting for Slush. Open the extension and approve sharing account ending 45c4 with tree-token.xyz.');
 let timer;
 try{
  const result=await Promise.race([wallet.features['standard:connect'].connect(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Slush has not answered yet. Open the extension to finish or cancel its connection request, then try Connect again.')),timeoutMs);})]);
  const account=approved(result?.accounts)||approved(wallet.accounts);
  const shared=result?.accounts?.length?result.accounts:wallet.accounts;
  check(account,'Slush did not share the approved account ending 45c4. Shared accounts: '+(shared?.map(a=>a.address).join(', ')||'none')+'. In Slush site permissions for tree-token.xyz, allow the approved account, then click Connect again.');
  return account;
 }finally{clearTimeout(timer);}
}
