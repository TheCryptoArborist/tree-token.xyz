// LOCAL TEST HARNESS ONLY. Never publish this file, fixture routes or synthetic
// wallet bridge. The production handler's canonical-origin boundary is intact.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServiceFixture, ORIGIN, RAW_TOKEN, WALLET, hash } from '../../tests/fixtures/arcade-challenge-pilot/service-fixture.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const CLIENT_FILES = new Set([
  '/scripts/arcade-challenge.mjs', '/scripts/arcade-challenge-client.mjs',
  '/scripts/arcade-challenge-view.mjs', '/styles/arcade-challenge.css',
]);
const mime = file => ({ '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }[path.extname(file)] ?? 'application/octet-stream');

function bridgeSource() {
  return `// Synthetic wallet for this loopback-only test harness. No real signing.
const wallet={id:'fixture-wallet',name:'Local test wallet'};
let state={connected:false,address:null,walletId:null,walletName:null};
const listeners=new Set();const emit=()=>{for(const fn of listeners)fn({...state});};
export const getWalletState=()=>({...state});
export const getAvailableWallets=()=>[wallet];
export const subscribeWalletState=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const subscribeWallets=()=>()=>{};
export async function connectWallet(id){if(id!==wallet.id)throw Error('Unknown local test wallet.');state={connected:true,address:'${WALLET}',walletId:wallet.id,walletName:wallet.name};emit();return {...state};}
export async function restoreWallet({id,address}){if(address!=='${WALLET}')return null;return connectWallet(id);}
export async function signPersonalMessage({message}){if(!state.connected||!(message instanceof Uint8Array))throw Error('Invalid local test sign-in.');return {signature:'LOCAL_FIXTURE_SIGNATURE'};}
export async function disconnectWallet(){state={connected:false,address:null,walletId:null,walletName:null};emit();}
`;
}

/** Isolated actual service + SQL + engine, with synthetic authentication only. */
export async function startPilotPreviewServer({ port = 0, fixtureOptions = {} } = {}) {
  const issuedMessages = new Set();
  const fixture = await createServiceFixture({ ...fixtureOptions, handlerDependencies: {
    ...fixtureOptions.handlerDependencies,
    // A synthetic wallet remains explicit in this local-only fixture. The real
    // challenge, single-use nonce and pilot-session SQL all run through the
    // production handler; only signature verification is injected here.
    verifyPersonalMessage: async ({ message, signature, wallet }) => wallet === WALLET && signature === 'LOCAL_FIXTURE_SIGNATURE' && issuedMessages.has(message),
  } });
  let dropNextMove = false, failNextMove = false, closed = false;
  const log = [];
  let authSession = { token: RAW_TOKEN, expiresAt: fixture.session.expiresAt, origin: ORIGIN, sessionScope: 'arcade' };
  const session = () => ({ version: 1, ...authSession, wallet: WALLET, walletId: 'fixture-wallet', walletName: 'Local test wallet' });
  const send = (res, status, value, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
  };
  const readBody = async req => {
    let size = 0; const parts = [];
    for await (const chunk of req) { size += chunk.length; if (size > 65536) throw Error('Local request too large.'); parts.push(chunk); }
    return Buffer.concat(parts).toString('utf8');
  };
  const server = http.createServer(async (req, res) => {
    try {
      const localOrigin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(localOrigin).host) return send(res, 403, { error: 'loopback-host-only' });
      const url = new URL(req.url, localOrigin);
      if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== localOrigin) return send(res, 403, { error: 'local-origin-only' });
      if (url.pathname === '/__fixture/info' && req.method === 'GET') return send(res, 200, { localOnly: true, pilotId: fixture.rules.pilotId, session: session() });
      if (url.pathname === '/__fixture/control' && req.method === 'POST') {
        const { action } = JSON.parse(await readBody(req));
        if (action === 'drop-next-move-response') dropNextMove = true;
        else if (action === 'fail-next-move') failNextMove = true;
        else if (action === 'disable-pilot') await fixture.db.query("update private.arcade_challenge_pilot_configs set status='disabled' where pilot_id=$1", [fixture.rules.pilotId]);
        else if (action === 'revoke-session') {
          const table = authSession.sessionScope === 'challenge-pilot' ? 'arcade_challenge_pilot_sessions' : 'arcade_growth_sessions';
          await fixture.db.query(`update private.${table} set revoked_at=clock_timestamp() where token_sha256=$1`, [hash(authSession.token)]);
        }
        else if (action === 'new-session') {
          const pilot = authSession.sessionScope === 'challenge-pilot';
          const next = await (pilot ? fixture.addPilotSession({ rawToken: 'pilot_' + 'c'.repeat(64) }) : fixture.addSession({ rawToken: 'c'.repeat(64) }));
          authSession = { token: next.rawToken, expiresAt: next.expiresAt, origin: localOrigin, sessionScope: pilot ? 'challenge-pilot' : 'arcade' };
          return send(res, 200, { session: session() });
        } else return send(res, 400, { error: 'unknown-fixture-action' });
        return send(res, 200, { localOnly: true, action });
      }
      if (url.pathname === '/__fixture/inspection' && req.method === 'GET') {
        const rows = await fixture.db.query('select version,status,moves from private.arcade_challenge_pilot_attempts order by started_at');
        const arcadeSessions = (await fixture.db.query('select count(*)::int as n from private.arcade_growth_sessions')).rows[0].n;
        const pilotSessions = (await fixture.db.query('select count(*)::int as n from private.arcade_challenge_pilot_sessions')).rows[0].n;
        return send(res, 200, { attempts: rows.rows, requestCount: await fixture.count('requests'), arcadeSessions, pilotSessions, log });
      }
      if (url.pathname === '/assets/arcade/arcade-growth-wallet.js' && req.method === 'GET') return send(res, 200, bridgeSource(), 'text/javascript; charset=utf-8');
      if (url.pathname === '/api/arcade-growth') return send(res, 403, { status: 'error', error: 'nft-required', message: 'The existing Arcade gate is deliberately unavailable in this free-pilot fixture.' });
      if (url.pathname === '/api/arcade-challenge-pilot') {
        const raw = req.method === 'GET' ? undefined : await readBody(req);
        const action = url.searchParams.get('action');
        const body = raw ? JSON.parse(raw) : null;
        log.push({ action, ...(action === 'move' ? { requestId: body.requestId, expectedVersion: body.expectedVersion, moveId: body.moveId } : {}) });
        if (action === 'move' && failNextMove) { failNextMove = false; return send(res, 503, { status: 'error', error: 'service-unavailable', message: 'Deliberate local test interruption.' }); }
        // Local synthetic sessions are canonical-origin fixtures. This adapter
        // exists only here; production code never accepts localhost as origin.
        const headers = new Headers({ 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin' });
        if (req.headers.authorization) headers.set('authorization', req.headers.authorization);
        const response = await fixture.handler(new Request(ORIGIN + url.pathname + url.search, { method: req.method, headers, ...(raw === undefined ? {} : { body: raw }) }));
        if (action === 'move' && dropNextMove && response.ok) { dropNextMove = false; req.socket.destroy(); return; }
        if (['auth-challenge', 'auth-session'].includes(action) && response.ok) {
          const value = await response.json();
          // The production handler remains restricted to canonical origins.
          // Only this loopback adapter maps its public origin field back to the
          // actual fixture page; the exact issued message is never rewritten.
          if (action === 'auth-challenge') { issuedMessages.add(value.challenge.message); value.challenge.origin = localOrigin; }
          else { value.session.origin = localOrigin; authSession = value.session; }
          return send(res, response.status, value);
        }
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (req.method !== 'GET') return send(res, 405, { error: 'method-not-allowed' });
      if (['/', '/play/challenge/', '/play/challenge/index.html'].includes(url.pathname)) {
        let html = await fs.readFile(path.join(ROOT, 'production/arcade-challenge-static/index.html'), 'utf8');
        html = html.replace(/data-pilot-id="[^"]*"/g, `data-pilot-id="${fixture.rules.pilotId}"`);
        const marker = `<p style="margin:0;padding:8px 16px;background:#ffe263;color:#071710;font:700 13px system-ui;text-align:center">LOCAL TEST · Synthetic wallet · No production data, prizes or transactions</p>`;
        const init = `<script>if(!sessionStorage.getItem('tree-pilot-fixture-initialized')){sessionStorage.setItem('tree-pilot-fixture-initialized','1');${url.searchParams.get('fixture') === 'signed-out' ? '' : `localStorage.setItem(${JSON.stringify(SESSION_KEY)},${JSON.stringify(JSON.stringify(session()))});`}}</script>`;
        html = html.replace(/<body([^>]*)>/, `<body$1>${marker}${init}`);
        return send(res, 200, html, 'text/html; charset=utf-8');
      }
      const clean = decodeURIComponent(url.pathname);
      if (clean.includes('..') || clean.includes('\\')) return send(res, 404, { error: 'not-found' });
      let candidates = [];
      if (CLIENT_FILES.has(clean)) candidates = [path.join(ROOT, clean)];
      else if (/^\/assets\/[a-zA-Z0-9/_ .-]+\.(?:png|webp|jpe?g|svg|ico|woff2)$/.test(clean)) candidates = [path.join(ROOT, clean), path.join(ROOT, 'production/arcade-organization-static/runtime', clean)];
      for (const file of candidates) {
        try { const data = await fs.readFile(file); return send(res, 200, data, mime(file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      return send(res, 404, { error: 'not-found' });
    } catch (error) { if (!res.headersSent) send(res, 500, { error: 'local-harness-error', message: error.message }); else res.destroy(); }
  });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  catch (error) { await fixture.close(); throw error; }
  return {
    url: `http://127.0.0.1:${server.address().port}/play/challenge/?pilot=${fixture.rules.pilotId}`,
    origin: `http://127.0.0.1:${server.address().port}`, fixture,
    close: async () => { if (closed) return; closed = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fixture.close(); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const instance = await startPilotPreviewServer({ port: Number(process.env.ARCADE_PILOT_PREVIEW_PORT || 4317) });
  process.stdout.write(JSON.stringify({ localOnly: true, url: instance.url, note: 'Synthetic wallet; no production requests or transactions.' }) + '\n');
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => { await instance.close(); process.exit(0); });
}
