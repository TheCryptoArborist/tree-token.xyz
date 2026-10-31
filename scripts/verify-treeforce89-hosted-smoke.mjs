import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Ed25519Keypair} from '../netlify/preview-lib/treeforce89-source/node_modules/@mysten/sui/dist/keypairs/ed25519/keypair.mjs';
const origin='https://deploy-preview-70--tree-token.netlify.app';
const post=async(path,body,{requestOrigin=origin,token}={})=>{
  const response=await fetch(origin+'/.netlify/functions/'+path,{
    method:'POST',headers:{Origin:requestOrigin,...(body?{'Content-Type':'application/json'}:{}),
      ...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000),
  });
  let result;try{result=await response.json();}catch{throw Error(path+' returned non-JSON HTTP '+response.status);}
  return {status:response.status,body:result};
};
// Unfunded ephemeral keys only; personal-message signatures never authorize a payment.
const keypair=new Ed25519Keypair();
const wallet=keypair.toSuiAddress();
const challenge=await post('tree-challenge',{wallet});
assert.equal(challenge.status,201,'Hosted challenge unavailable');
assert.ok(challenge.body.message.includes('Origin: '+origin+'\n'));
const {signature}=await keypair.signPersonalMessage(new TextEncoder().encode(challenge.body.message));
const proof={wallet,nonce:challenge.body.nonce,signature};
const denied=await post('tree-session',proof);
assert.equal(denied.status,403,'Hosted non-holder verification HTTP '+denied.status);
assert.equal(denied.body.code,'NFTREE_REQUIRED');
assert.equal((await post('tree-session',proof)).status,401);
assert.equal((await post('tree-challenge',{wallet},{requestOrigin:'https://attacker.example'})).status,503);
assert.equal((await post('tree-session',{...proof,eligible:true})).status,400);
const invalidChallenge=await post('tree-challenge',{wallet});
assert.equal(invalidChallenge.status,201);
const forged=(await new Ed25519Keypair().signPersonalMessage(new TextEncoder().encode('forged'))).signature;
assert.equal((await post('tree-session',{wallet,nonce:invalidChallenge.body.nonce,signature:forged})).status,401);
assert.equal((await post('tree-logout')).status,401);
const absentToken=randomBytes(32).toString('hex');
const logout=await post('tree-logout',undefined,{token:absentToken});
assert.equal(logout.status,200);assert.equal(logout.body.loggedOut,true);
assert.equal((await post('tree-run',{runId:'grove-'+randomBytes(16).toString('hex')},{token:absentToken})).status,401);
const checkout=await post('tree-continue',{digest:'not-a-payment'});
assert.equal(checkout.status,503);assert.equal(checkout.body.authorized,false);
const status=await post('treeforce89-db-status');
assert.equal(status.status,200);assert.equal(status.body.schemaReady,true);
assert.equal(status.body.isolationVerified,true);assert.equal(status.body.paymentsEnabled,false);
console.log(JSON.stringify({origin,challengeIssued:true,realSignatureVerified:true,
  liveMainnetNonholderDenied:true,replayRejected:true,forgedSignatureRejected:true,
  forgedEligibilityRejected:true,crossOriginRejected:true,logoutRequiresToken:true,
  absentTokenLogoutIdempotent:true,unauthenticatedRunRejected:true,
  schemaReady:true,isolatedDatabase:true,paymentsEnabled:false,
  realHolderSessionTested:false,slushWalletTested:false}));
