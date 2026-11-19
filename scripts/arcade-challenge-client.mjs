// Browser transport and recovery for the isolated no-prize challenge.
// Game calculations and legal moves belong to the service, never this client.
const HEX = /^[a-f0-9]{64}$/;
const PILOT_TOKEN = /^pilot_[a-f0-9]{64}$/;
const ADDRESS = /^0x[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PILOT = /^[a-z0-9][a-z0-9-]{5,79}$/;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const flags = value => value?.mode === 'nonpaying-pilot' && value?.identityScope === 'wallet-session-only' && value.payable === false && value.prizeEligible === false && value.awardsEnabled === false;
const fault = (code, message, status = 0) => Object.assign(new Error(message), { code, status });
const badResponse = () => fault('invalid-response', 'The challenge returned an incomplete response. Refresh to recover your saved attempt.');

export function validArcadeSession(value, now = Date.now()) {
  return value?.version === 1 && HEX.test(value.token || '') && (!value.sessionScope || value.sessionScope === 'arcade') && ADDRESS.test(value.wallet || '') && validTime(value.expiresAt) && Date.parse(value.expiresAt) > now;
}

export function validPilotSession(value, now = Date.now(), origin) {
  if (value?.version !== 1 || !PILOT_TOKEN.test(value.token || '') || value.sessionScope !== 'challenge-pilot' || !ADDRESS.test(value.wallet || '') || !validTime(value.expiresAt) || Date.parse(value.expiresAt) <= now || typeof value.origin !== 'string') return false;
  try {
    const parsed = new URL(value.origin);
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.origin === value.origin && (!origin || value.origin === origin);
  } catch { return false; }
}

export function validatePilotConfiguration(value, pilotId) {
  const rules = value?.rules;
  if (value?.status !== 'ok' || !flags(value) || !HEX.test(value.rulesHash || '') || typeof value.pilotOpen !== 'boolean' || !validTime(value.serverNow) ||
      !flags(rules) || rules.schemaVersion !== 1 || rules.pilotId !== pilotId || rules.game?.id !== 'arborist-trials' ||
      rules.adapter?.id !== 'arborist-trials-portable-four-card' || rules.adapter.version !== '1.0.0' ||
      rules.access?.entry !== 'free' || rules.access.purchaseRequired !== false || rules.access.standardCards !== 4 || rules.access.paidAdvantages !== 'forbidden' ||
      !validTime(rules.window?.startsAt) || !validTime(rules.window?.endsAt) || Date.parse(rules.window.endsAt) <= Date.parse(rules.window.startsAt) ||
      !Number.isSafeInteger(rules.maxAttemptSeconds) || rules.maxAttemptSeconds < 60 || rules.maxAttemptSeconds > 3600) throw badResponse();
  return clone(value);
}

export function validatePilotState(value, pilotId, attemptId = null) {
  const view = value?.view;
  if (value?.status !== 'ok' || value.kind !== 'arcade-challenge-pilot-state' || !flags(value) || value.pilotId !== pilotId ||
      !UUID.test(value.attemptId || '') || (attemptId && value.attemptId !== attemptId) || !HEX.test(value.rulesHash || '') ||
      !Number.isSafeInteger(value.version) || value.version < 0 || value.version > 100 || !validTime(value.startedAt) || !validTime(value.expiresAt) || !validTime(value.serverNow) ||
      !['active', 'completed'].includes(value.attemptStatus) || !view || !['playing', 'won', 'lost', 'move-limit'].includes(view.phase) ||
      !['round', 'playerGrowth', 'botGrowth', 'targetGrowth', 'moveCount', 'maxMoves', 'remainingMoves'].every(key => Number.isFinite(view[key]) && view[key] >= 0) ||
      view.moveCount !== value.version || view.maxMoves !== 100 || !Array.isArray(view.cards) || view.cards.length !== 4 ||
      !view.cards.every(card => Number.isSafeInteger(card.id) && card.id >= 1 && card.id <= 30 && typeof card.name === 'string' && card.name.length <= 150 && typeof card.description === 'string' && card.description.length <= 2500 && typeof card.playable === 'boolean') ||
      new Set(view.cards.map(card => card.id)).size !== 4 || !Array.isArray(view.legalMoveIds) || view.legalMoveIds.some(id => !view.cards.some(card => card.id === id && card.playable)) ||
      !Array.isArray(view.lastRound) || view.lastRound.length > 10 ||
      (value.attemptStatus === 'completed' && (!flags(value.result) || !['won', 'lost', 'move-limit'].includes(view.phase))) ||
      (value.attemptStatus === 'active' && (value.result !== null || view.phase !== 'playing'))) throw badResponse();
  const safe = clone(value);
  delete safe.attemptToken;
  delete safe.challenge;
  return safe;
}

/** Storage contains only this tab's attempt and a hash of its original session. */
export function createPilotClient({ fetchImpl = globalThis.fetch?.bind(globalThis), storage, now = Date.now, cryptoImpl = globalThis.crypto, pilotId, origin, onChange = () => {}, requestTimeoutMs = 15000 } = {}) {
  if (!PILOT.test(pilotId || '')) throw Error('Choose a valid pilot ID.');
  const key = 'tree-arcade:challenge-pilot:v1:' + pilotId;
  let disposed = false, generation = 0, session = null, binding = null, record = null, saved = null, offset = 0;
  let storageAvailable = false;
  const requests = new Set();
  let state = { phase: 'loading', busy: false, notice: 'Loading the test challenge…', noticeKind: '', session: null, configuration: null, challenge: null, attempt: null, remainingSeconds: null, retryable: false, storageAvailable: false };
  try {
    const probe = key + ':probe'; storage.setItem(probe, '1'); storageAvailable = storage.getItem(probe) === '1'; storage.removeItem(probe);
    const raw = storage.getItem(key);
    if (raw && raw.length < 100000) {
      const candidate = JSON.parse(raw);
      if (candidate.schemaVersion === 1 && candidate.pilotId === pilotId && HEX.test(candidate.sessionBinding || '') && ADDRESS.test(candidate.wallet || '') && HEX.test(candidate.attemptToken || '') && UUID.test(candidate.attemptId || '') &&
          (!candidate.pending || (UUID.test(candidate.pending.requestId || '') && Number.isSafeInteger(candidate.pending.expectedVersion) && candidate.pending.expectedVersion >= 0 && candidate.pending.expectedVersion < 100 && Number.isSafeInteger(candidate.pending.moveId) && candidate.pending.moveId >= 1 && candidate.pending.moveId <= 30))) saved = candidate;
    }
  } catch { storageAvailable = false; }
  function emit() { if (!disposed) onChange(getState()); }
  function getState() { return clone({ ...state, storageAvailable, retryable: Boolean(record?.pending), canStart: Boolean(session && state.configuration?.pilotOpen && storageAvailable && !state.busy && !record?.pending && (!state.attempt || state.attempt.attemptStatus === 'completed' || state.phase === 'expired' || state.phase === 'session-changed')) }); }
  function update(patch) { state = { ...state, ...patch }; emit(); }
  function notice(message, kind = '') { update({ notice: message, noticeKind: kind }); }
  function persist(next) {
    if (!storageAvailable) throw fault('storage-unavailable', 'Allow tab storage to keep your attempt and recover interrupted moves.');
    try {
      const encoded = JSON.stringify(next);
      storage.setItem(key, encoded);
      if (storage.getItem(key) !== encoded) throw Error('storage');
      saved = clone(next); record = next;
    } catch { storageAvailable = false; throw fault('storage-unavailable', 'Your browser could not save this attempt. Allow tab storage, then reload before playing.'); }
  }
  function syncClock(serverNow, requestStarted) { if (validTime(serverNow)) offset = Date.parse(serverNow) - (requestStarted + now()) / 2; }
  function derivePhase() {
    if (!session) return 'signed-out';
    if (record?.pending) return 'pending';
    if (state.attempt?.attemptStatus === 'completed') return 'finished';
    if (state.attempt) return Date.parse(state.attempt.expiresAt) <= now() + offset ? 'expired' : state.configuration?.pilotOpen ? 'playing' : 'closed';
    if (saved && saved.sessionBinding !== binding) return 'session-changed';
    return state.configuration?.pilotOpen ? 'ready' : 'closed';
  }
  function tick() {
    if (disposed) return;
    if (session && Date.parse(session.expiresAt) <= now() + offset) {
      generation += 1; requests.forEach(controller => controller.abort()); session = null; binding = null;
      update({ session: null, phase: 'signed-out', busy: false, notice: 'Your sign-in expired. Sign in to the free pilot again to start a new attempt; an old attempt stays bound to its original session.', noticeKind: 'info' });
      return;
    }
    const remainingSeconds = state.attempt ? Math.max(0, Math.ceil((Date.parse(state.attempt.expiresAt) - now() - offset) / 1000)) : null;
    const expired = state.phase === 'playing' && remainingSeconds === 0;
    update({ remainingSeconds, ...(expired ? { phase: 'expired', notice: 'This attempt’s time has ended. You can start another while the pilot is open.', noticeKind: 'info' } : {}) });
  }
  async function request(action, body, ticket, { sync = true } = {}) {
    if (!session || ticket !== generation) throw fault('session-changed', 'Your sign-in session changed.');
    const controller = new AbortController(), started = now(); requests.add(controller);
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const query = new URLSearchParams({ action, ...(action === 'configuration' ? { pilotId } : {}) });
      const response = await fetchImpl('/api/arcade-challenge-pilot?' + query, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer ' + session.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
      const value = await response.json();
      if (ticket !== generation || disposed) throw fault('session-changed', 'Your sign-in session changed.');
      if (!response.ok || value.status !== 'ok') throw fault(typeof value.error === 'string' ? value.error : 'service-unavailable', typeof value.message === 'string' ? value.message : 'The challenge is temporarily unavailable.', response.status);
      if (sync) syncClock(value.serverNow, started);
      return value;
    } catch (error) {
      if (error.code) throw error;
      throw fault('connection-interrupted', 'The connection was interrupted. Your last move can be recovered safely.');
    } finally { clearTimeout(timer); requests.delete(controller); }
  }
  function fail(error, ticket, duringMove = false) {
    if (ticket !== generation || disposed) return;
    if (error.code === 'invalid-session') {
      session = null; binding = null;
      update({ session: null, phase: 'signed-out', notice: 'Your sign-in is no longer valid. Sign in to the free pilot again to start a new attempt.', noticeKind: 'info' });
    } else if (error.code === 'pilot-not-found') {
      update({ phase: 'closed', notice: 'This test challenge is not available yet. Check back from Campaigns.', noticeKind: 'info' });
    } else {
      update({ phase: duringMove && record?.pending ? 'pending' : 'error', notice: duringMove && record?.pending ? 'Your last move is waiting for confirmation. Choose “Retry the same move” to safely check it; no new card will be played.' : error.message, noticeKind: 'error' });
    }
  }
  function accept(value) {
    const attempt = validatePilotState(value, pilotId, record?.attemptId);
    if (state.attempt && attempt.version < state.attempt.version) throw badResponse();
    update({ attempt, challenge: record?.challenge ?? null });
    state.phase = derivePhase(); tick(); emit();
  }
  async function readStatus(ticket) {
    const value = await request('status', { attemptToken: record.attemptToken }, ticket);
    accept(value);
  }
  async function loadConfiguration(ticket) {
    const configuration = validatePilotConfiguration(await request('configuration', null, ticket), pilotId);
    update({ configuration });
    if (state.attempt) update({ phase: derivePhase() });
  }
  async function setSession(value) {
    const ticket = ++generation;
    requests.forEach(controller => controller.abort());
    session = validPilotSession(value, now(), origin) || validArcadeSession(value, now()) ? { ...value } : null;
    binding = null; record = null;
    update({ phase: session ? 'loading' : 'signed-out', session: session ? { wallet: session.wallet, walletName: session.walletName || 'Sui wallet', sessionScope: session.sessionScope || 'arcade' } : null, busy: Boolean(session), configuration: null, challenge: null, attempt: null, remainingSeconds: null, notice: session ? 'Restoring your challenge…' : 'Sign in to the free pilot with your Sui wallet. No NFTree, purchase or gas fee is required.', noticeKind: '' });
    if (!session) return;
    try {
      const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(session.token));
      if (ticket !== generation || disposed) return;
      binding = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (saved?.sessionBinding === binding && saved.wallet === session.wallet) record = clone(saved);
      await loadConfiguration(ticket);
      if (record?.pending) await submitPending(ticket);
      else if (record) await readStatus(ticket);
      else {
        update({ phase: derivePhase(), notice: saved ? 'Your sign-in has changed. The previous attempt belongs to the original session. You can start a fresh test.' : state.configuration.pilotOpen ? 'Ready to play. Choose a card each round to reach the Growth goal before the opponent.' : 'This test challenge is currently closed.', noticeKind: '' });
      }
    } catch (error) { fail(error, ticket, Boolean(record?.pending)); }
    finally { if (ticket === generation) { update({ busy: false }); tick(); } }
  }
  async function refresh() {
    if (state.busy || !session || disposed) return;
    const ticket = generation; update({ busy: true });
    try {
      if (record?.pending) await submitPending(ticket);
      else if (record) { await readStatus(ticket); await loadConfiguration(ticket); notice('Your saved attempt is up to date.'); }
      else { await loadConfiguration(ticket); update({ phase: derivePhase(), notice: state.configuration.pilotOpen ? 'The challenge is ready.' : 'This test challenge is currently closed.', noticeKind: '' }); }
    } catch (error) { fail(error, ticket, Boolean(record?.pending)); }
    finally { if (ticket === generation) { update({ busy: false }); tick(); } }
  }
  async function start() {
    if (!getState().canStart || disposed) return;
    const ticket = generation; update({ busy: true, notice: 'Dealing your four cards…', noticeKind: '' });
    try {
      const value = await request('start', { pilotId, expectedRulesHash: state.configuration.rulesHash }, ticket);
      validatePilotState(value, pilotId);
      if (!HEX.test(value.attemptToken || '') || value.challenge?.kind !== 'arborist-trial-no-prize-pilot' || value.challenge.fifthCardEnabled !== false || typeof value.challenge.title !== 'string') throw badResponse();
      persist({ schemaVersion: 1, pilotId, sessionBinding: binding, wallet: session.wallet, attemptToken: value.attemptToken, attemptId: value.attemptId, challenge: clone(value.challenge), pending: null });
      state.attempt = null; accept(value); notice('Your turn. Choose one of the available cards.');
    } catch (error) {
      if (error.code === 'rules-changed' || error.code === 'pilot-not-open') { try { await loadConfiguration(ticket); } catch {} }
      fail(error.code === 'connection-interrupted' ? fault(error.code, 'The start response was interrupted. Choose Start again to create a fresh attempt; any unreturned attempt will expire.') : error, ticket);
    } finally { if (ticket === generation) { update({ busy: false }); tick(); } }
  }
  async function submitPending(ticket) {
    if (!record?.pending) return;
    const pending = clone(record.pending);
    try {
      // A committed retry has the original timestamp; a fresh status read below
      // anchors the countdown to the current database time.
      const value = await request('move', { attemptToken: record.attemptToken, ...pending }, ticket, { sync: false });
      validatePilotState(value, pilotId, record.attemptId);
      persist({ ...record, pending: null });
      accept(value);
      await readStatus(ticket);
      notice(state.attempt.attemptStatus === 'completed' ? state.attempt.result.ruleTargetMet ? 'Challenge complete. Your test victory is saved. This pilot has no prizes.' : 'Attempt complete. Your result is saved. Try another hand while the pilot is open.' : 'Move confirmed. Choose your next card.');
    } catch (error) {
      if (['version-conflict', 'request-conflict', 'attempt-finished', 'attempt-expired', 'pilot-not-open', 'illegal-move'].includes(error.code)) {
        // A definitive rejection cannot append this move. Read authority before
        // clearing the pending request, including races with another tab.
        const value = await request('status', { attemptToken: record.attemptToken }, ticket);
        validatePilotState(value, pilotId, record.attemptId);
        persist({ ...record, pending: null }); accept(value);
        if (error.code === 'pilot-not-open' || error.code === 'attempt-expired') {
          await loadConfiguration(ticket);
          update({ phase: state.configuration.pilotOpen ? derivePhase() : 'closed' });
        }
        notice(error.code === 'version-conflict' ? 'Another tab updated this attempt. The current saved round is shown.' : error.message, 'info');
      } else throw error;
    }
  }
  async function move(moveId) {
    if (state.busy || !session || !record || record.pending || state.phase !== 'playing' || !state.attempt?.view.legalMoveIds.includes(moveId) || disposed) return;
    const ticket = generation; update({ busy: true });
    try {
      persist({ ...record, pending: { expectedVersion: state.attempt.version, requestId: cryptoImpl.randomUUID(), moveId } });
      update({ phase: 'pending', notice: 'Confirming your move…', noticeKind: '' });
      await submitPending(ticket);
    } catch (error) { fail(error, ticket, Boolean(record?.pending)); }
    finally { if (ticket === generation) { update({ busy: false }); tick(); } }
  }
  const retry = () => refresh();
  function destroy() { disposed = true; generation += 1; requests.forEach(controller => controller.abort()); requests.clear(); }
  return { setSession, refresh, start, move, retry, tick, getState, destroy };
}
