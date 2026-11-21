import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const checkerURL=new URL('../scripts/check-bnb-backing-live.mjs',import.meta.url).href;
const coreURL=new URL('../scripts/multichain/bnb-game-access-core.mjs',import.meta.url).href;
const serviceURL=new URL('../scripts/multichain/bnb-test-auth-service.mjs',import.meta.url).href;
const TOKEN='bnbtest_'+'d4'.repeat(32);

function run(mode){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bnb-backing-checker-'));
  try{
    execFileSync('git',['init','--quiet'],{cwd:dir});
    execFileSync('git',['-c','user.name=Offline Test','-c','user.email=test@invalid.example',
      'commit','--quiet','--allow-empty','-m','Offline backing checker fixture'],{cwd:dir});
    const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
    const program=`
      import {BNB_ORIGIN,BNB_IDENTITY_SCOPE,issueBnbChallenge} from ${JSON.stringify(coreURL)};
      import {COOKIE,PATH} from ${JSON.stringify(serviceURL)};
      process.argv[2]='--canonical';
      const mode=${JSON.stringify(mode)},token=${JSON.stringify(TOKEN)};
      const cookie=COOKIE+'='+token;
      const audit={actions:[],active:false,logoutCount:0,correctCleanupCookie:true};
      process.on('exit',()=>console.log(JSON.stringify({testAudit:audit})));
      let wallet,signCount=0;
      const response=(data,status=200,extra={})=>Response.json({gameplayAuthorized:false,...data},
        {status,headers:{'Cache-Control':'no-store',...extra}});
      globalThis.fetch=async(url,init)=>{
        if(url!==BNB_ORIGIN+PATH||init.method!=='POST')throw Error('Unexpected network request in offline checker test');
        const b=JSON.parse(init.body),h=new Headers(init.headers);audit.actions.push(b.action);
        if(h.get('origin')!==BNB_ORIGIN)return response({error:'origin-denied'},403);
        if(b.action==='challenge'){
          const {record,message}=issueBnbChallenge({wallet:b.wallet,nonce:'ab'.repeat(32)});
          wallet=record.address.toLowerCase();
          return response({wallet:record.address,nonce:record.nonce,message,scope:BNB_IDENTITY_SCOPE,
            chainId:56,expiresAt:record.expiresAt});
        }
        if(b.action==='sign-in'){
          if(++signCount>1)return response({error:'challenge-used'},403);
          audit.active=true;
          return response({authenticated:true,wallet,scope:BNB_IDENTITY_SCOPE,chainId:56},200,
            {'Set-Cookie':cookie+'; Path='+PATH+'; HttpOnly; Secure; SameSite=Strict; Max-Age=3590'});
        }
        if(b.action==='logout'){
          audit.logoutCount++;audit.correctCleanupCookie&&=h.get('cookie')===cookie;
          audit.active=false;
          return response({signedOut:true},200,{'Set-Cookie':COOKIE+'=; Path='+PATH+'; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
        }
        if(b.action==='status')return !audit.active||h.get('cookie')!==cookie
          ?response({error:'invalid-session'},401)
          :response({authenticated:true,wallet,scope:BNB_IDENTITY_SCOPE,chainId:56});
        if(b.action==='entitlement'){
          let proof={schemaVersion:1,mode:'original-one-slot-diagnostic',classification:'trial-retired',inspectedWallet:wallet,
            checkedAt:new Date().toISOString(),gameplayAuthorized:false,productionReady:false,
            blockers:['production-backing-registry-not-approved','retired-one-slot-trial'],
            backing:{nftId:'0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',sourceCustodyConfirmed:false,lifecycle:'released'},
            bnb:{chainId:56,passState:'Retired',canPlay:false,ownerMatches:false,
              finality:'finalized',blockNumber:'123',blockHash:'0x'+'ab'.repeat(32)}};
          if(mode==='missing')proof=undefined;
          if(mode==='active')proof.bnb.passState='Active';
          if(mode==='production-approved')proof.productionReady=true;
          if(mode==='held')proof.backing.sourceCustodyConfirmed=true;
          if(mode==='stale')proof.checkedAt=new Date(Date.now()-120000).toISOString();
          if(mode==='wrong-wallet')proof.inspectedWallet='0x'+'77'.repeat(20);
          if(mode==='missing-classification')delete proof.classification;
          if(mode==='wrong-lifecycle')proof.backing.lifecycle='held';
          return response({reason:'production-backed-pass-not-enabled',backingCheck:proof},403);
        }
        throw Error('Unexpected offline API action');
      };
      await import(${JSON.stringify(checkerURL)});
    `;
    const child=spawnSync(process.execPath,['--input-type=module','--eval',program],{
      cwd:dir,encoding:'utf8',timeout:20000,
      env:{...process.env,BNB_BACKING_SOURCE_COMMIT:sourceCommit,REVIEWED_SHA:sourceCommit,
        BNB_BACKING_CANDIDATE_ID:'offline-candidate',BNB_TEST_CANDIDATE_ID:'offline-candidate'},
    });
    const output=(child.stdout||'')+(child.stderr||'');
    assert(!output.includes(TOKEN),'Failure output must never print a session token');
    assert(!child.error&&child.signal===null,'Offline checker process must finish');
    const auditLine=(child.stdout||'').split('\n').find(line=>line.startsWith('{"testAudit":'));
    assert(auditLine,'Offline checker must report cleanup outcome');
    const reportPath=path.join(dir,'.netlify/bnb-backing-live.json');
    const reportText=fs.existsSync(reportPath)?fs.readFileSync(reportPath,'utf8'):null;
    assert(!reportText?.includes(TOKEN),'Backing report must never retain session tokens');
    return{status:child.status,audit:JSON.parse(auditLine).testAudit,
      report:reportText?JSON.parse(reportText):null};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('canonical backing checker completes actual login checker and confirms session cleanup',()=>{
  const r=run('valid');assert.equal(r.status,0);
  assert.equal(r.report.passed,true);assert.equal(r.report.sessionRevoked,true);
  assert.equal(r.report.productionApproved,false);assert.equal(r.report.gameplayAuthorized,false);
  assert.equal(r.report.chainTransactionsSubmitted,0);assert.equal(r.audit.active,false);
  assert.equal(r.audit.logoutCount,1);assert.equal(r.audit.correctCleanupCookie,true);
});
for(const mode of ['missing','active','production-approved','held','stale','wrong-wallet','missing-classification','wrong-lifecycle']){
  test('canonical backing checker rejects '+mode+' proof and revokes its disposable session',()=>{
    const r=run(mode);assert.notEqual(r.status,0);
    assert.equal(r.report,null);assert.equal(r.audit.active,false);
    assert.equal(r.audit.logoutCount,1);assert.equal(r.audit.correctCleanupCookie,true);
  });
}
