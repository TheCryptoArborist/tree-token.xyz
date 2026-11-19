// EXPLICIT LIVE CHECK ONLY. Creates one short-lived, no-prize test attempt using
// a fresh, unfunded operator wallet. Never reads a user's wallet or private key.
// The published page, wallet bridge, authentication and pilot endpoints run as-is.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'https://tree-token.xyz';
const PILOT_ID = 'arborist-trials-november-2026';
const PAGE_PATH = '/play/challenge/';
const PAGE_URL = ORIGIN + PAGE_PATH + '?pilot=' + PILOT_ID;
const WALLET_NAME = 'TREE pilot operator test';
const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_API_REQUESTS = 30;
const MAX_DISTINCT_MOVES = 3;
const FLAG = '--allow-live-no-prize-test';

class LiveCheckError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const check = (condition, code) => { if (!condition) throw new LiveCheckError(code); };
const noPrizes = value => value?.mode === 'nonpaying-pilot' && value?.identityScope === 'wallet-session-only' && value.payable === false && value.prizeEligible === false && value.awardsEnabled === false;
const exactKeys = (value, keys) => value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const safeFailure = error => error instanceof LiveCheckError ? error.code : error?.name === 'TimeoutError' ? 'browser-check-timeout' : 'unexpected-runtime-error';

function registerOperatorWallet({ address, publicKey, walletName }) {
  // This provider lives only in the test browser. Its private key stays in Node.
  // It has no transaction, execution, payment, or funded account feature.
  const connectionKey = 'tree-pilot:operator-test-provider:connected';
  const listeners = new Set();
  let connected = false;
  const account = Object.freeze({
    address, publicKey: new Uint8Array(publicKey),
    chains: Object.freeze(['sui:mainnet']),
    features: Object.freeze(['sui:signPersonalMessage']),
    label: 'Ephemeral no-prize operator test',
  });
  const emit = () => { for (const listener of listeners) listener({accounts:connected ? [account] : []}); };
  const wallet = Object.freeze({
    version:'1.0.0', name:walletName,
    icon:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" rx="8" fill="%231b382b"/%3E%3Cpath d="M16 26V9m0 8L9 11m7 10 8-8" fill="none" stroke="%23f5dfa1" stroke-width="3"/%3E%3C/svg%3E',
    chains:Object.freeze(['sui:mainnet']),
    get accounts() { return connected ? [account] : []; },
    features:Object.freeze({
      'standard:connect':Object.freeze({version:'1.0.0',async connect(input = {}) {
        if (input.silent && sessionStorage.getItem(connectionKey) !== '1') return {accounts:[]};
        connected = true; sessionStorage.setItem(connectionKey,'1'); emit(); return {accounts:[account]};
      }}),
      'standard:disconnect':Object.freeze({version:'1.0.0',async disconnect() {
        connected = false; sessionStorage.removeItem(connectionKey); emit();
      }}),
      'standard:events':Object.freeze({version:'1.0.0',on(event,listener) {
        if (event !== 'change' || typeof listener !== 'function') throw Error('Unsupported operator-test wallet event.');
        listeners.add(listener); return () => listeners.delete(listener);
      }}),
      'sui:signPersonalMessage':Object.freeze({version:'1.0.0',async signPersonalMessage(input) {
        if (!connected || input?.account?.address !== address || !(input.message instanceof Uint8Array)) throw Error('Invalid operator-test sign-in request.');
        return window.__treePilotOperatorSignMessage(Array.from(input.message));
      }}),
    }),
  });
  const register = api => api.register(wallet);
  window.addEventListener('wallet-standard:app-ready',event => register(event.detail));
  window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet',{detail:register}));
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('Usage: node scripts/arcade-campaigns/pilot-live-browser-check.mjs --allow-live-no-prize-test\nRequires ARCADE_PILOT_BROWSER_MODULE and the already pinned vendor/arcade-monthly dependencies. Creates one no-prize operator test attempt on the canonical site.\n');
    return;
  }
  check(args.length === 1 && args[0] === FLAG,'explicit-live-no-prize-flag-required');
  check(Boolean(process.env.ARCADE_PILOT_BROWSER_MODULE),'browser-module-required');
  const browserModule = process.env.ARCADE_PILOT_BROWSER_MODULE;
  const {chromium} = await import(browserModule.startsWith('file:') ? browserModule : pathToFileURL(path.resolve(browserModule)).href);
  const {Ed25519Keypair} = await import('../../vendor/arcade-monthly/node_modules/@mysten/sui/dist/keypairs/ed25519/index.mjs');
  const draft = JSON.parse(await fs.readFile(path.join(ROOT,'data/arcade-challenge-pilot-november-2026.json'),'utf8'));
  check(HEX.test(draft.rulesHash || '') && noPrizes(draft.rules) && draft.rules.pilotId === PILOT_ID,'reviewed-no-prize-config-required');

  const output = path.resolve(process.env.ARCADE_PILOT_LIVE_OUTPUT || path.join(ROOT,'.netlify/arcade-challenge-live-review'));
  await fs.mkdir(output,{recursive:true,mode:0o700});
  let keypair = Ed25519Keypair.generate();
  const walletAddress = keypair.toSuiAddress();
  const publicKey = Array.from(keypair.getPublicKey().toRawBytes());
  let browser, context, page;
  let challenge = null, signedSignature = null, sessionToken = null, signingCount = 0, authenticated = false, cleanupMode = false;
  let configuration = null, attemptToken = null, attemptId = null, latestState = null;
  let dropNextMove = false, droppedMove = null, retryObserved = false;
  let startCount = 0, sessionCount = 0, apiCount = 0, browserErrorCount = 0, halted = false;
  const distinctMoves = new Map();
  const apiTimes = [];
  const failures = new Set();
  const requestRecords = [];
  const requestIndex = new WeakMap();
  let rejectPolicy;
  const policyFailure = new Promise((resolve,reject) => { rejectPolicy = reject; });
  policyFailure.catch(() => {});
  const guard = promise => Promise.race([promise,policyFailure]);
  const rejectRun = error => {
    const code = safeFailure(error); failures.add(code); halted = true; rejectPolicy(new LiveCheckError(code));
  };
  const report = {
    kind:'arcade-challenge-pilot-canonical-browser-check',schemaVersion:1,
    startedAt:new Date().toISOString(),origin:ORIGIN,pilotId:PILOT_ID,passed:false,
    testIdentity:'Fresh unfunded ephemeral operator wallet; protocol/UI integration test, not a Slush extension test or a real player.',
    mode:'nonpaying-pilot',payable:false,prizeEligible:false,awardsEnabled:false,
    privateKeyLocation:'Node process memory only; never sent to the browser or written to an artifact.',
    limits:{maxApiRequests:MAX_API_REQUESTS,maxDistinctMoves:MAX_DISTINCT_MOVES,maxAttempts:1},
    checks:{},screenshots:[],cleanup:{sessionRevoked:false,attemptsExpireAutomatically:true},
  };

  function snapshotRequest(request) {
    let url;
    try { url = new URL(request.url()); } catch { return {method:request.method(),path:'[non-url-request]',action:null,status:null}; }
    const allowedPath = url.origin === ORIGIN && (
      [PAGE_PATH,'/api/arcade-growth','/api/arcade-challenge-pilot','/styles/arcade-challenge.css','/assets/tree-token-logo-official.webp','/assets/arcade/arcade-growth-wallet.js'].includes(url.pathname) || /^\/scripts\/arcade-challenge(?:-client|-view)?\.mjs$/.test(url.pathname)
    );
    return {method:request.method(),path:allowedPath ? url.pathname : url.origin === ORIGIN ? '[other-canonical-read]' : '[external-request]',action:['challenge','session','logout','configuration','start','status','move'].includes(url.searchParams.get('action')) ? url.searchParams.get('action') : null,status:null};
  }
  function validateConfiguration(value) {
    check(value?.status === 'ok' && noPrizes(value) && value.pilotOpen === true,'live-pilot-not-open-with-no-prize-flags');
    check(noPrizes(value.rules) && value.rules.pilotId === PILOT_ID && value.rulesHash === draft.rulesHash,'live-config-differs-from-reviewed-rules');
    check(value.rules.access?.entry === 'free' && value.rules.access.purchaseRequired === false && value.rules.access.paidAdvantages === 'forbidden' && value.rules.access.standardCards === 4,'live-config-has-unexpected-access-terms');
    configuration = value;
  }
  function validateState(value) {
    check(value?.status === 'ok' && value.kind === 'arcade-challenge-pilot-state' && noPrizes(value) && value.pilotId === PILOT_ID,'invalid-live-pilot-state');
    check(value.rulesHash === draft.rulesHash && Number.isSafeInteger(value.version) && value.version >= 0 && value.version <= MAX_DISTINCT_MOVES,'unexpected-live-state-version-or-rules');
    check(UUID.test(value.attemptId || '') && (!attemptId || value.attemptId === attemptId),'live-attempt-identity-changed');
    check(value.result === null || noPrizes(value.result),'live-result-has-prize-claim');
    check(value.view?.cards?.length === 4 && Array.isArray(value.view.legalMoveIds),'live-state-not-four-standard-cards');
    latestState = value;
  }
  function bodyOf(request) {
    try { return request.postDataJSON(); } catch { throw new LiveCheckError('unexpected-request-body'); }
  }

  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.ARCADE_PILOT_CHROME_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
    context = await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror',() => { browserErrorCount += 1; rejectRun(new LiveCheckError('uncaught-browser-error')); });
    page.on('request',request => {
      const entry = snapshotRequest(request); requestRecords.push(entry); requestIndex.set(request,entry);
    });
    page.on('response',response => { const entry = requestIndex.get(response.request()); if (entry) entry.status = response.status(); });
    page.on('requestfailed',request => { const entry = requestIndex.get(request); if (entry) entry.failed = true; });

    await page.exposeBinding('__treePilotOperatorSignMessage',async(source,values) => {
      check(source.page === page && source.frame === page.mainFrame() && new URL(source.frame.url()).origin === ORIGIN && new URL(source.frame.url()).pathname === PAGE_PATH,'signing-request-outside-canonical-page');
      check(signingCount === 0 && challenge && Date.parse(challenge.expiresAt) > Date.now(),'signing-request-without-current-server-challenge');
      check(Array.isArray(values) && values.length > 0 && values.length <= 8192 && values.every(value => Number.isInteger(value) && value >= 0 && value <= 255),'invalid-signing-byte-shape');
      const bytes = Uint8Array.from(values);
      check(Buffer.from(bytes).equals(Buffer.from(challenge.message,'utf8')),'signing-bytes-differ-from-captured-server-challenge');
      signingCount += 1;
      const signed = await keypair.signPersonalMessage(bytes);
      signedSignature = signed.signature;
      return {bytes:signed.bytes,signature:signed.signature};
    });
    await page.addInitScript(registerOperatorWallet,{address:walletAddress,publicKey,walletName:WALLET_NAME});

    await context.route('**/*',async route => {
      const request = route.request();
      try {
        const url = new URL(request.url());
        check(url.origin === ORIGIN,'noncanonical-network-request-blocked');
        const method = request.method(), action = url.searchParams.get('action');
        const api = url.pathname.startsWith('/api/');
        if (!api) {
          check(method === 'GET' || method === 'HEAD','non-api-write-blocked');
          return await route.continue();
        }
        apiCount += 1; apiTimes.push(Date.now());
        check(apiCount <= MAX_API_REQUESTS && apiTimes.filter(time => Date.now()-time < 60000).length <= MAX_API_REQUESTS,'api-request-budget-exceeded');
        check(!halted || cleanupMode && url.pathname === '/api/arcade-growth' && action === 'logout','request-after-failed-gate-blocked');
        check(request.frame() === page.mainFrame(),'api-request-from-unexpected-frame');
        let body = null;
        if (url.pathname === '/api/arcade-growth') {
          check(method === 'POST' && ['challenge','session','logout'].includes(action),'non-auth-growth-action-blocked');
          check([...url.searchParams.keys()].every(key => key === 'action'),'unexpected-auth-query-parameter');
          body = bodyOf(request);
          if (action === 'challenge') {
            check(!challenge && exactKeys(body,['wallet']) && body.wallet === walletAddress,'unexpected-auth-challenge-request');
          } else if (action === 'session') {
            check(sessionCount === 0 && signingCount === 1 && exactKeys(body,['wallet','challengeId','signature']) && body.wallet === walletAddress && body.challengeId === challenge?.challengeId && body.signature === signedSignature,'unexpected-auth-session-request');
          } else check(cleanupMode && exactKeys(body,[]) && request.headers().authorization === 'Bearer '+sessionToken,'unexpected-logout-request');
        } else if (url.pathname === '/api/arcade-challenge-pilot') {
          check(authenticated && request.headers().authorization === 'Bearer '+sessionToken,'pilot-request-without-issued-operator-session');
          check(['configuration','start','status','move'].includes(action),'unexpected-pilot-action');
          if (action === 'configuration') {
            check(method === 'GET' && url.searchParams.get('pilotId') === PILOT_ID && [...url.searchParams.keys()].every(key => ['action','pilotId'].includes(key)),'unexpected-configuration-request');
          } else {
            check(method === 'POST' && [...url.searchParams.keys()].every(key => key === 'action'),'unexpected-pilot-write-query');
            body = bodyOf(request);
            if (action === 'start') {
              check(configuration && noPrizes(configuration) && noPrizes(configuration.rules) && configuration.pilotOpen && authenticated,'start-before-real-auth-and-no-prize-review');
              check(startCount === 0 && exactKeys(body,['pilotId','expectedRulesHash']) && body.pilotId === PILOT_ID && body.expectedRulesHash === draft.rulesHash,'unexpected-start-request');
              startCount += 1;
            } else {
              check(attemptToken && body.attemptToken === attemptToken,'request-outside-operator-attempt');
              if (action === 'status') check(exactKeys(body,['attemptToken']),'unexpected-status-request');
              else {
                check(exactKeys(body,['attemptToken','expectedVersion','requestId','moveId']) && UUID.test(body.requestId || '') && Number.isInteger(body.expectedVersion) && body.expectedVersion >= 0 && body.expectedVersion < MAX_DISTINCT_MOVES && Number.isInteger(body.moveId) && body.moveId >= 1 && body.moveId <= 30,'unexpected-move-request');
                const previous = distinctMoves.get(body.requestId);
                if (previous) {
                  check(isDeepStrictEqual(previous,body) && droppedMove && body.requestId === droppedMove.body.requestId && !retryObserved,'changed-or-extra-retry-blocked');
                  retryObserved = true;
                } else {
                  check(distinctMoves.size < MAX_DISTINCT_MOVES,'move-budget-exceeded');
                  distinctMoves.set(body.requestId,body);
                }
              }
            }
          }
        } else throw new LiveCheckError('unrelated-api-request-blocked');

        const response = await route.fetch({maxRedirects:0,timeout:15000});
        const entry = requestIndex.get(request); if (entry) entry.status = response.status();
        check(response.status() === 200,'live-api-response-not-successful');
        const value = await response.json();
        check(value?.status === 'ok','live-api-result-not-successful');
        if (url.pathname === '/api/arcade-growth' && action === 'challenge') {
          const issued = value.challenge;
          check(issued?.wallet === walletAddress && typeof issued.challengeId === 'string' && issued.challengeId.length <= 300 && typeof issued.message === 'string' && issued.message.length > 0 && Buffer.byteLength(issued.message,'utf8') <= 8192 && Number.isFinite(Date.parse(issued.expiresAt)) && Date.parse(issued.expiresAt) > Date.now(),'invalid-issued-auth-challenge');
          challenge = issued;
        } else if (url.pathname === '/api/arcade-growth' && action === 'session') {
          check(value.session?.wallet === walletAddress && HEX.test(value.session.token || '') && Date.parse(value.session.expiresAt) > Date.now(),'invalid-real-session-response');
          sessionCount += 1; sessionToken = value.session.token; authenticated = true;
        } else if (url.pathname === '/api/arcade-growth' && action === 'logout') {
          authenticated = false; report.cleanup.sessionRevoked = true;
        } else if (action === 'configuration') validateConfiguration(value);
        else {
          validateState(value);
          if (action === 'start') {
            check(HEX.test(value.attemptToken || '') && value.version === 0,'invalid-new-operator-attempt');
            attemptToken = value.attemptToken; attemptId = value.attemptId;
          }
          if (action === 'move' && dropNextMove) {
            check(!droppedMove && value.version === 1,'unexpected-dropped-move-state');
            dropNextMove = false; droppedMove = {body,response:value};
            if (entry) entry.expectedInterruption = 'Response deliberately dropped after the real move committed.';
            await route.abort('connectionfailed'); return;
          }
          if (action === 'move' && droppedMove && body.requestId === droppedMove.body.requestId) {
            check(retryObserved && isDeepStrictEqual(value,droppedMove.response),'retry-did-not-return-original-committed-response');
          }
        }
        await route.fulfill({response});
      } catch (error) {
        rejectRun(error);
        try { await route.abort('blockedbyclient'); } catch {}
      }
    });

    const phase = wanted => guard(page.waitForFunction(expected => {
      const root = document.querySelector('#arcade-challenge');
      return root && expected.includes(root.dataset.phase) && root.getAttribute('aria-busy') !== 'true';
    },Array.isArray(wanted) ? wanted : [wanted],{timeout:30000}));
    const inspectLayout = async () => {
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'canonical-page-horizontal-overflow');
      check(await page.locator('img').evaluateAll(images => images.every(image => !image.getClientRects().length || image.complete && image.naturalWidth > 0)),'canonical-branded-image-failed');
    };
    const screenshot = async(width,label) => {
      await page.setViewportSize({width,height:1000}); await inspectLayout();
      const name = `pilot-canonical-${width}-${label}.png`;
      await page.screenshot({path:path.join(output,name),fullPage:true,mask:[page.locator('#challenge-session-heading')],maskColor:'#143b2c'});
      report.screenshots.push({file:name,width,phase:await page.locator('#arcade-challenge').getAttribute('data-phase'),identityMasked:true});
    };
    const clickLegalMove = async() => {
      const legal = page.locator('[data-move-id]:enabled').first();
      check(await legal.count() === 1,'no-legal-ui-card-available');
      await guard(legal.click());
    };

    await guard(page.goto(PAGE_URL,{waitUntil:'networkidle',timeout:30000}));
    check(page.url() === PAGE_URL,'canonical-page-redirected');
    await phase('signed-out');
    check(startCount === 0 && signingCount === 0,'load-caused-unauthorized-auth-or-start');
    check(/Test challenge\s*[—–-]\s*no prizes/i.test(await page.locator('body').innerText()),'visible-no-prize-label-missing');
    await guard(page.locator('#challenge-sign-in').click());
    await guard(page.getByRole('button',{name:WALLET_NAME,exact:true}).click());
    await phase('ready');
    check(signingCount === 1 && sessionCount === 1 && startCount === 0 && configuration,'explicit-real-personal-message-auth-failed');
    report.checks.realAuthentication = 'Published wallet bridge, one explicit provider connection, one exact server-issued personal-message signature, and the real session endpoint.';
    report.checks.signInHasNoAttendanceOrGameMutation = true;
    await screenshot(1440,'ready');

    await guard(page.locator('#challenge-start').click()); await phase('playing');
    check(startCount === 1 && latestState.version === 0,'explicit-start-did-not-create-one-empty-attempt');
    check(await page.locator('[data-move-id]').count() === 4,'canonical-ui-does-not-show-four-cards');
    report.checks.explicitStart = true;
    await screenshot(1440,'playing');
    await screenshot(390,'playing');

    dropNextMove = true;
    await clickLegalMove(); await phase('pending');
    check(droppedMove && latestState.version === 1 && distinctMoves.size === 1,'first-move-did-not-commit-before-response-drop');
    check(await page.locator('[data-move-id]:enabled').count() === 0,'pending-move-left-other-cards-enabled');
    await guard(page.locator('#challenge-retry').click()); await phase(['playing','finished']);
    check(retryObserved && distinctMoves.size === 1 && latestState.version === 1,'retry-appended-an-extra-move');
    report.checks.lostCommittedResponse = true;
    report.checks.identicalRetryAppendedOnce = true;

    const resumedId = latestState.attemptId;
    await guard(page.reload({waitUntil:'networkidle',timeout:30000})); await phase(['playing','finished']);
    check(startCount === 1 && sessionCount === 1 && signingCount === 1 && latestState.attemptId === resumedId && latestState.version === 1,'reload-did-not-resume-original-session-and-attempt');
    report.checks.reloadResumedWithoutNewSignature = true;
    while (latestState.attemptStatus === 'active' && latestState.version < MAX_DISTINCT_MOVES) {
      const before = latestState.version;
      await clickLegalMove(); await phase(['playing','finished']);
      check(latestState.version === before + 1,'legal-ui-move-did-not-append-once');
    }
    await screenshot(1440,'after-resume');
    await screenshot(390,'after-resume');
    check(browserErrorCount === 0 && failures.size === 0,'browser-or-network-policy-failed');
    report.checks.noUnrelatedWrites = true;
    report.checks.noFundedOrTransactionFeatures = true;
    report.checks.finalVersion = latestState.version;
    report.checks.finalAttemptStatus = latestState.attemptStatus;
    report.checks.finalPhase = latestState.view.phase;
    report.passed = true;
  } catch (error) {
    failures.add(safeFailure(error));
    report.passed = false;
  } finally {
    // Revoke only the real session created by this test; never use an injected
    // bearer or another player's storage. The one attempt expires naturally.
    if (authenticated && page && !page.isClosed()) {
      cleanupMode = true;
      try {
        const result = await page.evaluate(async({sessionKey,expectedWallet}) => {
          const raw = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey);
          const session = JSON.parse(raw || 'null');
          if (!session || session.wallet !== expectedWallet || !/^[a-f0-9]{64}$/.test(session.token || '')) return false;
          const response = await fetch('/api/arcade-growth?action=logout',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:'{}'});
          return response.ok;
        },{sessionKey:SESSION_KEY,expectedWallet:walletAddress});
        if (!result || !report.cleanup.sessionRevoked) { failures.add('operator-session-cleanup-failed'); report.passed = false; }
      } catch { failures.add('operator-session-cleanup-failed'); report.passed = false; }
    }
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    keypair = null;
    report.completedAt = new Date().toISOString();
    report.passed = report.passed && failures.size === 0;
    report.counts = {apiRequests:apiCount,explicitSignatures:signingCount,realSessions:sessionCount,attemptStarts:startCount,distinctMoves:distinctMoves.size,browserErrors:browserErrorCount};
    report.failures = [...failures];
    report.requests = requestRecords;
    const encoded = JSON.stringify(report,null,2) + '\n';
    check(!encoded.includes(walletAddress) && !/suiprivkey|Bearer\s|"signature"\s*:|"token"\s*:/i.test(encoded),'evidence-redaction-failed');
    await fs.writeFile(path.join(output,'pilot-canonical-browser-review.json'),encoded,{mode:0o600});
    process.stdout.write(JSON.stringify({passed:report.passed,kind:report.kind,counts:report.counts,failures:report.failures,evidenceDirectory:output})+'\n');
    if (!report.passed) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { process.stderr.write(JSON.stringify({passed:false,error:safeFailure(error)})+'\n'); process.exitCode = 1; });
}
