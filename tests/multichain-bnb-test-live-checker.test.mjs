import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const checkerURL=new URL('../scripts/check-bnb-test-auth-live.mjs',import.meta.url).href;
const coreURL=new URL('../scripts/multichain/bnb-game-access-core.mjs',import.meta.url).href;
const serviceURL=new URL('../scripts/multichain/bnb-test-auth-service.mjs',import.meta.url).href;
const TOKEN='bnbtest_'+'c3'.repeat(32);
const SOURCE='12'.repeat(20),CANDIDATE='synthetic-candidate';

// Import the actual command in an isolated process and directory. Every fetch
// is replaced before import; only the checker's disposable key signs offline.
// The audit contains booleans/action names, never cookies, signatures or keys.
function runChecker(mode){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bnb-live-checker-'));
  try{
    const source=`
      import {BNB_ORIGIN,BNB_IDENTITY_SCOPE,issueBnbChallenge} from ${JSON.stringify(coreURL)};
      import {COOKIE,PATH} from ${JSON.stringify(serviceURL)};
      const mode=${JSON.stringify(mode)},token=${JSON.stringify(TOKEN)};
      const expectedCookie=COOKIE+'='+token;
      const audit={actions:[],logoutCount:0,logoutCookieWasValid:true,active:false,signaturesWereSynthetic:true};
      let wallet=null,signInCount=0;
      process.on('exit',()=>console.log(JSON.stringify({testAudit:audit})));
      const response=(body,status=200,extra={})=>new Response(JSON.stringify({gameplayAuthorized:false,...body}),{
        status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}
      });
      globalThis.fetch=async(url,request)=>{
        if(url!==BNB_ORIGIN+PATH||request.method!=='POST')throw Error('Unexpected mocked endpoint');
        const fields=JSON.parse(request.body),headers=new Headers(request.headers);
        const action=fields.action;audit.actions.push(action);
        if(headers.get('Origin')!==BNB_ORIGIN)return response({error:'origin-denied'},403);
        if(action==='challenge'){
          const {record,message}=issueBnbChallenge({wallet:fields.wallet,nonce:'ab'.repeat(32)});
          wallet=record.address.toLowerCase();
          return response({wallet:record.address,nonce:record.nonce,message,scope:BNB_IDENTITY_SCOPE,
            chainId:56,expiresAt:record.expiresAt});
        }
        if(action==='sign-in'){
          signInCount++;
          audit.signaturesWereSynthetic&&=/^0x[a-f0-9]{130}$/i.test(fields.signature||'');
          if(signInCount>1)return response({error:'challenge-used'},403,
            mode==='replay-cookie'?{'Set-Cookie':expectedCookie+'; Path='+PATH}:{});
          const supplied=mode==='malformed-token'?token+'0':token;
          const attributes=['Path='+(mode==='wrong-case-path'?PATH.toUpperCase():PATH),'Secure','SameSite=Strict'];
          if(mode!=='missing-http-only')attributes.push('HttpOnly');
          const extra={'Set-Cookie':COOKIE+'='+supplied+'; '+attributes.join('; ')};
          if(mode==='bad-cache')extra['Cache-Control']=token;
          if(mode==='unexpected-cors')extra['Access-Control-Allow-Origin']=token;
          audit.active=mode!=='malformed-token';
          return response({authenticated:true,wallet,scope:BNB_IDENTITY_SCOPE,chainId:56},200,extra);
        }
        if(action==='logout'){
          audit.logoutCount++;
          audit.logoutCookieWasValid&&=headers.get('Cookie')===expectedCookie;
          if(headers.get('Cookie')!==expectedCookie)return response({error:'invalid-session'},401);
          audit.active=false;
          const expiration=mode==='bad-logout-header'&&audit.logoutCount===1
            ?expectedCookie+'; Path='+PATH+'; Max-Age=60'
            :COOKIE+'=; Path='+PATH+'; Max-Age=0; Secure; HttpOnly; SameSite=Strict';
          return response({signedOut:true},200,{'Set-Cookie':expiration});
        }
        if(action==='status'){
          if(!audit.active||headers.get('Cookie')!==expectedCookie)return response({error:'invalid-session'},401);
          return response({authenticated:true,wallet,scope:BNB_IDENTITY_SCOPE,chainId:56});
        }
        if(action==='entitlement')return response({reason:'production-backed-pass-not-enabled'},403);
        throw Error('Unexpected mocked action');
      };
      await import(${JSON.stringify(checkerURL)});
    `;
    const child=spawnSync(process.execPath,['--input-type=module','--eval',source],{
      cwd:dir,encoding:'utf8',timeout:15_000,
      env:{...process.env,REVIEWED_SHA:SOURCE,BNB_TEST_CANDIDATE_ID:CANDIDATE},
    });
    const output=(child.stdout||'')+(child.stderr||'');
    // Keep assertion diagnostics boolean, so a privacy regression itself never
    // prints the synthetic token or an unredacted child error to the test log.
    assert(!output.includes(TOKEN),'Checker output must not expose a session token');
    assert(!child.error,'The mocked checker subprocess must complete');
    assert(child.signal===null,'The mocked checker subprocess must not be terminated');
    const line=(child.stdout||'').split('\n').find(value=>value.startsWith('{"testAudit":'));
    assert(Boolean(line),'The mocked checker must produce its safe cleanup audit');
    const audit=JSON.parse(line).testAudit;
    const reportPath=path.join(dir,'.netlify/bnb-test-auth-live.json');
    const reportText=fs.existsSync(reportPath)?fs.readFileSync(reportPath,'utf8'):null;
    assert(!reportText?.includes(TOKEN),'Checker artifact must not expose a session token');
    return {status:child.status,audit,report:reportText?JSON.parse(reportText):null,output};
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

test('valid isolated cookie completes the real checker and revokes its mocked session',()=>{
  const result=runChecker('valid');
  assert.equal(result.status,0,'The normal mocked acceptance path must pass');
  assert.deepEqual(result.audit.actions,['status','status','challenge','sign-in','sign-in','status','entitlement','logout','status']);
  assert.equal(result.audit.logoutCount,1);assert.equal(result.audit.logoutCookieWasValid,true);
  assert.equal(result.audit.active,false);assert.equal(result.audit.signaturesWereSynthetic,true);
  assert.equal(result.report.passed,true);assert.equal(result.report.sessionRevoked,true);
  assert.equal(result.report.sourceCommit,SOURCE);assert.equal(result.report.deploymentId,CANDIDATE);
  assert.equal(result.report.syntheticUnfundedIdentity,true);assert.equal(result.report.userWalletUsed,false);
  assert.equal(result.report.chainTransactionsSubmitted,0);assert.equal(result.report.gameplayAuthorized,false);
});

for(const [mode,message,logoutCount] of [
  ['missing-http-only','Isolated session cookie is missing required attribute: HttpOnly',1],
  ['wrong-case-path','Isolated session cookie must use the exact isolated path',1],
  ['bad-cache','Live response must disable caching',1],
  ['unexpected-cors','Live response must not grant CORS',1],
  ['replay-cookie','Replayed challenge must not set a session cookie',1],
  ['bad-logout-header','Logout must expire the isolated session cookie',2],
])test(mode+': header validation failure still revokes the valid session without printing its token',()=>{
  const result=runChecker(mode);
  assert.notEqual(result.status,0,'Invalid response headers must fail acceptance');
  assert(result.output.includes(message),'The intended header validation must fail');
  assert.equal(result.audit.logoutCount,logoutCount);assert.equal(result.audit.logoutCookieWasValid,true);
  assert.equal(result.audit.active,false);assert.equal(result.audit.actions.at(-1),'logout');
  assert.equal(result.report,null,'A failed acceptance run must not write a passing report');
});

test('a token with a valid-looking prefix and trailing data is never captured for cleanup',()=>{
  const result=runChecker('malformed-token');
  assert.notEqual(result.status,0,'A malformed token must fail acceptance');
  assert(result.output.includes('Live sign-in must return a well-formed isolated session cookie'));
  assert.equal(result.audit.logoutCount,0,'Only a structurally valid token may be sent for cleanup');
  assert.equal(result.audit.actions.at(-1),'sign-in');assert.equal(result.report,null);
});
