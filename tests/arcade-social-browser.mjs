// Real Chromium layout checks; wallet and API responses are synthetic. No production requests.
import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const ROOT=resolve(import.meta.dirname,'..'),ORIGIN='https://tree-token.xyz';
const ACCOUNT = `0x${'a'.repeat(64)}`, OTHER = `0x${'b'.repeat(64)}`;
const VISITS = [1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 17];
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
const games = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
  { id: 'treeforce89', label: 'TREE FORCE ’89', href: 'https://tree-token.xyz/play/treeforce89/', creditRule: 'start-run' },
];
const configuration = { enabledGames: games, eligibleGames: games, todayPick: games[3] };
const goals = [{ id: 'seedling', label: 'Seedling', target: 3 }, { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 }, { id: 'full-canopy', label: 'Full Canopy', target: 21 }];
const cabinetLinks = { 'force-title': '/play/treeforce89/', 'arboretum-title': 'https://treegrow.xyz/',
  'deadfall-title': 'https://tree-token.xyz/play/deadfall-run/', 'canopy-title': 'https://tree-token.xyz/play/canopy-defense/preview/',
  'garden-bot-title': 'https://nftree.net/battle/garden-bot', 'pvp-title': 'https://nftree.net/battle/pvp',
  'trials-title': 'https://nftree.net/battle/trials', 'clash-title': 'https://nftree.net/battle/canopy-clash' };
function fixture(mode, monthKey = '2026-11', visits = VISITS) {
  const [year, month] = monthKey.split('-').map(Number), count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dateKey = `${monthKey}-18`, now = Date.parse(`${dateKey}T12:00:00Z`);
  const calendar = Array.from({ length: count }, (_, index) => ({ dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    checkedIn: visits.includes(index + 1), questCompleted: [3, 5].includes(index + 1),
    gameIds: index === 2 ? ['garden-bot'] : index === 4 ? ['arborist-trials'] : [] }));
  return { mode, monthKey, dateKey, now, account: ACCOUNT, other: OTHER, configuration, goals,
    progress: { wallet: ACCOUNT, monthKey, dateKey, calendar, checkedInDays: visits.length, questDays: 2,
      today: { checkedIn: visits.includes(18), questCompleted: false, gameIds: [] },
      milestones: goals.map(goal => ({ ...goal, earned: visits.length >= goal.target })),
      badges: goals.filter(goal => visits.length >= goal.target).map(goal => ({ id: goal.id, label: goal.label, monthKey, earnedAt: `${monthKey}-17T12:00:00Z` })),
      passport: { monthKey, enabledGames: games, completedGameIds: ['garden-bot', 'arborist-trials'], complete: false, optionalGames: [], optionalCompletedGameIds: [] } } };
}
function installFixture(data) {
  const calls = [], listeners = new Set(), memory = new Map();
  const authenticated = ['authenticated', 'milestone'].includes(data.mode);
  let walletState = (authenticated || data.mode === 'connected') ? { connected: true, address: data.account, walletName: 'Slush', walletId: 'Slush' }
    : { connected: false, address: null, walletName: null };
  let progress = structuredClone(data.progress);
  const key = 'tree-arcade:daily-growth:session:v1';
  if (authenticated) memory.set(key, JSON.stringify({ version: 1, wallet: data.account, walletId: 'Slush', walletName: 'Slush',
    token: 'synthetic-quest-layout-session', expiresAt: new Date(data.now + 3600000).toISOString() }));
  const forbidden = action => { calls.push({ type: 'forbidden-wallet-action', action }); throw new Error(`Real wallet action forbidden: ${action}`); };
  const wallet = { getWalletState: () => walletState, getAvailableWallets: () => [], connectWallet: () => forbidden('connect'),
    restoreWallet: () => forbidden('restore'), disconnectWallet: () => forbidden('disconnect'), signPersonalMessage: () => forbidden('sign'),
    subscribeWalletState(listener) { listeners.add(listener); queueMicrotask(() => listener(walletState)); return () => listeners.delete(listener); }, subscribeWallets() { return () => {}; } };
  const controls = { calls, failStatus: false, failSync: false, holdStatus: data.mode === 'loading', holdCheckIn: false,
    releaseStatus: null, releaseCheckIn: null, count: action => calls.filter(call => call.action === action).length,
    accountChange() { walletState = { connected: true, address: data.other, walletName: 'Slush', walletId: 'Slush' }; for (const listener of listeners) listener(walletState); } };
  async function fetchImpl(url, init) {
    if (url === '/api/arcade-social') {
      controls.socialEntries ||= [];
      if (init.method === 'POST') { const value=JSON.parse(init.body); controls.socialEntries.push({mission:value.mission,proof:value.proof,status:value.mission==='community-vote'?'completed':'pending'}); }
      return Response.json({status:'ok',wallet:data.account,entries:controls.socialEntries,monthlyStamps:controls.socialEntries.filter(e=>e.status==='completed').length,resetsAt:'2026-11-23T00:00:00Z'});
    }
    const action = new URL(url, location.href).searchParams.get('action');
    calls.push({ type: 'api', action, method: init.method, synthetic: true, transport: 'in-memory fixture; no network' });
    if (!['status', 'sync', 'check-in', 'logout'].includes(action)) throw new Error(`Unexpected fixture action: ${action}`);
    if (action === 'status' && controls.holdStatus) await new Promise(done => { controls.releaseStatus = done; });
    if (action === 'check-in' && controls.holdCheckIn) await new Promise(done => { controls.releaseCheckIn = done; });
    if ((action === 'status' && controls.failStatus) || (action === 'sync' && controls.failSync)) {
      return { ok: false, status: 503, json: async () => ({ status: 'error', error: 'service-unavailable', message: 'Synthetic unavailable response. Saved progress has not changed.' }) };
    }
    if (action === 'check-in') {
      progress.calendar.find(day => day.dateKey === data.dateKey).checkedIn = true;
      progress.today.checkedIn = true;
      progress.checkedInDays = progress.calendar.filter(day => day.checkedIn).length;
      progress.milestones = data.goals.map(goal => ({ ...goal, earned: progress.checkedInDays >= goal.target }));
      progress.badges = progress.milestones.filter(goal => goal.earned).map(goal => ({ id: goal.id, label: goal.label, monthKey: data.monthKey, earnedAt: new Date(data.now).toISOString() }));
    }
    const authenticated = Boolean(init.headers.Authorization) && action !== 'logout';
    const payload = action === 'logout' ? { status: 'ok' } : { status: 'ok', authenticated, serverTime: new Date(data.now).toISOString(),
      dateKey: data.dateKey, monthKey: data.monthKey, configuration: data.configuration,
      ...(authenticated ? { progress: structuredClone(progress) } : {}),
      ...(action === 'sync' ? { sync: { checkedAt: new Date(data.now).toISOString(), games: data.configuration.eligibleGames.map(game => ({ gameId: game.id, status: 'no-result' })) } } : {}) };
    return { ok: true, status: 200, json: async () => payload };
  }
  controls.options = { fetchImpl, loadWallet: async () => wallet, now: () => data.now,
    storage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } };
  window.__questLayoutFixture = controls;
}


const browser=await chromium.launch({executablePath:process.env.ARCADE_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const out='/tmp/arcade-missions-review';await mkdir(out,{recursive:true});
try {
 for(const width of [1440,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(installFixture,fixture('authenticated'));
  const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,ORIGIN);assert.equal(route.request().method(),'GET');
   const pathname=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
   if(pathname==='/scripts/arcade-nftree-access.js') return route.fulfill({status:200,contentType:'text/javascript',body:''});
   const path=resolve(ROOT,'.'+pathname);assert(path.startsWith(ROOT+sep));
   let content;try{content=await readFile(path)}catch{ return route.fulfill({status:404,body:''}); }
   if(pathname==='/scripts/arcade-daily-growth.js') content=content.toString().replace('createDailyGrowth({ root });','window.__missionController=createDailyGrowth({ root, ...window.__questLayoutFixture.options });');
   const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
   await route.fulfill({status:200,contentType:types[extname(path)]||'application/octet-stream',body:content});
  });
  await page.goto(ORIGIN+'/play/');await page.evaluate(()=>window.__missionController.ready);
  await page.locator('#growth-invitation-open').click();
  await page.locator('#growth-community-tab').click();
  await page.waitForFunction(()=>document.querySelector('#missions-status').textContent.includes('up to date'));
  await page.locator('#mission-vote').selectOption('treeforce89');
  await page.locator('[data-mission="community-vote"] button').click();
  await page.waitForFunction(()=>document.querySelector('[data-mission="community-vote"] .mission-state').textContent.includes('Completed'));
  assert.equal(await page.locator('[data-mission="share-score"] .mission-state').textContent(),'Ready to start');
  await page.locator('#mission-score-proof').fill('https://x.com/player/status/123');await page.locator('[data-mission="share-score"] button').click();
  await page.waitForFunction(()=>document.querySelector('[data-mission="share-score"] .mission-state').textContent.includes('Pending'));
  await page.locator('#growth-community-panel').screenshot({path:`${out}/community-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  await page.locator('#growth-events-tab').click();assert(await page.locator('#growth-events-panel').isVisible());
  await page.locator('#growth-events-tab').press('ArrowLeft');assert.equal(await page.locator('#growth-community-tab').getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px: tabs, vote, pending proof, keyboard navigation, no overflow or JS errors`);
 }
} finally {await browser.close();}
