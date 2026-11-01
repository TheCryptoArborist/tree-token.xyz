// Daily Growth has its own message-only wallet session. Opening a game link never grants credit.
const API_PATH = '/api/arcade-growth';
const WALLET_MODULE = '/assets/arcade/arcade-growth-wallet.js';
const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const AUTH_ERRORS = new Set(['authentication-required', 'invalid-session', 'expired-session']);
const TREE_FORCE_ID = 'treeforce89';
// These preview labels describe existing goals, never a player's earned progress.
const MILESTONE_GOALS = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
];
// Existing TREE ecosystem artwork, already published with the arcade.
const GROWTH_ART = {
  seedling: '/assets/arcade/garden-bot-poster.webp',
  sapling: '/assets/arcade/arboretum-poster.webp',
  'deep-roots': '/assets/profile-nftree-art.jpg',
  'full-canopy': '/assets/tree-command-logo-v2-512.png',
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
    try { storage = view.sessionStorage; } catch { storage = null; }
  }
  const byId = (id) => root.querySelector(`#growth-${id}`);
  const ui = Object.fromEntries([
    'meta', 'season-tag', 'wallet-state', 'auth-note', 'connect', 'sign-in', 'sign-out', 'wallet-picker', 'wallet-options', 'wallet-close', 'wallet-status', 'no-wallet',
    'quest-state', 'quest-rule', 'pick-label', 'game-name', 'objective', 'game-access', 'play', 'refresh', 'alternative', 'game-select',
    'quest-note', 'visit-count', 'visit-label', 'check-note', 'check-in', 'passport-count', 'passport-note', 'stamps',
    'passport-reward', 'passport-optional', 'optional-stamps', 'tracking-note', 'month-empty', 'month-content', 'month-visits', 'month-quests', 'next', 'calendar', 'milestones',
    'badges-empty', 'badges', 'status', 'journey-note', 'journey-stops', 'quest-meter', 'attendance-ring', 'visit-total', 'attendance-next', 'attendance-meter', 'passport-meter',
    'summary-count', 'summary-label', 'summary-note', 'summary-meter', 'summary-art', 'summary-art-label', 'quest-art',
    'badge-preview', 'invitation-open', 'invitation-title', 'invitation-hint', 'details', 'details-label', 'details-hint',
  ].map((id) => [id, byId(id)]));
  const state = {
    wallet: null, walletId: null, walletReady: false, walletError: false, session: null, progress: null,
    configuration: null, dateKey: null, monthKey: null, busy: 'loading', stale: false,
    selectedGameId: null, notice: 'Loading Daily Growth…', noticeKind: '', pickerOpen: false,
    availableWallets: [], apiUnavailable: false, launched: false,
  };
  let bridge = null;
  let epoch = 0;
  let disposed = false;
  let expiryTimer = null;
  let savedSession = readSession(storage, now());
  let unsubscribeWallet = () => {};
  let unsubscribeWallets = () => {};
  let pickerTrigger = null;
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
    image.src = GROWTH_ART[name] || GROWTH_ART['full-canopy'];
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
    ui['journey-stops'].replaceChildren();
    ui['journey-note'].textContent = progress
      ? state.stale ? 'Last saved progress · Refresh to check for updates.'
        : next ? `${next.target - progress.checkedInDays} more check-in${next.target - progress.checkedInDays === 1 ? '' : 's'} to ${next.label}. Keep growing.`
          : 'All attendance badges earned this month. Keep your canopy growing.'
      : state.apiUnavailable ? 'Progress unavailable · Your saved badges are safe.' : 'Your goals for the month. Sign in to reveal your progress.';
    for (const milestone of milestones) {
      const item = append(ui['journey-stops'], 'div', `growth-stop${!progress ? ' is-preview' : milestone.earned ? ' is-done' : milestone === next ? ' is-next' : ''}`);
      item.dataset.rank = Object.hasOwn(GROWTH_ART, milestone.id) ? milestone.id : 'seedling';
      emblem(item, milestone.id, 'growth-stop-icon');
      const copy = append(item, 'div', 'growth-stop-copy');
      append(copy, 'strong', '', milestone.label);
      append(copy, 'span', '', `${milestone.target} check-ins${progress && milestone.earned ? ' · Earned ✓' : progress && milestone === next ? ' · Up next' : ''}`);
    }
  }

  function currentWallet() {
    try {
      const wallet = bridge?.getWalletState();
      const address = normalizedAddress(wallet?.address);
      return wallet?.connected && address ? { address, walletName: wallet.walletName || 'Sui wallet' } : null;
    } catch { return null; }
  }

  function persistSession(session) {
    savedSession = session;
    try {
      if (session) storage?.setItem(SESSION_KEY, JSON.stringify(session));
      else storage?.removeItem(SESSION_KEY);
    } catch { /* Storage is optional; no progress or completion is stored in the browser. */ }
  }

  function invalidateSession(message = '') {
    epoch += 1;
    for (const controller of requests) controller.abort();
    requests.clear();
    view.clearTimeout(expiryTimer);
    state.session = null;
    state.progress = null;
    state.stale = false;
    state.busy = null;
    state.notice = message;
    state.noticeKind = '';
    persistSession(null);
    render();
  }

  function armExpiry() {
    view.clearTimeout(expiryTimer);
    if (!state.session) return;
    expiryTimer = view.setTimeout(() => {
      invalidateSession('Your Daily Growth session has expired. Sign in again to see your saved progress.');
      render();
    }, Math.max(0, timestamp(state.session.expiresAt) - now()));
  }

  function sessionIsCurrent() {
    if (!state.session) return false;
    const actual = currentWallet();
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
    ui.calendar.setAttribute('aria-label', `${monthLabel(progress.monthKey)} attendance and daily quests`);
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
      cell.setAttribute('aria-label', `${dateLabel(day.dateKey)}: ${description}`);
      if (isToday) cell.setAttribute('aria-current', 'date');
      append(cell, 'strong', '', String(Number(day.dateKey.slice(-2)))).setAttribute('aria-hidden', 'true');
      append(cell, 'span', '', day.questCompleted ? '✓ ★' : day.checkedIn ? '✓' : isToday ? '○' : day.dateKey < progress.dateKey ? '–' : '·').setAttribute('aria-hidden', 'true');
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
    const allEarned = Boolean(progress?.milestones.length && progress.milestones.every((milestone) => milestone.earned));
    const remaining = next ? next.target - progress.checkedInDays : null;
    const complete = invitationComplete();
    const unknown = state.apiUnavailable ? 'Progress unavailable' : 'Sign in to view badge progress';
    ui['summary-art'].src = GROWTH_ART[badge?.id] || GROWTH_ART.seedling;
    ui['summary-art-label'].textContent = badge?.label || 'Monthly badges';
    ui['badge-preview'].classList.toggle('is-preview', !progress);
    ui['badge-preview'].classList.toggle('is-complete', Boolean(progress && badge?.earned));
    ui['summary-count'].textContent = progress
      ? next ? `${remaining === 1 ? 'One more check-in' : `${remaining} more check-ins`} to ${next.label}`
        : allEarned ? 'All attendance badges earned.' : 'Keep your growth going.'
      : state.apiUnavailable ? 'Your badges will be here.' : 'Your first badge starts here.';
    ui['summary-label'].textContent = progress
      ? `${badge ? `${Math.min(progress.checkedInDays, badge.target)} / ${badge.target} check-ins` : `${progress.checkedInDays} check-ins this month`}${lastSaved ? ' · Last saved' : ''}`
      : state.apiUnavailable ? 'Progress temporarily unavailable' : `${badge.label} · ${badge.target} check-ins to earn`;
    ui['summary-meter'].hidden = !progress || !badge;
    meter(ui['summary-meter'], progress?.checkedInDays, progress ? badge?.target : null, progress && badge
      ? `${Math.min(progress.checkedInDays, badge.target)} of ${badge.target} check-ins toward ${badge.label}${lastSaved && !state.stale ? ' · Last saved progress' : ''}`
      : unknown);
    ui['badge-preview'].setAttribute('aria-label', `${ui['summary-count'].textContent} ${ui['summary-label'].textContent}. ${complete ? 'View badge progress' : 'Reveal today’s quest'}.`);
    ui['invitation-title'].textContent = lastSaved ? 'Let’s catch up on your growth.'
      : !progress ? 'What will you grow today?'
        : complete ? 'Today’s growth is complete.'
          : progress.today.checkedIn ? 'You’re checked in. Quest time?' : 'Make today count.';
    ui['summary-note'].textContent = lastSaved
      ? refreshing ? 'Checking your latest growth. Last saved progress is shown.' : 'Last saved progress is shown. Open your quests to refresh.'
      : state.apiUnavailable ? 'We couldn’t load Daily Growth. Please try again shortly.'
        : !progress ? 'Check in, discover today’s quest, and collect badges.'
          : complete ? 'Your check-in and quest are saved. Explore your badges.'
            : progress.today.checkedIn ? 'Your check-in is saved. Discover today’s quest and keep growing.'
              : 'Check in now, then discover today’s quest.';
    ui['invitation-hint'].textContent = lastSaved ? 'Last saved progress · Refresh to check today.'
      : refreshing ? 'Loading your growth…'
      : state.apiUnavailable ? 'Your saved progress has not changed.'
        : state.busy === 'checking-in' ? 'Saving your check-in. Your quest stays optional.'
          : !state.session ? state.wallet ? 'Sign in with a message · No gas fee' : 'Free check-in · No gas fee'
            : !progress ? 'Loading your saved progress…'
              : complete ? 'Check-in and quest saved · Come back tomorrow.'
                : progress.today.checkedIn ? 'Check-in saved · Today’s quest is optional.' : 'Free check-in · No game required';
    ui['details-label'].textContent = complete ? 'View badge progress' : 'Reveal today’s quest';
    ui['details-hint'].textContent = lastSaved ? 'Last saved progress · Refresh inside'
      : complete ? `${next ? 'Your next badge' : 'Earned badges'} · Monthly calendar · Arcade Passport` : 'Quests · Badges · Arcade Passport';
    syncInvitationExpanded();
  }

  function renderProgress() {
    const progress = state.progress;
    const unavailable = state.apiUnavailable || state.stale;
    const next = progress?.milestones.find((milestone) => !milestone.earned && milestone.target > progress.checkedInDays);
    const finalMilestone = progress?.milestones.at(-1);
    const attendanceTarget = next || finalMilestone;
    const unknown = unavailable ? 'Progress unavailable' : 'Sign in to view progress';
    renderInvitation(progress);
    renderJourney(progress);
    ui['visit-count'].textContent = progress ? String(progress.checkedInDays) : '—';
    ui['visit-total'].textContent = progress ? `/ ${progress.calendar.length} days` : 'days checked in';
    ui['visit-label'].textContent = state.stale ? 'check-ins · last saved progress' : 'check-ins this month';
    ui['attendance-next'].textContent = progress
      ? next ? `${next.target - progress.checkedInDays} more to ${next.label}` : finalMilestone ? 'Full canopy unlocked ✓' : 'Check in and keep growing'
      : unavailable ? 'Your saved progress is safe' : 'Your next badge awaits';
    meter(ui['attendance-ring'], progress?.checkedInDays, progress?.calendar.length, progress ? `${progress.checkedInDays} of ${progress.calendar.length} days checked in this month` : unknown);
    meter(ui['attendance-meter'], progress?.checkedInDays, attendanceTarget?.target, progress && attendanceTarget ? `${Math.min(progress.checkedInDays, attendanceTarget.target)} of ${attendanceTarget.target} check-ins toward ${attendanceTarget.label}` : unknown);
    meter(ui['quest-meter'], progress ? Number(progress.today.questCompleted) : null, 1, progress ? `${Number(progress.today.questCompleted)} of 1 daily quests complete` : unknown);
    meter(ui['passport-meter'], progress?.passport.completedGameIds.length, progress?.passport.enabledGames.length, progress ? `${progress.passport.completedGameIds.length} of ${progress.passport.enabledGames.length} required Passport games` : unknown);
    root.querySelector('.growth-quest').classList.toggle('is-complete', Boolean(progress?.today.questCompleted));
    ui['month-content'].hidden = !progress;
    ui['month-empty'].hidden = Boolean(progress);
    ui['month-empty'].textContent = unavailable ? 'Your monthly calendar is unavailable. Refresh to try again.' : 'Sign in to see your real monthly calendar.';
    ui['check-in'].hidden = !state.session;
    ui['check-in'].disabled = Boolean(state.busy) || !state.session || !progress || progress.today.checkedIn;
    ui['check-in'].textContent = state.busy === 'checking-in' ? 'Saving check-in…' : progress?.today.checkedIn ? 'Checked in today ✓' : 'Check in today';
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
      ? `${monthLabel(progress.monthKey)} · Complete the listed required games for this optional monthly goal. Paid PvP is not required for check-ins or daily quests.`
      : 'Explore eligible games at your own pace this month. The passport is an optional goal.';
    ui['passport-reward'].textContent = '';
    ui['badges-empty'].hidden = Boolean(progress?.badges.length);
    ui['badges-empty'].textContent = progress
      ? 'No badges earned yet. Check in on different days or complete your monthly passport to grow your collection.'
      : unavailable ? 'Earned badges are unavailable. Refresh to try again.' : 'Sign in to see your earned monthly badges.';
    if (!progress) {
      ui.calendar.replaceChildren();
      return;
    }
    ui['month-visits'].textContent = String(progress.checkedInDays);
    ui['month-quests'].textContent = String(progress.questDays);
    ui.next.textContent = next ? `Next: ${next.label} · ${next.target - progress.checkedInDays} more check-in${next.target - progress.checkedInDays === 1 ? '' : 's'}` : 'All monthly attendance milestones earned.';
    for (const game of progress.passport.enabledGames) {
      const complete = progress.passport.completedGameIds.includes(game.id);
      const stamp = append(ui.stamps, 'div', `growth-stamp${complete ? ' is-done' : ''}`);
      emblem(stamp, game.id, 'growth-stamp-icon');
      append(stamp, 'strong', '', game.label);
      append(stamp, 'span', '', complete ? '✓ Stamp earned' : game.id === 'pvp' ? '○ Not yet played · Paid entry' : '○ Not yet played');
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
      : progress.passport.enabledGames.length ? 'All required stamps earn the monthly Arcade Passport badge. Optional stamps do not change the requirement.' : 'Passport games will appear when verified tracking is available.';
    for (const milestone of progress.milestones) {
      const item = append(ui.milestones, 'div', `growth-milestone${milestone.earned ? ' is-done' : ''}`);
      item.dataset.rank = Object.hasOwn(GROWTH_ART, milestone.id) ? milestone.id : 'seedling';
      emblem(item, milestone.id, 'growth-badge-emblem');
      append(item, 'strong', '', `${milestone.label}${milestone.earned ? ' ✓' : ''}`);
      append(item, 'span', '', `${milestone.target} check-ins`);
      const bar = append(item, 'div', 'growth-meter');
      append(bar, 'span');
      meter(bar, progress.checkedInDays, milestone.target, `${Math.min(progress.checkedInDays, milestone.target)} of ${milestone.target} check-ins toward ${milestone.label}`);
    }
    for (const badge of [...progress.badges].sort((a, b) => timestamp(b.earnedAt) - timestamp(a.earnedAt))) {
      const item = append(ui.badges, 'div', 'growth-badge');
      const rank = [...MILESTONE_GOALS.map((goal) => goal.id), 'arcade-passport'].find((id) => badge.id === id || badge.id.endsWith(`-${id}`)) || 'seedling';
      item.dataset.rank = rank;
      emblem(item, rank, 'growth-badge-emblem');
      const copy = append(item, 'div', 'growth-badge-copy');
      append(copy, 'strong', '', badge.label);
      append(copy, 'span', '', 'Earned ✓');
      append(copy, 'p', '', `${monthLabel(badge.monthKey)} · Saved to this wallet’s progress`);
    }
    renderCalendar(progress);
  }

  function render() {
    if (disposed) return;
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
    ui['auth-note'].textContent = state.session
      ? 'Your progress belongs to this wallet. Sessions expire after one hour.'
      : state.walletError ? 'Wallet connection is unavailable. Refresh the page to try again.'
        : 'Sign-in uses a wallet message. It does not submit a transaction.';
    ui.connect.disabled = busy || !state.walletReady;
    ui.connect.hidden = Boolean(state.session);
    ui.connect.classList.toggle('growth-primary', !state.wallet);
    ui.connect.classList.toggle('growth-secondary', Boolean(state.wallet));
    ui.connect.textContent = state.busy === 'connecting' ? 'Connecting…' : state.wallet ? 'Change wallet' : 'Connect to check in';
    ui['sign-in'].hidden = !state.wallet || Boolean(state.session);
    ui['sign-in'].disabled = busy;
    ui['sign-in'].textContent = state.busy === 'signing-in' ? 'Approve message in wallet…' : 'Sign in to check in';
    ui['sign-out'].hidden = !state.session;
    ui['sign-out'].disabled = busy;
    renderPicker();
    const games = state.configuration?.eligibleGames || [];
    const treeForceEnabled = games.some((game) => game.id === TREE_FORCE_ID);
    const gardenOnly = games.length === 3 && ['garden-bot', 'pvp', 'arborist-trials'].every((id) => games.some((game) => game.id === id));
    ui['tracking-note'].hidden = !treeForceEnabled && !gardenOnly;
    ui['tracking-note'].textContent = treeForceEnabled
      ? 'TREE FORCE ’89 earns an optional participation stamp. This month’s required Passport games stay the same.'
      : 'TREE FORCE ’89 is live; Daily Growth tracking is coming soon.';
    ui['quest-rule'].textContent = treeForceEnabled
      ? 'Start one run of TREE FORCE ’89, or finish an eligible Garden Battle.'
      : 'Finish an eligible Garden Battle. Win or lose, it counts.';
    const selected = games.find((game) => game.id === state.selectedGameId);
    const done = state.progress?.today.questCompleted;
    ui['quest-state'].textContent = state.progress ? done ? '1 / 1 · Quest complete ✓' : '0 / 1 · Not completed' : state.apiUnavailable ? 'Progress unavailable' : state.configuration ? 'Sign in to save progress' : 'Checking availability…';
    ui['quest-state'].classList.toggle('is-done', Boolean(done));
    ui['pick-label'].textContent = selected?.id === state.configuration?.todayPick?.id ? 'Today’s pick:' : 'Your choice:';
    ui['game-name'].textContent = selected?.label || (state.apiUnavailable ? 'Eligible games unavailable' : state.configuration ? 'No eligible games right now' : 'Checking eligible games…');
    ui['quest-art'].src = GROWTH_ART[selected?.id] || GROWTH_ART['full-canopy'];
    const copy = selected ? GAME_COPY[selected.id] : null;
    ui.objective.textContent = copy?.objective || 'Follow the selected game’s participation rule, then refresh your progress here.';
    ui['game-access'].textContent = copy?.access || (selected ? 'Check this game’s access and result-saving requirements before playing.' : '');
    ui.play.hidden = !selected;
    if (selected) {
      ui.play.href = selected.href;
      ui.play.textContent = `Play ${selected.label} ↗`;
      ui.play.setAttribute('aria-label', `Play ${selected.label} (opens in a new tab)`);
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
        ? 'Today’s quest is saved and you’re checked in. TREE FORCE participation is optional for the monthly Passport.'
        : 'Participation is saved when your first wave starts. Refresh here to see it. One quest per UTC day; opening the link alone does not count.'
      : done
        ? 'Today’s quest is saved and you’re checked in. Refresh other completed Garden Battles before 00:00 UTC to add required passport stamps.'
        : 'Complete the game and refresh before 00:00 UTC to earn that day’s quest and passport stamps. Opening a game alone does not count.';
    ui.status.textContent = state.notice;
    ui.status.className = `growth-status${state.noticeKind ? ` is-${state.noticeKind}` : ''}`;
    renderProgress();
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
    if (signedIn && ticket === epoch) await refresh();
  }

  async function connect(walletId) {
    if (state.busy || !bridge) return;
    state.busy = 'connecting';
    state.walletId = walletId;
    setNotice('Connect your NFTree wallet, then sign in with a message to load your progress.');
    render();
    try {
      await bridge.connectWallet(walletId);
      if (disposed) return;
      state.wallet = currentWallet();
      if (!state.wallet) throw new Error('The wallet did not share a Sui account. Try connecting again.');
      state.pickerOpen = false;
      if (savedSession && savedSession.wallet === state.wallet.address && timestamp(savedSession.expiresAt) > now()) {
        state.session = savedSession;
        armExpiry();
      } else if (savedSession) persistSession(null);
      setNotice(state.session ? 'Loading your saved Daily Growth progress…' : 'Wallet connected. Sign in to Daily Growth to load your progress.');
    } catch (error) {
      if (!disposed) setNotice(text(error?.message, 500) ? error.message : 'Wallet connection was not completed. Try again.', 'error');
    } finally {
      if (!disposed) { state.busy = null; render(); }
    }
    if (state.session && !disposed) { await loadStatus(); if (state.session) await refresh(); }
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
    const previous = state.wallet?.address;
    const actual = currentWallet();
    const expected = state.session?.wallet || previous;
    if (expected && actual?.address !== expected) invalidateSession('Wallet changed. Sign in again to load this wallet’s progress.');
    state.wallet = actual;
    render();
  }

  function updateWallets() {
    if (disposed) return;
    try {
      state.availableWallets = bridge.getAvailableWallets().filter((wallet) => text(wallet.id, 200) && text(wallet.name, 100));
    } catch { state.availableWallets = []; }
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
      if (savedSession && !state.wallet && bridge.restoreWallet && savedSession.walletId) {
        try { await bridge.restoreWallet({ id: savedSession.walletId, address: savedSession.wallet }); } catch { /* Restore is silent; reconnect remains explicit. */ }
        if (disposed) return;
        state.wallet = currentWallet();
      }
      if (savedSession && state.wallet?.address === savedSession.wallet && timestamp(savedSession.expiresAt) > now()) {
        state.session = savedSession;
        armExpiry();
      } else if (state.wallet && savedSession) persistSession(null);
    } catch {
      state.walletError = true;
      state.walletReady = false;
    }
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
  on(ui['game-select'], 'change', () => { state.selectedGameId = ui['game-select'].value; render(); });
  on(ui.play, 'click', () => {
    state.launched = true;
    setNotice(state.selectedGameId === TREE_FORCE_ID
      ? 'Start a run and reach the first wave, then refresh here to see your recorded participation. Opening the game link has not awarded a stamp.'
      : 'Finish and save your Garden Battle, then return and refresh before 00:00 UTC. Opening the game link has not awarded a stamp.');
    render();
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
  on(view, 'focus', () => {
    if (state.session && !sessionIsCurrent()) return;
    if (state.session && state.launched && !state.busy) {
      setNotice(state.selectedGameId === TREE_FORCE_ID
        ? 'Back from TREE FORCE? Refresh here to see your recorded first-wave participation.'
        : 'Back from a Garden Battle? Refresh before 00:00 UTC to verify today’s result.');
      render();
    }
  });

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
