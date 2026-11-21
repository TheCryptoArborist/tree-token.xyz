// Read-only chain preflight, or an isolated canonical login/backing/logout test.
// No path submits chain transactions or uses a user's wallet/private key.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { inspectBnbOriginalBacking } from './multichain/bnb-backing-reader.mjs';

const mode=process.argv[2];
assert(['--read-only','--canonical'].includes(mode),'Choose --read-only or --canonical.');
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceCommit=process.env.BNB_BACKING_SOURCE_COMMIT||process.env.REVIEWED_SHA||process.env.GITHUB_SHA||checkout;
assert(/^[a-f0-9]{40}$/.test(sourceCommit)&&sourceCommit===checkout,'Backing check source must match its checkout.');
const nftId='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
const trialWallet='0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae';
const validate=proof=>{
  assert(proof?.schemaVersion===1&&proof.mode==='original-one-slot-diagnostic','Missing the reviewed backing reader report.');
  assert(proof.classification==='trial-retired'&&proof.backing?.lifecycle==='released',
    'The completed trial needs a retired/released classification the page can display.');
  assert(proof.gameplayAuthorized===false&&proof.productionReady===false,'A trial backing check must never approve production access.');
  assert(proof.backing?.nftId===nftId,'Wrong original NFT in backing report.');
  assert(proof.backing.sourceCustodyConfirmed===false,'The completed trial must not claim custody.');
  assert(proof.bnb?.chainId===56&&proof.bnb.passState==='Retired','The completed BNB pass must be retired.');
  assert(proof.bnb.canPlay===false&&proof.bnb.ownerMatches===false,'A retired pass cannot grant access.');
  assert(proof.bnb.finality==='finalized'&&/^[1-9][0-9]*$/.test(proof.bnb.blockNumber)&&
    /^0x[a-f0-9]{64}$/i.test(proof.bnb.blockHash),'BNB finalized block evidence is missing.');
  assert(Array.isArray(proof.blockers)&&proof.blockers.includes('production-backing-registry-not-approved'),
    'The absent production registry must remain an explicit blocker.');
  const checked=Date.parse(proof.checkedAt),now=Date.now();
  assert(Number.isFinite(checked)&&checked<=now+2000&&checked>=now-30000,'Backing report is stale or malformed.');
  return proof;
};
fs.mkdirSync('.netlify',{recursive:true});
let report;
if(mode==='--read-only'){
  const signal=AbortSignal.timeout(20000);
  const proof=validate(await inspectBnbOriginalBacking({wallet:trialWallet,signal,
    suiClient:new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'}),
    bnbClient:createPublicClient({chain:bsc,transport:http('https://bsc-dataseed.bnbchain.org',{
      timeout:8000,retryCount:0,fetchOptions:{signal},
    })}),
  }));
  assert(proof.inspectedWallet===trialWallet,'Read-only observation has the wrong wallet.');
  report={passed:true,mode:'read-only',sourceCommit,checkedAt:new Date().toISOString(),
    gameplayAuthorized:false,productionApproved:false,chainTransactionsSubmitted:0,
    userWalletUsed:false,proof};
  fs.writeFileSync('.netlify/bnb-backing-read-only.json',JSON.stringify(report,null,2)+'\n');
}else{
  // Reuse the tested real-signature/nonce-replay/cookie/logout checker. Capture a
  // clone of the entitlement response; its finally block still revokes the
  // disposable session if the additional backing assertion fails.
  const originalFetch=globalThis.fetch;
  let proof;
  globalThis.fetch=async(input,init)=>{
    const response=await originalFetch(input,init);
    if(String(input)==='https://tree-token.xyz/api/arcade-bnb-test'&&
       init?.method==='POST'&&JSON.parse(init.body).action==='entitlement'){
      assert(response.status===403,'Canonical backing check must deny gameplay.');
      const body=await response.clone().json();
      assert(body.gameplayAuthorized===false&&body.reason==='production-backed-pass-not-enabled',
        'Canonical backing check changed the production access boundary.');
      proof=validate(body.backingCheck);
    }
    return response;
  };
  try{await import('./check-bnb-test-auth-live.mjs');}
  finally{globalThis.fetch=originalFetch;}
  assert(proof,'Canonical backing report was not observed.');
  const authentication=JSON.parse(fs.readFileSync('.netlify/bnb-test-auth-live.json','utf8'));
  assert(authentication.passed===true&&authentication.sessionRevoked===true,'Synthetic session cleanup was not verified.');
  assert(proof.inspectedWallet===authentication.testWallet.toLowerCase(),'Canonical backing observation must use the authenticated wallet.');
  report={passed:true,mode:'canonical',sourceCommit,
    deploymentId:process.env.BNB_BACKING_CANDIDATE_ID||authentication.deploymentId,
    checkedAt:new Date().toISOString(),gameplayAuthorized:false,productionApproved:false,
    chainTransactionsSubmitted:0,userWalletUsed:false,sessionRevoked:true,
    syntheticUnfundedIdentity:true,proof,authentication};
  fs.writeFileSync('.netlify/bnb-backing-live.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:true,mode:report.mode,sourceCommit,
  checkedAt:report.checkedAt,gameplayAuthorized:false,productionApproved:false,
  passState:report.proof.bnb.passState,sourceCustodyConfirmed:false,
  chainTransactionsSubmitted:0,sessionRevoked:report.sessionRevoked}));
