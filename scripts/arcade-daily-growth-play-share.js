import { createQuestCampaigns } from './arcade-quest-campaigns-guided.js';
import { createArcadeMissions } from './arcade-social-play-share.js';
// Daily Growth has its own message-only wallet session. Opening a game link never grants credit.
const API_PATH = '/api/arcade-growth';
const WALLET_MODULE = '/assets/arcade/arcade-growth-wallet.js';
const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const AUTH_ERRORS = new Set(['authentication-required', 'invalid-session', 'expired-session']);
const TREE_FORCE_ID = 'treeforce89';
// Presentation aliases only. Server badge IDs, attendance goals, and saved awards stay unchanged.
const MONTHLY_RANK_PRESENTATION = {
  seedling: { label: 'TREE Spark', ordinal: '01', flavor: 'The first spark of your TREE story.', art: '/assets/arcade-growth/tree-spark.webp' },
  sapling: { label: 'NFTree Scout', ordinal: '02', flavor: 'Explore the grove. Make your mark.', art: '/assets/arcade-growth/nftree-scout.webp' },
  'deep-roots': { label: 'TREE FORCE Vanguard', ordinal: '03', flavor: 'Stand watch over the canopy.', art: '/assets/arcade-growth/tree-force-vanguard.webp' },
  'full-canopy': { label: 'Thickquidity Legend', ordinal: '04', flavor: 'A month of showing up for TREE.', art: '/assets/arcade-growth/thickquidity-legend.webp' },
};
// These preview labels describe existing goals, never a player's earned progress.
const MILESTONE_GOALS = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
];
// Monthly collection artwork and existing game posters have separate presentation roles.
const GROWTH_ART = {
  seedling: MONTHLY_RANK_PRESENTATION.seedling.art,
  sapling: MONTHLY_RANK_PRESENTATION.sapling.art,
  'deep-roots': MONTHLY_RANK_PRESENTATION['deep-roots'].art,
  'full-canopy': MONTHLY_RANK_PRESENTATION['full-canopy'].art,
  unknown: '/assets/tree-command-logo-v2-512.png',
  'arcade-passport': '/assets/tree-command-logo-v2-512.png',
  'garden-bot': '/assets/arcade/garden-bot-poster.webp',
  pvp: '/assets/arcade/pvp-battle-poster.webp',
  'arborist-trials': '/assets/arcade/arborist-trials-poster.webp',
  treeforce89: '/assets/arcade/tree-force-89-poster.webp',
};
const GAME_COPY = {
  [TREE_FORCE_ID]: {
    objective: 'Start a run and reach the first wave. You do not need to win or finish.',
    access: 'NFTree held directly in your wallet required · Kiosk-held NFTrees are not supported by this game',
  },
  'garden-bot': {
    objective: 'Finish one official battle. Win or lose, it counts.',
    access: 'Official battle required · Network gas applies',
  },
  pvp: {
    objective: 'Finish one match against another player. Win or lose, it counts.',
    access: 'Paid entry · Live opponent needed · Optional for daily attendance',
  },
  'arborist-trials': {
    objective: 'Finish an official Trial and save the result. Win or lose, it counts.',
    access: 'No paid entry · Save with a wallet message · Unsaved practice does not count',
  },
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyPattern = /^\d{4}-\d{2}$/;
const normalizedAddress = (value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : null;
const timestamp = (value) => typeof value === 'number' ? value : Date.parse(value);
const shortAddress = (address) => `${address.slice(0, 8)}…${address.slice(-6)}`;
const text = (value, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max;
const monthLabel = (key) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`));
const dateLabel = (key) => new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

function badgePresentation(badge) {
  const id = typeof badge?.id === 'string' ? badge.id.replace(/^\d{4}-(?:0[1-9]|1[0-2])-/, '') : '';
  if (Object.hasOwn(MONTHLY_RANK_PRESENTATION, id)) return { id, ...MONTHLY_RANK_PRESENTATION[id] };
  // Preserve labels for other awards; an unfamiliar badge is never presented as an earned TREE rank.
  return { id: id === 'arcade-passport' ? id : 'unknown', label: badge?.label || 'Monthly badges',
    ordinal: '', flavor: '', art: GROWTH_ART.unknown };
}

function invalidData() {
  const error = new Error('Daily Growth returned incomplete progress. Your saved progress has not been changed. Try refreshing.');
  error.code = 'invalid-response';
  return error;
}

function gameDescriptor(game) {
  if (!game || !/^[a-z][a-z0-9-]{0,63}$/.test(game.id) || !text(game.label, 80) || !text(game.href, 2048)) throw invalidData();
  const url = new URL(game.href, 'https://tree-token.xyz');
  if (url.protocol !== 'https:' || url.username || url.password) throw invalidData();
  const creditRule = game.creditRule || (game.id === TREE_FORCE_ID ? 'start-run' : 'complete-result');
  if (!['start-run', 'complete-result'].includes(creditRule)) throw invalidData();
  return { id: game.id, label: game.label, href: url.href, creditRule };
}

function uniqueStrings(values) {
  if (!Array.isArray(values) || values.length > 100 || values.some((value) => !text(value, 100)) || new Set(values).size !== values.length) throw invalidData();
  return [...values];
}

function normalizeConfiguration(value) {
  if (!value || !Array.isArray(value.enabledGames) || value.enabledGames.length > 30) throw invalidData();
  const enabledGames = value.enabledGames.map(gameDescriptor);
  if (new Set(enabledGames.map((game) => game.id)).size !== enabledGames.length) throw invalidData();
  const eligible = value.eligibleGames ?? value.enabledGames;
  if (!Array.isArray(eligible) || eligible.length > 30) throw invalidData();
  const eligibleGames = eligible.map(gameDescriptor);
  if (new Set(eligibleGames.map((game) => game.id)).size !== eligibleGames.length) throw invalidData();
  const todayPick = value.todayPick ? gameDescriptor(value.todayPick) : null;
  if (todayPick && !eligibleGames.some((game) => game.id === todayPick.id)) throw invalidData();
  return { enabledGames, eligibleGames, todayPick };
}

function normalizeProgress(value, expectedWallet) {
  if (!value || normalizedAddress(value.wallet) !== expectedWallet || !monthKeyPattern.test(value.monthKey) || !dateKeyPattern.test(value.dateKey) || !value.dateKey.startsWith(`${value.monthKey}-`)) throw invalidData();
  const [year, month] = value.monthKey.split('-').map(Number);
  if (month < 1 || month > 12 || year < 2020 || year > 2100) throw invalidData();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!Array.isArray(value.calendar) || value.calendar.length !== days) throw invalidData();
  const calendar = value.calendar.map((day) => {
    if (!dateKeyPattern.test(day?.dateKey) || !day.dateKey.startsWith(`${value.monthKey}-`) || typeof day.checkedIn !== 'boolean' || typeof day.questCompleted !== 'boolean') throw invalidData();
    if (Number(day.dateKey.slice(-2)) < 1 || Number(day.dateKey.slice(-2)) > days || (day.questCompleted && !day.checkedIn)) throw invalidData();
    return { dateKey: day.dateKey, checkedIn: day.checkedIn, questCompleted: day.questCompleted, gameIds: uniqueStrings(day.gameIds) };
  }).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (new Set(calendar.map((day) => day.dateKey)).size !== days) throw invalidData();
  const today = calendar.find((day) => day.dateKey === value.dateKey);
  if (!today || !value.today || today.checkedIn !== value.today.checkedIn || today.questCompleted !== value.today.questCompleted) throw invalidData();
  if (value.checkedInDays !== calendar.filter((day) => day.checkedIn).length || value.questDays !== calendar.filter((day) => day.questCompleted).length) throw invalidData();
  if (!value.passport || value.passport.monthKey !== value.monthKey || !Array.isArray(value.passport.enabledGames) || typeof value.passport.complete !== 'boolean') throw invalidData();
  const enabledGames = value.passport.enabledGames.map(gameDescriptor);
  const completedGameIds = uniqueStrings(value.passport.completedGameIds);
  if (new Set(enabledGames.map((game) => game.id)).size !== enabledGames.length || completedGameIds.some((id) => !enabledGames.some((game) => game.id === id))) throw invalidData();
  if (value.passport.complete && completedGameIds.length !== enabledGames.length) throw invalidData();
  if (value.passport.optionalGames !== undefined && !Array.isArray(value.passport.optionalGames)) throw invalidData();
  const optionalGames = (value.passport.optionalGames || []).map(gameDescriptor);
  const optionalCompletedGameIds = uniqueStrings(value.passport.optionalCompletedGameIds ?? []);
  if (new Set(optionalGames.map((game) => game.id)).size !== optionalGames.length || optionalGames.some((game) => enabledGames.some((required) => required.id === game.id)) || optionalCompletedGameIds.some((id) => !optionalGames.some((game) => game.id === id))) throw invalidData();
  if (!Array.isArray(value.milestones) || value.milestones.some((item) => !text(item.id, 100) || !text(item.label, 100) || !Number.isInteger(item.target) || item.target < 1 || item.target > 31 || typeof item.earned !== 'boolean')) throw invalidData();
  if (!Array.isArray(value.badges) || value.badges.some((badge) => !text(badge.id, 150) || !text(badge.label, 150) || !monthKeyPattern.test(badge.monthKey) || !Number.isFinite(timestamp(badge.earnedAt)))) throw invalidData();
  return {
    wallet: expectedWallet, monthKey: value.monthKey, dateKey: value.dateKey, calendar,
    checkedInDays: value.checkedInDays, questDays: value.questDays,
    today: { checkedIn: today.checkedIn, questCompleted: today.questCompleted, gameIds: uniqueStrings(value.today.gameIds) },
    passport: { monthKey: value.monthKey, enabledGames, completedGameIds, optionalGames, optionalCompletedGameIds, complete: value.passport.complete },
    milestones: value.milestones.map((item) => ({ ...item })), badges: value.badges.map((badge) => ({ ...badge })),
  };
}

function readSession(storage, now) {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw || raw.length > 12000) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !text(value.token, 8192) || !normalizedAddress(value.wallet) || timestamp(value.expiresAt) <= now || !Number.isFinite(timestamp(value.expiresAt))) throw new Error('Expired session');
    return { ...value, wallet: normalizedAddress(value.wallet) };
  } catch {
    try { storage?.removeItem(SESSION_KEY); } catch { /* A memory-only session is still supported. */ }
    return null;
  }
}

export function createDailyGrowth({
  root,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  loadWallet = () => import(WALLET_MODULE),
  storage,
  now = () => Date.now(),
} = {}) {
  if (!root) throw new Error('Daily Growth needs its panel element.');
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (storage === undefined) {
    try {
      storage = view.localStorage;
      // Migrate a still-valid tab session without asking for another signature.
      if (!storage.getItem(SESSION_KEY)) {
        const previous = readSession(view.sessionStorage, now());
        if (previous) storage.setItem(SESSION_KEY, JSON.stringify(previous));
      }
      view.sessionStorage.removeItem(SESSION_KEY);
    } catch { try { storage = view.sessionStorage; } catch { storage = null; } }
  }
  const byId = (id) => root.querySelector(`#growth-${id}`);
  const ui = Object.fromEntries([
    'meta', 'season-tag', 'wallet-state', 'wallet-identity', 'wallet-identity-status', 'wallet-identity-name', 'wallet-identity-address', 'auth-note', 'connect', 'sign-in', 'sign-out', 'wallet-picker', 'wallet-options', 'wallet-close', 'wallet-status', 'no-wallet',
    'quest-state', 'quest-rule', 'pick-label', 'game-name', 'objective', 'game-access', 'play', 'refresh', 'alternative', 'game-select',
    'quest-note', 'visit-count', 'check-note', 'check-in', 'check-in-row', 'check-in-task', 'check-in-state', 'task-auth', 'passport-count', 'passport-note', 'stamps',
    'passport-reward', 'passport-optional', 'optional-stamps', 'tracking-note', 'month-empty', 'month-content', 'month-visits', 'month-quests', 'next', 'calendar', 'milestones',
    'badges-empty', 'badges', 'status', 'journey-note', 'journey-stops', 'quest-meter', 'visit-total', 'passport-meter',
    'summary-count', 'summary-label', 'summary-note', 'summary-meter', 'summary-art', 'summary-art-label', 'summary-flavor', 'summary-rank', 'quest-art',
    'badge-preview', 'invitation-open', 'invitation-title', 'invitation-hint', 'details', 'details-label', 'details-hint',
    'month-rail', 'rail-month', 'rail-count', 'rail-note', 'days', 'teaser-badge', 'teaser-kind', 'quest-details', 'calendar-title', 'reward-kind', 'reward-earned', 'collapse',
  ].map((id) => [id, byId(id)]));
  const state = {
    wallet: null, walletId: null, walletReady: false, walletError: false, session: null, progress: null,
    configuration: null, dateKey: null, monthKey: null, busy: 'loading', stale: false,
    selectedGameId: null, notice: 'Loading Daily Growth…', noticeKind: '', pickerOpen: false,
    availableWallets: [], apiUnavailable: false, launched: false,
  };
  const missions = createArcadeMissions({ root, fetchImpl, getSession: () => state.session, now });
  const campaigns = createQuestCampaigns({ root, fetchImpl, getSession: () => state.session, syncGames: () => refresh(), checkIn: () => checkIn(), getProgress: () => state.progress, now });
  let bridge = null;
  let epoch = 0;
  let disposed = false;
  let expiryTimer = null;
  let savedSession = readSession(storage, now());
  let unsubscribeWallet = () => {};
  let unsubscribeWallets = () => {};
  let pickerTrigger = null;
  let walletInitialized = false;
  let restoreInFlight = null;
  let restorePending = false;
  let restoreQueued = false;
  const requests = new Set();
  const listeners = [];
  const on = (element, event, listener) => {
    element.addEventListener(event, listener);
    listeners.push(() => element.removeEventListener(event, listener));
  };
  const append = (parent, tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    parent.append(element);
    return element;
  };

  function emblem(parent, name, className) {
    const holder = append(parent, 'span', className);
    holder.setAttribute('aria-hidden', 'true');
    const image = append(holder, 'img', 'growth-art-icon');
    image.src = GROWTH_ART[name] || GROWTH_ART.unknown;
    image.alt = '';
    image.width = 64;
    image.height = 64;
    image.loading = 'lazy';
    return holder;
  }

  function meter(element, value, maximum, label) {
    const known = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0;
    element.classList.toggle('is-unknown', !known);
    element.classList.toggle('is-complete', known && value >= maximum);
    element.style.setProperty('--growth-progress', known ? String(Math.min(100, Math.max(0, value / maximum * 100))) : '0');
    element.setAttribute('aria-label', label);
    if (known) {
      element.setAttribute('role', 'progressbar');
      element.setAttribute('aria-valuemin', '0');
      element.setAttribute('aria-valuemax', String(maximum));
      element.setAttribute('aria-valuenow', String(Math.min(maximum, Math.max(0, value))));
      element.setAttribute('aria-valuetext', `${label}${state.stale ? ' · Last saved progress' : ''}`);
    } else {
      for (const attribute of ['role', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) element.removeAttribute(attribute);
    }
  }

  function closePicker() {
    state.pickerOpen = false;
    if (ui['wallet-picker'].open) ui['wallet-picker'].close();
    ui.connect.setAttribute('aria-expanded', 'false');
    const target = state.session ? ui['sign-out'] : state.wallet ? ui['sign-in'] : pickerTrigger || ui.connect;
    if (!target.hidden && !target.disabled) target.focus({ preventScroll: true });
  }

  function renderPicker() {
    const dialog = ui['wallet-picker'];
    ui.connect.setAttribute('aria-expanded', String(state.pickerOpen));
    renderWalletOptions();
    ui['wallet-status'].textContent = state.pickerOpen && (state.busy === 'connecting' || state.noticeKind === 'error') ? state.notice : '';
    ui['wallet-status'].classList.toggle('is-error', state.noticeKind === 'error');
    if (state.pickerOpen && !dialog.open) {
      dialog.showModal();
      (ui['wallet-options'].querySelector('button:not(:disabled)') || ui['wallet-close']).focus({ preventScroll: true });
    } else if (!state.pickerOpen && dialog.open) closePicker();
  }

  function renderJourney(progress) {
    const milestones = progress?.milestones || MILESTONE_GOALS;
    const next = progress?.milestones.find((item) => !item.earned && item.target > progress.checkedInDays);
    const allEarned = Boolean(progress?.milestones.length && progress.milestones.every((item) => item.earned));
    ui['journey-stops'].replaceChildren();
    ui['journey-note'].textContent = progress
      ? state.stale ? 'Last saved progress · Refresh to check for updates.'
        : next ? `${next.target - progress.checkedInDays} more check-in${next.target - progress.checkedInDays === 1 ? '' : 's'} to ${badgePresentation(next).label}. Keep growing.`
          : allEarned ? 'Your Legends of TREE collection is complete.' : 'Keep growing your Legends of TREE collection.'
      : state.apiUnavailable ? 'Progress unavailable · Your saved badges are safe.' : 'Your Legends of TREE collection. Sign in to reveal your progress.';
    for (const milestone of milestones) {
      const presentation = badgePresentation(milestone);
      const item = append(ui['journey-stops'], 'div', `growth-stop${!progress ? ' is-preview' : milestone.earned ? ' is-done' : milestone === next ? ' is-next' : ''}`);
      item.dataset.rank = presentation.id;
      item.setAttribute('role', 'listitem');
      if (presentation.ordinal) append(item, 'span', 'growth-stop-ordinal', presentation.ordinal);
      append(item, 'span', 'growth-stop-state', progress && milestone.earned ? 'Earned' : progress && milestone === next ? 'Up next' : `${milestone.target} check-ins`);
      emblem(item, presentation.id, 'growth-stop-icon');
      const copy = append(item, 'div', 'growth-stop-copy');
      append(copy, 'strong', '', presentation.label);
      if (presentation.flavor) append(copy, 'p', 'growth-stop-flavor', presentation.flavor);
      if (progress) {
        append(copy, 'span', 'growth-stop-count', `${Math.min(progress.checkedInDays, milestone.target)} / ${milestone.target} check-ins`);
        const bar = append(item, 'div', 'growth-meter growth-stop-progress');
        append(bar, 'span');
        meter(bar, progress.checkedInDays, milestone.target, `${Math.min(progress.checkedInDays, milestone.target)} of ${milestone.target} check-ins toward ${presentation.label}`);
      }
    }
  }

  function currentWallet() {
    try {
      const wallet = bridge?.getWalletState();
      const address = normalizedAddress(wallet?.address);
      return wallet?.connected && address ? { address, walletName: wallet.walletName || 'Sui wallet', walletId: text(wallet.walletId, 200) ? wallet.walletId : null } : null;
    } catch { return null; }
  }

  function persistSession(session) {
    savedSession = session;
    try {
      if (session) storage?.setItem(SESSION_KEY, JSON.stringify(session));
      else storage?.removeItem(SESSION_KEY);
    } catch { /* Storage is optional; no progress or completion is stored in the browser. */ }
  }

  function invalidateSession(message = '', { preserveSavedSession = false } = {}) {
    epoch += 1;
    restorePending = false;
    for (const controller of requests) controller.abort();
    requests.clear();
    view.clearTimeout(expiryTimer);
    state.session = null;
    state.progress = null;
    state.stale = false;
    state.launched = false;
    state.busy = null;
    state.notice = message;
    state.noticeKind = '';
    if (!preserveSavedSession) persistSession(null);
    render();
  }

  function armExpiry() {
    view.clearTimeout(expiryTimer);
    if (!state.session) return;
    expiryTimer = view.setTimeout(() => {
      invalidateSession('Your Arcade sign-in expired after one hour. Sign in to continue; today’s saved check-in and earned progress are kept.');
      render();
    }, Math.max(0, timestamp(state.session.expiresAt) - now()));
  }

  function suspendSession() {
    // A provider can briefly disappear while a page is frozen or a game owns
    // focus. Hide authenticated UI, but retain the unexpired, signed token.
    // No API write is allowed until the same provider/account is restored.
    const candidate = state.session || savedSession;
    const valid = Boolean(candidate && timestamp(candidate.expiresAt) > now());
    invalidateSession('Reconnecting your arcade wallet…', { preserveSavedSession: valid });
    if (valid) {
      persistSession(candidate);
      restorePending = true;
    }
  }

  function sessionIsCurrent() {
    if (!state.session) return false;
    const actual = currentWallet();
    if (!actual && timestamp(state.session.expiresAt) > now()) {
      suspendSession();
      state.wallet = null;
      render();
      return false;
    }
    if (timestamp(state.session.expiresAt) <= now() || actual?.address !== state.session.wallet) {
      invalidateSession('Sign in with your current wallet to load its Daily Growth progress.');
      state.wallet = actual;
      render();
      return false;
    }
    return true;
  }

  function setNotice(message, kind = '') {
    state.notice = message;
    state.noticeKind = kind;
  }

  async function request(action, { body, token, signal } = {}) {
    const controller = new AbortController();
    requests.add(controller);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = view.setTimeout(abort, 65000);
    try {
      const headers = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchImpl(`${API_PATH}?action=${encodeURIComponent(action)}`, {
        method: body === undefined ? 'GET' : 'POST', headers, cache: 'no-store', credentials: 'omit',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      });
      let payload;
      try { payload = await response.json(); } catch { throw invalidData(); }
      if (!response.ok || payload?.status !== 'ok') {
        const error = new Error(text(payload?.message, 500) ? payload.message : 'Daily Growth is temporarily unavailable. Try refreshing.');
        error.code = text(payload?.error, 100) ? payload.error : 'service-unavailable';
        error.httpStatus = response.status;
        throw error;
      }
      return payload;
    } finally {
      view.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      requests.delete(controller);
    }
  }

  function acceptEnvelope(payload, expectedWallet = null) {
    const nextConfiguration = payload.configuration ? normalizeConfiguration(payload.configuration) : state.configuration;
    const nextProgress = payload.progress ? normalizeProgress(payload.progress, expectedWallet) : null;
    if (expectedWallet && (!nextProgress || payload.authenticated === false)) throw invalidData();
    const dateKey = payload.dateKey || nextProgress?.dateKey;
    const monthKey = payload.monthKey || nextProgress?.monthKey;
    if (!dateKeyPattern.test(dateKey) || !monthKeyPattern.test(monthKey) || !dateKey.startsWith(`${monthKey}-`) || !nextConfiguration) throw invalidData();
    const [year, month] = monthKey.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (year < 2020 || year > 2100 || month < 1 || month > 12 || Number(dateKey.slice(-2)) < 1 || Number(dateKey.slice(-2)) > days) throw invalidData();
    if (nextProgress && (nextProgress.dateKey !== dateKey || nextProgress.monthKey !== monthKey)) throw invalidData();
    state.configuration = nextConfiguration;
    state.dateKey = dateKey;
    state.monthKey = monthKey;
    if (expectedWallet) state.progress = nextProgress;
    state.apiUnavailable = false;
    state.stale = false;
    if (!nextConfiguration.eligibleGames.some((game) => game.id === state.selectedGameId)) state.selectedGameId = nextConfiguration.todayPick?.id || nextConfiguration.eligibleGames[0]?.id || null;
  }

  function reportError(error) {
    if (AUTH_ERRORS.has(error?.code) || error?.httpStatus === 401) {
      invalidateSession('Your Daily Growth session is no longer valid. Sign in again to load your saved progress.');
      return;
    }
    state.stale = Boolean(state.progress);
    if (error?.code === 'nftree-required') {
      setNotice('An eligible NFTree is required to save Daily Growth. Use the wallet holding it, then try again. Your saved progress has not been reset.', 'error');
    } else if (error?.code === 'ownership-unavailable') {
      setNotice('NFTree ownership verification is unavailable. No new progress was saved. Try again shortly.', 'error');
    } else if (error?.name === 'AbortError') {
      state.apiUnavailable = true;
      setNotice('Daily Growth did not respond in time. Saved progress has not been reset. Try refreshing.', 'error');
    } else {
      state.apiUnavailable = true;
      const prefix = state.progress ? 'Last saved progress shown. ' : 'Progress is unavailable. ';
      setNotice(prefix + (text(error?.message, 500) ? error.message : 'Try refreshing in a moment.'), 'error');
    }
  }

  function renderWalletOptions() {
    const focusedId = ui['wallet-options'].contains(document.activeElement) ? document.activeElement?.closest('button[data-wallet-id]')?.dataset.walletId : null;
    ui['wallet-options'].replaceChildren();
    for (const wallet of state.availableWallets) {
      const connecting = state.busy === 'connecting' && state.walletId === wallet.id;
      const button = append(ui['wallet-options'], 'button', `growth-wallet-option${connecting ? ' is-connecting' : ''}`);
      button.type = 'button';
      button.disabled = Boolean(state.busy);
      button.dataset.walletId = wallet.id;
      const icon = append(button, 'span', 'growth-wallet-icon');
      if (typeof wallet.icon === 'string' && wallet.icon.length <= 524288 && /^data:image\/(png|jpeg|webp|svg\+xml);/i.test(wallet.icon)) {
        const image = append(icon, 'img', '');
        image.src = wallet.icon;
        image.alt = '';
        image.width = 36;
        image.height = 36;
      } else append(icon, 'span', '', wallet.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()).setAttribute('aria-hidden', 'true');
      const copy = append(button, 'span', 'growth-wallet-copy');
      append(copy, 'strong', '', wallet.name);
      append(copy, 'small', '', connecting ? 'Approve connection in your wallet' : 'Detected · Ready to connect');
      append(button, 'span', 'growth-wallet-indicator', connecting ? '…' : '↗').setAttribute('aria-hidden', 'true');
    }
    ui['no-wallet'].hidden = state.availableWallets.length > 0;
    if (focusedId && state.pickerOpen) {
      const next = [...ui['wallet-options'].querySelectorAll('button')].find((button) => button.dataset.walletId === focusedId && !button.disabled);
      (next || ui['wallet-close']).focus({ preventScroll: true });
    }
  }

  function renderCalendar(progress) {
    ui.calendar.replaceChildren();
    ui['calendar-title'].textContent = monthLabel(progress.monthKey);
    ui.calendar.setAttribute('aria-label', `${monthLabel(progress.monthKey)} attendance and daily quests${state.stale ? ' · Last saved progress' : ''}`);
    for (const name of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      const label = append(ui.calendar, 'span', 'growth-weekday', name);
      label.setAttribute('aria-hidden', 'true');
    }
    const firstWeekday = new Date(`${progress.monthKey}-01T12:00:00Z`).getUTCDay();
    for (let index = 0; index < firstWeekday; index += 1) append(ui.calendar, 'span', 'growth-calendar-blank').setAttribute('aria-hidden', 'true');
    for (const day of progress.calendar) {
      const isToday = day.dateKey === progress.dateKey;
      const cell = append(ui.calendar, 'div', `growth-day${day.checkedIn ? ' is-done' : ''}${day.questCompleted ? ' has-quest' : ''}${isToday ? ' is-today' : ''}${day.dateKey < progress.dateKey && !day.checkedIn ? ' is-missed' : ''}`);
      cell.setAttribute('role', 'listitem');
      const description = day.checkedIn ? `checked in${day.questCompleted ? ', daily quest complete' : ''}` : isToday ? 'today, not yet checked in' : day.dateKey < progress.dateKey ? 'missed, earlier progress retained' : 'upcoming';
      cell.setAttribute('aria-label', `${dateLabel(day.dateKey)}: ${description}${state.stale ? ' · Last saved progress' : ''}`);
      if (isToday) cell.setAttribute('aria-current', 'date');
      append(cell, 'strong', '', String(Number(day.dateKey.slice(-2)))).setAttribute('aria-hidden', 'true');
      append(cell, 'span', '', day.questCompleted ? '✓ ★' : day.checkedIn ? '✓' : isToday ? '○' : day.dateKey < progress.dateKey ? '–' : '·').setAttribute('aria-hidden', 'true');
    }
  }

  function renderDayRail(progress) {
    const monthKey = progress?.monthKey || state.monthKey;
    const dateKey = progress?.dateKey || state.dateKey;
    const loading = ['loading', 'syncing'].includes(state.busy);
    const lastSaved = Boolean(progress && (state.stale || state.apiUnavailable || loading));
    const calendar = progress?.calendar || (monthKey ? Array.from({
      length: new Date(Date.UTC(...monthKey.split('-').map(Number), 0)).getUTCDate(),
    }, (_, index) => ({ dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}` })) : []);
    const track = root.querySelector('.growth-rank-track');
    if (track) {
      for (const item of track.querySelectorAll('[data-rank-id]')) {
        const milestone = progress?.milestones.find((entry) => badgePresentation(entry).id === item.dataset.rankId);
        const earned = Boolean(milestone?.earned);
        item.classList.toggle('is-earned', earned);
        item.querySelector('.growth-rank-state').textContent = earned ? 'UNLOCKED ✓' : progress ? 'TO UNLOCK' : 'CHECK-IN GOAL';
      }
    }
    ui['month-rail'].classList.toggle('is-unknown', !progress);
    ui['month-rail'].classList.toggle('is-stale', lastSaved);
    ui['rail-month'].textContent = monthKey ? `${monthLabel(monthKey)} · CHECK-INS` : 'YOUR MONTHLY CHECK-INS';
    ui['visit-count'].textContent = progress ? String(progress.checkedInDays) : '—';
    ui['visit-total'].textContent = progress
      ? `/ ${calendar.length} days${lastSaved ? ' · Last saved' : ''}`
      : state.apiUnavailable ? 'Unavailable' : loading ? 'Loading…' : 'Sign in to view';
    ui['rail-count'].setAttribute('aria-label', progress
      ? `${progress.checkedInDays} of ${calendar.length} days checked in${lastSaved ? ' · Last saved progress' : ''}`
      : state.apiUnavailable ? 'Attendance unavailable; your saved progress has not changed' : 'Attendance unknown; sign in to view your saved days');
    ui['rail-note'].textContent = lastSaved
      ? loading ? 'Checking for updates · Last saved days shown.' : 'Last saved days shown. Refresh inside to check for updates.'
      : progress ? 'Calendar dates · UTC. Free check-ins are today only; recover missed dates below.'
        : state.apiUnavailable ? 'Your saved days are unavailable. No progress has changed.'
          : loading ? 'Loading the current month…' : 'Sign in to reveal your saved days.';
    ui.days.style.setProperty('--growth-days', String(calendar.length || 31));
    ui.days.style.setProperty('--growth-mobile-days', String(Math.ceil(calendar.length / 2) || 16));
    ui.days.setAttribute('aria-label', `${monthKey ? monthLabel(monthKey) : 'Monthly'} check-in dates${lastSaved ? ' · Last saved progress' : !progress ? ' · Attendance unknown' : ''}`);
    ui.days.replaceChildren();
    for (const day of calendar) {
      const isToday = day.dateKey === dateKey;
      const checked = Boolean(progress && day.checkedIn);
      const missed = Boolean(progress && day.dateKey < dateKey && !day.checkedIn);
      const future = Boolean(progress && day.dateKey > dateKey);
      const cell = append(ui.days, 'div', `growth-rail-day${checked ? ' is-done' : ''}${missed ? ' is-missed' : ''}${future ? ' is-future' : ''}${isToday ? ' is-today' : ''}${!progress ? ' is-unknown' : ''}`);
      cell.dataset.date = day.dateKey;
      cell.setAttribute('role', 'listitem');
      const status = !progress ? `${isToday ? 'today · ' : ''}${state.apiUnavailable ? 'attendance unavailable' : 'sign in to view saved attendance'}`
        : checked ? 'checked in' : isToday ? 'today · not yet checked in' : missed ? 'not checked in · earlier progress retained' : 'upcoming';
      const label = `${dateLabel(day.dateKey)}: ${status}${lastSaved ? ' · Last saved progress' : ''}`;
      cell.setAttribute('aria-label', label);
      cell.title = label;
      if (isToday) cell.setAttribute('aria-current', 'date');
      append(cell, 'span', 'growth-rail-number', String(Number(day.dateKey.slice(-2)))).setAttribute('aria-hidden', 'true');
      append(cell, 'span', 'growth-rail-mark', checked ? '✓' : isToday ? '○' : missed ? '–' : '·').setAttribute('aria-hidden', 'true');
    }
  }

  function invitationComplete() {
    return Boolean(state.progress?.today.checkedIn && state.progress.today.questCompleted
      && !state.stale && !state.apiUnavailable && !['loading', 'syncing'].includes(state.busy));
  }

  function syncInvitationExpanded() {
    for (const id of ['badge-preview', 'invitation-open']) ui[id].setAttribute('aria-expanded', String(ui.details.open));
  }

  function renderInvitation(progress) {
    const refreshing = ['loading', 'syncing'].includes(state.busy);
    const lastSaved = Boolean(progress && (state.stale || state.apiUnavailable || refreshing));
    const next = progress?.milestones.find((milestone) => !milestone.earned && milestone.target > progress.checkedInDays);
    const badge = progress ? next || progress.milestones.at(-1) : MILESTONE_GOALS[0];
    const presentation = badgePresentation(badge);
    const allEarned = Boolean(progress?.milestones.length && progress.milestones.every((milestone) => milestone.earned));
    const remaining = next ? next.target - progress.checkedInDays : null;
    const complete = invitationComplete();
    const unknown = state.apiUnavailable ? 'Progress unavailable' : 'Sign in to view badge progress';
    ui['summary-art'].src = presentation.art;
    ui['summary-art'].closest('.growth-reward').dataset.rank = presentation.id;
    ui['summary-art-label'].textContent = presentation.label;
    ui['summary-flavor'].textContent = presentation.flavor;
    ui['summary-rank'].textContent = presentation.ordinal ? `RANK ${presentation.ordinal} / 04` : '';
    ui['teaser-badge'].textContent = presentation.label;
    ui['teaser-kind'].textContent = allEarned ? 'Collection complete' : 'Next legend';
    ui['reward-kind'].textContent = allEarned ? 'COLLECTION COMPLETE' : 'YOUR NEXT UNLOCK';
    ui['badge-preview'].classList.toggle('is-preview', !progress);
    ui['badge-preview'].classList.toggle('is-complete', Boolean(progress && badge?.earned));
    ui['summary-count'].textContent = progress
      ? next ? `${remaining === 1 ? 'One more check-in' : `${remaining} more check-ins`} to ${presentation.label}`
        : allEarned ? 'Your Legends of TREE collection is complete.' : 'Keep your growth going.'
      : state.apiUnavailable ? 'Your badges will be here.' : 'Your first badge starts here.';
    ui['summary-label'].textContent = progress
      ? `${badge ? `${Math.min(progress.checkedInDays, badge.target)} / ${badge.target} check-ins` : `${progress.checkedInDays} check-ins this month`}${lastSaved ? ' · Last saved' : ''}`
      : state.apiUnavailable ? 'Progress temporarily unavailable' : `${badge.target} cumulative check-ins to earn`;
    ui['summary-meter'].hidden = !progress || !badge;
    meter(ui['summary-meter'], progress?.checkedInDays, progress ? badge?.target : null, progress && badge
      ? `${Math.min(progress.checkedInDays, badge.target)} of ${badge.target} check-ins toward ${presentation.label}${lastSaved && !state.stale ? ' · Last saved progress' : ''}`
      : unknown);
    ui['badge-preview'].setAttribute('aria-label', `Daily Growth. ${complete ? 'View badge progress' : 'View missions'}.`);
    ui['invitation-title'].textContent = 'Arcade Missions';
    ui['summary-note'].textContent = lastSaved
      ? refreshing ? 'Checking for updates. Last saved progress is shown.' : 'Last saved progress. Open your tasks to refresh.'
      : state.apiUnavailable ? 'We couldn’t load Daily Growth. Please try again shortly.'
        : !progress ? 'Check in. Play. Grow your collection.'
          : complete ? 'Today’s check-in and quest are saved.'
            : progress.today.checkedIn ? 'Checked in. Ready for today’s quest?'
              : 'Make today count. Check in and keep growing.';
    ui['invitation-hint'].textContent = lastSaved ? 'Last saved progress · Refresh to check today.'
      : refreshing ? 'Loading your growth…'
      : state.apiUnavailable ? 'Your saved progress has not changed.'
        : state.busy === 'checking-in' ? 'Saving your check-in. Your quest stays optional.'
          : !state.session ? state.wallet ? 'Sign in with a message · No gas fee' : 'Free check-in · No gas fee'
            : !progress ? 'Loading your saved progress…'
              : complete ? 'Check-in and quest saved · Come back tomorrow.'
                : progress.today.checkedIn ? 'Check-in saved · Today’s quest is optional.' : 'Free check-in · No game required';
    ui['details-label'].textContent = complete ? 'View badge progress' : 'View missions';
    ui['details-hint'].textContent = progress
      ? `${next ? `${remaining} more check-in${remaining === 1 ? '' : 's'}` : allEarned ? 'Earned automatically ✓' : 'Keep growing'}${lastSaved ? ' · Last saved' : ''}`
      : state.apiUnavailable ? 'Progress unavailable' : `${badge.target} check-ins to earn`;
    ui['reward-earned'].replaceChildren();
    const earned = progress?.milestones.filter((milestone) => milestone.earned) || [];
    ui['reward-earned'].hidden = !earned.length;
    if (earned.length) {
      append(ui['reward-earned'], 'span', 'growth-reward-earned-label', `Earned this month${lastSaved ? ' · Last saved' : ''}`);
      for (const milestone of earned) append(ui['reward-earned'], 'span', 'growth-earned-chip', `${badgePresentation(milestone).label} ✓`);
    }
    syncInvitationExpanded();
  }

  function renderProgress() {
    const progress = state.progress;
    const unavailable = state.apiUnavailable || state.stale;
    const next = progress?.milestones.find((milestone) => !milestone.earned && milestone.target > progress.checkedInDays);
    const unknown = unavailable ? 'Progress unavailable' : 'Sign in to view progress';
    renderInvitation(progress);
    renderJourney(progress);
    renderDayRail(progress);
    meter(ui['quest-meter'], progress ? Number(progress.today.questCompleted) : null, 1, progress ? `${Number(progress.today.questCompleted)} of 1 daily quests complete` : unknown);
    meter(ui['passport-meter'], progress?.passport.completedGameIds.length, progress?.passport.enabledGames.length, progress ? `${progress.passport.completedGameIds.length} of ${progress.passport.enabledGames.length} required Passport games` : unknown);
    root.querySelector('.growth-quest').classList.toggle('is-complete', Boolean(progress?.today.questCompleted));
    ui['month-content'].hidden = !progress;
    ui['month-empty'].hidden = Boolean(progress);
    ui['month-empty'].textContent = unavailable ? 'Your monthly calendar is unavailable. Refresh to try again.' : 'Sign in to see your real monthly calendar.';
    for (const id of ['check-in', 'check-in-row']) {
      ui[id].hidden = !state.session;
      ui[id].disabled = Boolean(state.busy) || !state.session || !progress || progress.today.checkedIn;
      ui[id].textContent = state.busy === 'checking-in' ? 'Saving check-in…' : progress?.today.checkedIn ? 'Checked in ✓' : id === 'check-in' ? 'Check in today' : 'Check in';
    }
    ui['check-in-task'].classList.toggle('is-complete', Boolean(progress?.today.checkedIn));
    ui['check-in-state'].textContent = progress
      ? `${progress.today.checkedIn ? 'Today’s attendance is saved.' : 'Check in today to grow your monthly progress.'}${state.stale ? ' Last saved progress.' : ''}`
      : unavailable ? 'Attendance is temporarily unavailable.' : state.wallet ? 'Sign in to save today’s attendance.' : 'Connect your wallet, then sign in to save attendance.';
    ui['task-auth'].hidden = Boolean(state.session) || Boolean(savedSession && timestamp(savedSession.expiresAt)>now() && (restoreInFlight || restorePending || state.busy==='restoring'));
    ui['task-auth'].disabled = Boolean(state.busy) || !state.walletReady;
    ui['task-auth'].textContent = state.busy === 'signing-in' ? 'Approve message…' : state.busy === 'connecting' ? 'Connecting…' : state.wallet ? 'Sign in' : 'Connect wallet';
    ui['check-note'].textContent = progress?.today.checkedIn
      ? 'Your attendance is saved. A quest is optional for check-in.'
      : progress ? 'Check in without playing. A verified quest also checks you in.'
        : unavailable ? 'Attendance is unavailable. It has not been reset to zero.' : 'Sign in to see your saved attendance. You can check in without playing a game.';
    ui.stamps.replaceChildren();
    ui['optional-stamps'].replaceChildren();
    ui['passport-optional'].hidden = !progress?.passport.optionalGames.length;
    ui.badges.replaceChildren();
    ui.milestones.replaceChildren();
    ui['passport-count'].textContent = progress ? `${progress.passport.completedGameIds.length} / ${progress.passport.enabledGames.length} required games` : unavailable ? 'Unavailable' : 'Sign in to view';
    ui['passport-note'].textContent = progress
      ? `${monthLabel(progress.monthKey)} · Collect all ${progress.passport.enabledGames.length} game stamps for this monthly badge. Paid PvP is not required for check-ins or daily quests.`
      : 'Collect this month’s game stamps at your own pace to earn the Arcade Passport badge.';
    ui['passport-reward'].textContent = '';
    ui['badges-empty'].hidden = Boolean(progress?.badges.length);
    ui['badges-empty'].textContent = progress
      ? 'No badges earned yet. Check in on different days or complete your monthly passport to grow your collection.'
      : unavailable ? 'Earned badges are unavailable. Refresh to try again.' : 'Sign in to see your earned monthly badges.';
    if (!progress) {
      ui.calendar.replaceChildren();
      ui['month-visits'].textContent = '—';
      ui['month-quests'].textContent = '—';
      ui.next.textContent = '';
      ui['calendar-title'].textContent = 'Your month';
      return;
    }
    ui['month-visits'].textContent = String(progress.checkedInDays);
    ui['month-quests'].textContent = String(progress.questDays);
    ui.next.textContent = next ? `Next: ${badgePresentation(next).label} · ${next.target - progress.checkedInDays} more check-in${next.target - progress.checkedInDays === 1 ? '' : 's'}`
      : progress.milestones.length && progress.milestones.every((milestone) => milestone.earned) ? 'Your Legends of TREE collection is complete.' : 'Keep growing your Legends of TREE collection.';
    for (const game of progress.passport.enabledGames) {
      const complete = progress.passport.completedGameIds.includes(game.id);
      const stamp = append(ui.stamps, 'div', `growth-stamp${complete ? ' is-done' : ''}`);
      emblem(stamp, game.id, 'growth-stamp-icon');
      append(stamp, 'strong', '', game.label);
      append(stamp, 'span', '', complete
        ? game.creditRule === 'start-run' ? '✓ First wave started · Stamp earned' : '✓ Stamp earned'
        : game.creditRule === 'start-run' ? '○ Start a run · Reach the first wave' : game.id === 'pvp' ? '○ Not yet played · Paid entry' : '○ Not yet played');
    }
    for (const game of progress.passport.optionalGames) {
      const recorded = progress.passport.optionalCompletedGameIds.includes(game.id);
      const stamp = append(ui['optional-stamps'], 'div', `growth-stamp${recorded ? ' is-done' : ''}`);
      emblem(stamp, game.id, 'growth-stamp-icon');
      append(stamp, 'strong', '', game.label);
      append(stamp, 'span', '', recorded
        ? game.creditRule === 'start-run' ? '✓ First wave started · Optional stamp' : '✓ Optional stamp earned'
        : game.creditRule === 'start-run' ? '○ Start one run · Optional stamp' : '○ Optional stamp not yet earned');
    }
    ui['passport-reward'].textContent = progress.passport.complete
      ? 'Monthly Arcade Passport badge earned ✓'
      : progress.passport.enabledGames.length
        ? `All required stamps earn the monthly Arcade Passport badge.${progress.passport.optionalGames.length ? ' Optional stamps do not change the requirement.' : ''}`
        : 'Passport games will appear when verified tracking is available.';
    for (const milestone of progress.milestones) {
      const presentation = badgePresentation(milestone);
      const item = append(ui.milestones, 'div', `growth-milestone${milestone.earned ? ' is-done' : ''}`);
      item.dataset.rank = presentation.id;
      emblem(item, presentation.id, 'growth-badge-emblem');
      append(item, 'strong', '', `${presentation.label}${milestone.earned ? ' ✓' : ''}`);
      append(item, 'span', '', `${milestone.target} check-ins`);
      const bar = append(item, 'div', 'growth-meter');
      append(bar, 'span');
      meter(bar, progress.checkedInDays, milestone.target, `${Math.min(progress.checkedInDays, milestone.target)} of ${milestone.target} check-ins toward ${presentation.label}`);
    }
    for (const badge of [...progress.badges].sort((a, b) => timestamp(b.earnedAt) - timestamp(a.earnedAt))) {
      const presentation = badgePresentation(badge);
      const item = append(ui.badges, 'div', 'growth-badge');
      item.dataset.rank = presentation.id;
      emblem(item, presentation.id, 'growth-badge-emblem');
      const copy = append(item, 'div', 'growth-badge-copy');
      append(copy, 'strong', '', presentation.label);
      append(copy, 'span', '', 'Earned ✓');
      append(copy, 'p', '', `${monthLabel(badge.monthKey)} · Saved to this wallet’s progress`);
    }
    renderCalendar(progress);
  }

  function render() {
    if (disposed) return;
    missions.sessionChanged();
    campaigns.sessionChanged();
    const busy = Boolean(state.busy);
    root.dataset.growthState = state.busy || (state.apiUnavailable ? 'unavailable' : state.session ? 'authenticated' : state.wallet ? 'connected' : 'signed-out');
    root.setAttribute('aria-busy', String(busy));
    ui.meta.textContent = state.dateKey ? `${dateLabel(state.dateKey)} · UTC daily progress` : 'Your NFTree holder progress, one day at a time.';
    ui['season-tag'].textContent = state.monthKey ? `${monthLabel(state.monthKey)} season` : 'A new season every month';
    ui['wallet-state'].textContent = state.session
      ? `${state.wallet?.walletName || 'Sui wallet'} · ${shortAddress(state.session.wallet)} · Signed in`
      : state.wallet ? `${state.wallet.walletName} · ${shortAddress(state.wallet.address)} · Connected`
        : 'Connect your NFTree wallet to save check-ins, daily quests, and monthly badges.';
    ui['wallet-state'].title = state.session?.wallet || state.wallet?.address || '';
    const wallet = state.wallet;
    const signedIn = Boolean(wallet && state.session?.wallet === wallet.address && timestamp(state.session.expiresAt) > now());
    const identityLabel = wallet ? `${wallet.walletName} · ${wallet.address} · ${signedIn ? 'Signed in to Daily Growth' : 'Connected, not signed in to Daily Growth'}` : null;
    if (ui['wallet-identity'].getAttribute('aria-label') !== identityLabel || ui['wallet-identity'].hidden !== !wallet) {
      ui['wallet-identity'].hidden = !wallet;
      ui['wallet-identity'].classList.toggle('is-signed-in', signedIn);
      ui['wallet-identity-status'].textContent = wallet ? signedIn ? 'Signed in' : 'Connected' : '';
      ui['wallet-identity-name'].textContent = wallet?.walletName || '';
      ui['wallet-identity-address'].textContent = wallet ? shortAddress(wallet.address) : '';
      if (wallet) {
        ui['wallet-identity'].title = wallet.address;
        ui['wallet-identity'].setAttribute('aria-label', identityLabel);
      } else {
        ui['wallet-identity'].removeAttribute('title');
        ui['wallet-identity'].removeAttribute('aria-label');
      }
    }
    ui['auth-note'].textContent = state.session
      ? 'Your progress belongs to this wallet. Sessions expire after one hour.'
      : state.walletError ? 'Wallet connection is unavailable. Refresh the page to try again.'
        : 'Sign-in uses a wallet message. It does not submit a transaction.';
    ui.connect.disabled = busy || !state.walletReady;
    ui.connect.hidden = Boolean(state.session);
    ui.connect.classList.toggle('growth-primary', !state.wallet);
    ui.connect.classList.toggle('growth-secondary', Boolean(state.wallet));
    ui.connect.textContent = state.busy === 'connecting' ? 'Connecting…' : state.wallet ? 'Change wallet' : 'Connect to check in';
    const restoringSaved=Boolean(savedSession&&timestamp(savedSession.expiresAt)>now()&&(restoreInFlight||restorePending||state.busy==='restoring'));
    ui['sign-in'].hidden = !state.wallet || Boolean(state.session) || restoringSaved;
    ui['sign-in'].disabled = busy;
    ui['sign-in'].textContent = state.busy === 'signing-in' ? 'Approve message in wallet…' : 'Sign in to check in';
    ui['sign-out'].hidden = !state.session;
    ui['sign-out'].disabled = busy;
    renderPicker();
    const games = state.configuration?.eligibleGames || [];
    const treeForceEnabled = games.some((game) => game.id === TREE_FORCE_ID);
    const requiredGames = state.progress?.passport.enabledGames || state.configuration?.enabledGames || [];
    const treeForceRequired = requiredGames.some((game) => game.id === TREE_FORCE_ID);
    const gardenOnly = games.length === 3 && ['garden-bot', 'pvp', 'arborist-trials'].every((id) => games.some((game) => game.id === id));
    ui['tracking-note'].hidden = !treeForceEnabled && !gardenOnly;
    ui['tracking-note'].textContent = treeForceEnabled
      ? treeForceRequired
        ? 'TREE FORCE ’89 is part of this month’s Arcade Passport. Reach the first wave to earn its stamp.'
        : 'TREE FORCE ’89 is an optional participation stamp for this month’s Passport.'
      : 'This month’s Passport uses the listed Garden Battles. TREE FORCE ’89 is not enabled for Daily Growth here.';
    ui['quest-rule'].textContent = treeForceEnabled
      ? 'Start one run of TREE FORCE ’89, or finish an eligible Garden Battle.'
      : 'Finish an eligible Garden Battle. Win or lose, it counts.';
    const selected = games.find((game) => game.id === state.selectedGameId);
    const done = state.progress?.today.questCompleted;
    ui['quest-state'].textContent = state.progress ? done ? '1 / 1 · Quest complete ✓' : '0 / 1 · Not completed' : state.apiUnavailable ? 'Progress unavailable' : state.configuration ? 'Sign in to save progress' : 'Checking availability…';
    ui['quest-state'].classList.toggle('is-done', Boolean(done));
    ui['pick-label'].textContent = selected?.id === state.configuration?.todayPick?.id ? 'Today’s pick:' : 'Your choice:';
    ui['game-name'].textContent = selected?.label || (state.apiUnavailable ? 'Eligible games unavailable' : state.configuration ? 'No eligible games right now' : 'Checking eligible games…');
    ui['quest-art'].src = GROWTH_ART[selected?.id] || GROWTH_ART.unknown;
    const copy = selected ? GAME_COPY[selected.id] : null;
    ui.objective.textContent = copy?.objective || 'Follow the selected game’s participation rule, then refresh your progress here.';
    ui['game-access'].textContent = copy?.access || (selected ? 'Check this game’s access and result-saving requirements before playing.' : '');
    ui.play.hidden = !selected;
    if (selected) {
      const sameTab = selected.id === TREE_FORCE_ID;
      ui.play.href = selected.href;
      ui.play.target = sameTab ? '_self' : '_blank';
      if (sameTab) ui.play.removeAttribute('rel');
      else ui.play.rel = 'noopener noreferrer';
      ui.play.textContent = `Play ${selected.label} ${sameTab ? '→' : '↗'}`;
      ui.play.setAttribute('aria-label', `Play ${selected.label} (opens in ${sameTab ? 'this' : 'a new'} tab)`);
    } else ui.play.removeAttribute('href');
    ui.refresh.disabled = busy || (!state.session && !state.apiUnavailable);
    ui.refresh.textContent = state.busy === 'syncing' ? 'Checking game progress…' : !state.session && state.apiUnavailable ? 'Retry availability' : 'Refresh progress';
    ui.alternative.hidden = games.length < 2;
    const currentOptions = [...ui['game-select'].options].map((option) => option.value).join('|');
    if (currentOptions !== games.map((game) => game.id).join('|')) {
      ui['game-select'].replaceChildren();
      for (const game of games) {
        const option = append(ui['game-select'], 'option', '', `${game.label}${game.id === 'pvp' ? ' · Paid entry' : game.creditRule === 'start-run' ? ' · Start a run' : ''}`);
        option.value = game.id;
      }
    }
    ui['game-select'].value = state.selectedGameId || '';
    ui['quest-note'].textContent = selected?.id === TREE_FORCE_ID
      ? done
        ? treeForceRequired
          ? 'Today’s quest is saved and you’re checked in. TREE FORCE ’89 counts toward this month’s Arcade Passport.'
          : 'Today’s quest is saved and you’re checked in. TREE FORCE participation is optional for this month’s Passport.'
        : 'Participation is saved when your first wave starts. Refresh here to see it. One quest per UTC day; opening the link alone does not count.'
      : done
        ? treeForceRequired
          ? 'Today’s quest is saved and you’re checked in. Refresh completed Garden Battles before 00:00 UTC for Passport stamps; TREE FORCE records its stamp when the first wave starts.'
          : 'Today’s quest is saved and you’re checked in. Refresh other completed Garden Battles before 00:00 UTC to add required passport stamps.'
        : 'Complete the game and refresh before 00:00 UTC to earn that day’s quest and passport stamps. Opening a game alone does not count.';
    ui.status.textContent = state.notice;
    ui.status.className = `growth-status${state.noticeKind ? ` is-${state.noticeKind}` : ''}`;
    renderProgress();
    root.dispatchEvent(new view.CustomEvent('arcade-progress',{detail:{progress:state.progress,busy:state.busy,sessionActive:Boolean(state.session),expiresAt:state.session?.expiresAt||null,stale:state.stale||state.apiUnavailable}}));
    queueSavedSessionRestore();
  }

  async function loadStatus() {
    const ticket = epoch;
    state.busy = 'loading';
    render();
    try {
      const expectedWallet = state.session?.wallet || null;
      const payload = await request('status', { token: state.session?.token });
      if (ticket !== epoch || disposed) return;
      acceptEnvelope(payload, expectedWallet);
      setNotice('');
    } catch (error) {
      if (ticket === epoch && !disposed) reportError(error);
    } finally {
      if (ticket === epoch && !disposed) { state.busy = null; render(); }
    }
  }

  function syncNotice(payload, previous) {
    const failed = payload.sync?.games?.filter((game) => ['partial', 'unavailable', 'unsupported'].includes(game.status)) || [];
    const labels = failed.map((result) => state.configuration?.eligibleGames.find((game) => game.id === result.gameId)?.label || 'A game');
    if (failed.length) {
      state.stale = true;
      setNotice(`Saved progress shown; ${labels.join(', ')} verification is unavailable or incomplete. Refresh again later to check for new results.`, 'error');
      return;
    }
    if (state.progress?.today.questCompleted && !previous?.today.questCompleted) setNotice('Daily quest complete. You’re checked in for today, and your game participation is saved.', 'success');
    else if ((state.progress?.passport.completedGameIds.length || 0) > (previous?.passport.completedGameIds.length || 0)) setNotice('A new passport stamp is saved. Today’s quest is already counted.', 'success');
    else if ((state.progress?.passport.optionalCompletedGameIds.length || 0) > (previous?.passport.optionalCompletedGameIds.length || 0)) setNotice('An optional participation stamp is saved. Today’s quest is already counted; required Passport progress is unchanged.', 'success');
    else if (state.progress?.today.questCompleted) setNotice('Progress refreshed. Today’s quest is already saved. Each UTC day can earn one quest stamp.', 'info');
    else setNotice(state.configuration?.eligibleGames.some((game) => game.id === TREE_FORCE_ID)
      ? 'Progress refreshed. A recorded first wave of TREE FORCE or a completed, saved Garden Battles result can count. Opening a game link alone does not count.'
      : 'Progress refreshed. Only completed, verified Garden Battles results count. Opening a game link alone does not count.', 'info');
  }

  async function refresh() {
    if (state.busy) return;
    if (!state.session) return loadStatus();
    if (!sessionIsCurrent()) return;
    const ticket = epoch;
    const session = state.session;
    const previous = state.progress;
    state.busy = 'syncing';
    setNotice('Checking recorded participation and completed game results…');
    render();
    try {
      const payload = await request('sync', { token: session.token, body: {} });
      if (ticket !== epoch || disposed) return;
      if (!sessionIsCurrent()) return;
      acceptEnvelope(payload, session.wallet);
      syncNotice(payload, previous);
      state.launched = false;
    } catch (error) {
      if (ticket === epoch && !disposed) reportError(error);
    } finally {
      if (ticket === epoch && !disposed) { state.busy = null; render(); }
    }
  }

  async function checkIn() {
    if (state.busy || !sessionIsCurrent() || state.progress?.today.checkedIn) return;
    const ticket = epoch;
    const session = state.session;
    state.busy = 'checking-in';
    setNotice('Saving today’s check-in…');
    render();
    try {
      const payload = await request('check-in', { token: session.token, body: {} });
      if (ticket !== epoch || disposed) return;
      if (!sessionIsCurrent()) return;
      acceptEnvelope(payload, session.wallet);
      setNotice('Checked in for today. Your monthly attendance is saved; today’s quest remains optional.', 'success');
    } catch (error) {
      if (ticket === epoch && !disposed) reportError(error);
    } finally {
      if (ticket === epoch && !disposed) { state.busy = null; render(); }
    }
  }

  async function signIn() {
    if (state.busy || !bridge || !state.wallet) return;
    const wallet = currentWallet();
    if (!wallet) return;
    const ticket = epoch;
    const address = wallet.address;
    state.busy = 'signing-in';
    setNotice('Review the Daily Growth sign-in message in your wallet. This does not submit a transaction.');
    render();
    let signedIn = false;
    try {
      const { challenge } = await request('challenge', { body: { wallet: address } });
      if (ticket !== epoch || disposed || currentWallet()?.address !== address) return;
      if (!challenge || normalizedAddress(challenge.wallet) !== address || !text(challenge.challengeId, 300) || !text(challenge.message, 12000) || !Number.isFinite(timestamp(challenge.expiresAt)) || timestamp(challenge.expiresAt) <= now()) throw invalidData();
      const signatureResult = await bridge.signPersonalMessage({ message: new TextEncoder().encode(challenge.message) });
      if (ticket !== epoch || disposed || currentWallet()?.address !== address) return;
      if (!text(signatureResult?.signature, 8192)) throw new Error('The wallet did not return a sign-in signature. Please try again.');
      const payload = await request('session', { body: { wallet: address, challengeId: challenge.challengeId, signature: signatureResult.signature } });
      if (ticket !== epoch || disposed || currentWallet()?.address !== address) return;
      const session = payload.session;
      if (!session || !text(session.token, 8192) || normalizedAddress(session.wallet) !== address || !Number.isFinite(timestamp(session.expiresAt)) || timestamp(session.expiresAt) <= now()) throw invalidData();
      acceptEnvelope(payload, address);
      state.walletId = wallet.walletId || state.walletId;
      state.session = { version: 1, token: session.token, wallet: address, expiresAt: session.expiresAt, walletId: state.walletId, walletName: wallet.walletName };
      persistSession(state.session);
      state.pickerOpen = false;
      armExpiry();
      setNotice('Signed in. Checking your latest game progress…');
      signedIn = true;
    } catch (error) {
      if (ticket === epoch && !disposed) {
        if (/reject|declin|cancel/i.test(error?.message || '')) setNotice('Sign-in was cancelled. No transaction was submitted and your saved progress is unchanged.');
        else reportError(error);
      }
    } finally {
      if (ticket === epoch && !disposed) { state.busy = null; render(); }
    }
    if (signedIn && ticket === epoch) {
      await refresh();
      if (ticket === epoch && state.session) await checkIn();
    }
  }

  async function connect(walletId) {
    if (state.busy || !bridge) return;
    state.busy = 'connecting';
    state.walletId = walletId;
    setNotice('Connect your wallet and approve one sign-in message. Today’s free check-in will be saved automatically.');
    render();
    try {
      await bridge.connectWallet(walletId);
      if (disposed) return;
      state.wallet = currentWallet();
      if (!state.wallet) throw new Error('The wallet did not share a Sui account. Try connecting again.');
      state.walletId = state.wallet.walletId || walletId;
      state.pickerOpen = false;
      if (savedSession && savedSession.wallet === state.wallet.address && timestamp(savedSession.expiresAt) > now()) {
        state.session = { ...savedSession, walletId: state.walletId, walletName: state.wallet.walletName };
        persistSession(state.session);
        armExpiry();
      } else if (savedSession) persistSession(null);
      setNotice(state.session ? 'Loading your saved Daily Growth progress…' : 'Wallet connected. Sign in to Daily Growth to load your progress.');
    } catch (error) {
      if (!disposed) setNotice(text(error?.message, 500) ? error.message : 'Wallet connection was not completed. Try again.', 'error');
    } finally {
      if (!disposed) { state.busy = null; render(); }
    }
    if (state.session && !disposed) { await loadStatus(); if (state.session) { await refresh(); await checkIn(); } }
    else if (state.wallet && !disposed) await signIn();
  }

  async function signOut() {
    if (state.busy || !state.session) return;
    const token = state.session.token;
    invalidateSession('Signed out of Daily Growth. Your earned progress stays with your wallet.');
    render();
    try { await request('logout', { body: {}, token }); } catch { /* The local session is already removed and the token expires server-side. */ }
  }

  function walletChanged() {
    if (disposed) return;
    // Silent restore resets bridge state before selecting the saved account.
    // That intermediate disconnect must not invalidate its own restore ticket.
    if (restoreInFlight && !currentWallet()) return;
    const previous = state.wallet?.address;
    const actual = currentWallet();
    const expected = state.session?.wallet || previous;
    if (expected && !actual) suspendSession();
    else if ((expected || savedSession?.wallet) && actual && actual.address !== (expected || savedSession.wallet)) invalidateSession('Wallet changed. Sign in again to load this wallet’s progress.');
    state.wallet = actual;
    if (actual?.walletId) state.walletId = actual.walletId;
    if (actual && savedSession && !state.session) { restorePending = true; queueSavedSessionRestore(); }
    render();
  }

  function savedProviderId(session) {
    if (text(session?.walletId, 200)) return session.walletId;
    // Sessions issued before provider IDs were retained still have a wallet name.
    const matching = state.availableWallets.filter((wallet) => wallet.name === session?.walletName);
    return matching.length === 1 ? matching[0].id : null;
  }

  function restoreSavedSession() {
    if (restoreInFlight) return restoreInFlight;
    const candidate = savedSession;
    if (!candidate || state.session || !bridge || disposed) return Promise.resolve(false);
    if (timestamp(candidate.expiresAt) <= now()) { persistSession(null); return Promise.resolve(false); }
    const providerId = savedProviderId(candidate);
    const actual = currentWallet();
    if (actual && actual.address !== candidate.wallet) { persistSession(null); return Promise.resolve(false); }
    if (!actual && (!providerId || !bridge.restoreWallet || !state.availableWallets.some((wallet) => wallet.id === providerId))) return Promise.resolve(false);
    const ticket = epoch;
    restorePending = false;
    restoreInFlight = Promise.resolve().then(async () => {
      if (ticket !== epoch || candidate !== savedSession || disposed) return false;
      if (!actual) {
        try { await bridge.restoreWallet({ id: providerId, address: candidate.wallet }); }
        catch { return false; }
      }
      if (ticket !== epoch || candidate !== savedSession || disposed) return false;
      const restored = currentWallet();
      state.wallet = restored;
      if (timestamp(candidate.expiresAt) <= now()) { persistSession(null); return false; }
      if (!restored || restored.address !== candidate.wallet) return false;
      state.walletId = restored.walletId || providerId;
      state.session = { ...candidate, walletId: state.walletId, walletName: restored.walletName };
      persistSession(state.session);
      armExpiry();
      return true;
    }).finally(() => { restoreInFlight = null; });
    return restoreInFlight;
  }

  function queueSavedSessionRestore() {
    if (!walletInitialized || !restorePending || restoreQueued || restoreInFlight || state.busy || state.session || !savedSession || disposed) return;
    restoreQueued = true;
    const ticket = epoch;
    queueMicrotask(async () => {
      try {
        if (ticket !== epoch || !savedSession || state.busy || state.session || disposed) return;
        restorePending = false;
        state.busy = 'restoring';
        setNotice('Restoring your saved Daily Growth session…');
        render();
        const restored = await restoreSavedSession();
        if (ticket !== epoch || disposed) return;
        state.busy = null;
        if (restored) {
          await loadStatus();
          if (state.session && !disposed) await refresh();
        } else {
          setNotice(state.wallet ? 'Sign in to continue Daily Growth.' : 'Reconnect your saved wallet to continue Daily Growth.');
          render();
        }
      } finally { restoreQueued = false; }
    });
  }

  function updateWallets() {
    if (disposed) return;
    const previousIds = new Set(state.availableWallets.map((wallet) => wallet.id));
    try {
      state.availableWallets = bridge.getAvailableWallets().filter((wallet) => text(wallet.id, 200) && text(wallet.name, 100));
    } catch { state.availableWallets = []; }
    const providerId = savedProviderId(savedSession);
    if (providerId && !previousIds.has(providerId) && state.availableWallets.some((wallet) => wallet.id === providerId)) restorePending = true;
    render();
  }

  async function initializeWallet() {
    try {
      bridge = await loadWallet();
      if (disposed) return;
      state.walletReady = true;
      updateWallets();
      unsubscribeWallet = bridge.subscribeWalletState(walletChanged);
      unsubscribeWallets = bridge.subscribeWallets?.(updateWallets) || (() => {});
      state.wallet = currentWallet();
      if (state.wallet?.walletId) state.walletId = state.wallet.walletId;
      await restoreSavedSession();
    } catch {
      state.walletError = true;
      state.walletReady = false;
    }
    walletInitialized = true;
    render();
  }

  on(ui.connect, 'click', () => {
    if (state.busy || !state.walletReady) return;
    pickerTrigger = ui.connect;
    state.pickerOpen = true;
    render();
  });
  on(ui['wallet-close'], 'click', closePicker);
  on(ui['wallet-picker'], 'cancel', (event) => { event.preventDefault(); closePicker(); });
  on(ui['wallet-picker'], 'close', () => { if (!ui['wallet-picker'].open && state.pickerOpen) closePicker(); });
  on(ui['wallet-picker'], 'click', (event) => {
    if (event.target !== ui['wallet-picker']) return;
    const bounds = ui['wallet-picker'].getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePicker();
  });
  on(ui['wallet-picker'], 'keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closePicker(); return; }
    if (event.key !== 'Tab') return;
    const choices = [...ui['wallet-picker'].querySelectorAll('button:not(:disabled), a[href]')].filter((element) => !element.hidden);
    const first = choices[0], last = choices.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  on(ui['wallet-options'], 'click', (event) => {
    const button = event.target.closest('button[data-wallet-id]');
    if (button && ui['wallet-options'].contains(button)) void connect(button.dataset.walletId);
  });
  on(ui['sign-in'], 'click', () => { void signIn(); });
  on(ui['sign-out'], 'click', () => { void signOut(); });
  on(ui.refresh, 'click', () => { void refresh(); });
  on(ui['check-in'], 'click', () => { void checkIn(); });
  on(ui['check-in-row'], 'click', () => { void checkIn(); });
  on(ui['task-auth'], 'click', () => {
    if (state.busy || state.session) return;
    if (state.wallet) ui['sign-in'].click();
    else { ui.connect.click(); pickerTrigger = ui['task-auth']; }
  });
  on(ui['game-select'], 'change', () => { state.selectedGameId = ui['game-select'].value; render(); });
  on(ui.play, 'click', () => {
    state.launched = true;
    setNotice(state.selectedGameId === TREE_FORCE_ID
      ? 'Start a run and reach the first wave, then refresh here to see your recorded participation. Opening the game link has not awarded a stamp.'
      : 'Finish and save your Garden Battle, then return and refresh before 00:00 UTC. Opening the game link has not awarded a stamp.');
    render();
  });
  on(document, 'click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link || root.contains(link) || event.defaultPrevented) return;
    const game = state.configuration?.eligibleGames.find((game) => game.href === link.href
      || (game.id === TREE_FORCE_ID && link.origin === view.location.origin && link.pathname === '/play/treeforce89/'));
    if (game) state.launched = true;
  });
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus = false) {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    }
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    on(tab, 'click', () => selectTab(tab));
    on(tab, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next], true);
    });
  });
  on(root.querySelector('#growth-campaigns-tab'), 'click', () => void campaigns.refresh());
  function invitationTab() {
    return tabs.find((tab) => tab.id === `growth-${invitationComplete() ? 'badges' : 'today'}-tab`);
  }
  function openInvitation() {
    if (!ui.details.open) {
      ui.details.open = true;
      selectTab(invitationTab(), true);
    }
    syncInvitationExpanded();
  }
  on(ui['badge-preview'], 'click', openInvitation);
  on(ui['invitation-open'], 'click', openInvitation);
  on(ui.details.querySelector('summary'), 'click', () => {
    if (!ui.details.open) selectTab(invitationTab());
  });
  on(ui.details, 'toggle', syncInvitationExpanded);
  on(ui.collapse, 'click', () => {
    ui.details.open = false;
    syncInvitationExpanded();
    ui.details.querySelector('summary').focus({ preventScroll: true });
  });
  function refreshAfterGameReturn() {
    if (disposed) return;
    if (state.session) sessionIsCurrent();
    if (!state.session && savedSession) {
      restorePending = true;
      queueSavedSessionRestore();
      return;
    }
    if (state.session && state.launched && !state.busy) {
      // Consume this launch before the async request: browsers may emit all three
      // return events together, and a failed sync must not become a retry loop.
      state.launched = false;
      void refresh();
    }
  }
  on(root, 'arcade-attendance-recovered', () => { if (!state.busy && state.session) void refresh(); });
  on(view, 'storage', (event) => {
    if (event.key !== SESSION_KEY || event.storageArea !== storage) return;
    if (!event.newValue) {
      invalidateSession('Signed out of Daily Growth in another tab.');
    } else if (!state.session) {
      savedSession = readSession(storage, now());
      restorePending = Boolean(savedSession);
      queueSavedSessionRestore();
    }
  });
  on(view, 'focus', refreshAfterGameReturn);
  on(view, 'pageshow', refreshAfterGameReturn);
  on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') refreshAfterGameReturn(); });

  const ready = (async () => {
    render();
    await initializeWallet();
    if (disposed) return;
    await loadStatus();
    if (state.session && !disposed) await refresh();
  })();
  return {
    ready, refresh, checkIn, signIn, signOut,
    destroy() {
      disposed = true;
      missions.destroy();
      campaigns.destroy();
      if (ui['wallet-picker'].open) ui['wallet-picker'].close();
      epoch += 1;
      view.clearTimeout(expiryTimer);
      for (const controller of requests) controller.abort();
      unsubscribeWallet();
      unsubscribeWallets();
      listeners.forEach((remove) => remove());
    },
  };
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('arcade-daily-growth');
  if (root) createDailyGrowth({ root });
}
