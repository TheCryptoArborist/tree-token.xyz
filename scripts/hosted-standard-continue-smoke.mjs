/** Hosted acceptance with an unfunded ephemeral personal-message signer.
 * No Sui transaction, purchase, checkpoint or receipt is created. Never logs
 * signer material, signatures, authentication cookies or authorization tokens.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(resolve(process.env.PAID_GAME_ROOT,'app/game/tree-payments/package.json'));
const {Ed25519Keypair}=await import(pathToFileURL(require.resolve('@mysten/sui/keypairs/ed25519')));
const game='https://deploy-preview-3--treeforce89.netlify.app';
const service='https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-continue-standard';
const preview=process.env.CONTINUE_CHANNEL==='preview';
const signer=new Ed25519Keypair(),address=signer.toSuiAddress(),cookies=new Map(),checks=[];
let loggedIn=false;
async function gamePost(path,command){
 const response=await fetch(game+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
  headers:{Origin:game,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},body:JSON.stringify(command)});
 for(const c of response.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');cookies.set(name,value);}
 return{status:response.status,body:await response.json()};
}
async function call(command,headers={},authenticated=true){
 const token=cookies.get('__Host-tree-game-session');
 const response=await fetch(preview?game+'/api/tree-continue':service,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
  headers:{'Content-Type':'application/json',...(preview?{Origin:game,...(authenticated?{Cookie:'__Host-tree-game-session='+token}:{})}:authenticated?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(command)});
 return{status:response.status,body:await response.json()};
}
function passed(name){checks.push(name);console.log('HOSTED_STANDARD_CHECK',name);}
function ok(response){assert.equal(response.status,200,'HTTP '+response.status+' '+response.body.error);}
try{
 const get=await fetch(preview?game+'/api/tree-continue':service,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(preview){assert.equal(get.status,200);assert.equal((await get.json()).paymentsEnabled,false);passed('preview payment-disabled status');}
 else{assert.equal(get.status,405);passed('GET denied');}
 assert.equal((await call({action:'status'},{},false)).status,401);passed('guest denied');
 assert.equal((await call({action:'status'},{Origin:preview?'https://foreign.example':game},false)).status,403);passed('untrusted origin denied');
 const challenge=await gamePost('/api/tree-account-inline',{action:'challenge',family:'sui',address,chainId:'sui:mainnet'});ok(challenge);
 assert.ok(challenge.body.message.includes(address));
 const signed=await signer.signPersonalMessage(new TextEncoder().encode(challenge.body.message));
 const login=await gamePost('/api/tree-account-inline',{action:'verify',signature:signed.signature});ok(login);
 assert.equal(login.body.identity?.wallet.address,address);assert.equal(login.body.identity?.authenticated,true);loggedIn=true;passed('real personal-message sign-in');
 const status=await call({action:'status'});ok(status);assert.equal(status.body.enabled,false);const pilotEnabled=process.env.CONTINUE_PILOT_ENABLED==='1';assert.equal(status.body.orderPolicyEnabled,pilotEnabled);assert.equal(status.body.settlementPolicyEnabled,pilotEnabled);passed(pilotEnabled?'hosted pilot policy denies non-pilot checkout':'hosted database connection with checkout off');
 const list=await call({action:'list_purchases'});ok(list);assert.equal(list.body.accountId,login.body.identity.accountId);assert.deepEqual(list.body.purchases,[]);passed('account-scoped purchase lookup');
 const recovery=await call({action:'recover_purchase',runId:randomUUID()});ok(recovery);assert.equal(recovery.body.status,'not-found');assert.equal(recovery.body.authorization,null);passed('missing purchase grants no lives');
 const order=await call({action:'order',runId:randomUUID(),requestId:randomUUID()});assert.ok(order.status>=400);assert.notEqual(order.body.restoreAuthorized,true);passed(process.env.CONTINUE_PILOT_ENABLED==='1'?'non-pilot cannot create payment orders':'new payments remain disabled');
 assert.equal((await call({action:'list_purchases',payer:address})).status,400);passed('browser identity injection denied');
 const stale=cookies.get('__Host-tree-game-session');ok(await gamePost('/api/tree-account',{action:'logout'}));loggedIn=false;
 cookies.set('__Host-tree-game-session',stale);assert.equal((await call({action:'status'})).status,401);passed('revoked session denied');
 console.log('HOSTED_STANDARD_RESULT',JSON.stringify({channel:preview?'preview-bff':'direct-server',passed:checks.length,checks,transactionsSigned:0,purchasesCreated:0,paidReceiptsSeeded:0,paidContinuesActivated:0,installedWallet:false}));
}finally{if(loggedIn)await gamePost('/api/tree-account',{action:'logout'}).catch(()=>{});cookies.clear();}
