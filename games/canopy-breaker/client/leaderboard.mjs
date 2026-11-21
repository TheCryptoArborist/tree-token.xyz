const $ = id => document.getElementById(id);
const rows = $('leaderboard-rows');
const boardStatus = $('leaderboard-status');
const refreshButton = $('leaderboard-refresh');
const form = $('leaderboard-profile');
const input = $('leaderboard-username');
const saveButton = $('leaderboard-save');
const profileStatus = $('leaderboard-profile-status');
const numbers = new Intl.NumberFormat();
const usernamePattern = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/;
let boardLoading = false, boardLoaded = false, refreshQueued = false;
let api = null, unsubscribe = null, owner = null, profileRevision = 0;
let profileLoading = false, saving = false, scoreTimer = null;

function status(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('is-error', error);
}

function emptyRow(text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.className = 'leaderboard-empty';
  cell.textContent = text;
  row.append(cell);
  rows.replaceChildren(row);
}

function validateBoard(data) {
  if (!data || data.limit !== 20 || !Array.isArray(data.entries) || data.entries.length > 20 ||
      !Number.isFinite(data.updatedAt) || data.entries.some((entry, index) =>
        entry.rank !== index + 1 || typeof entry.username !== 'string' ||
        !usernamePattern.test(entry.username) || !Number.isSafeInteger(entry.score) || entry.score < 0 ||
        !Number.isInteger(entry.level) || entry.level < 1 || entry.level > 30)) {
    throw Error('Invalid leaderboard response');
  }
  return data;
}

function renderBoard(entries) {
  if (!entries.length) {
    emptyRow('No ranked players yet. Choose a username and set the first score.');
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const row = document.createElement('tr');
    const cells = [
      ['leaderboard-rank', String(entry.rank).padStart(2, '0')],
      ['leaderboard-player', entry.username],
      ['leaderboard-score', numbers.format(entry.score)],
      ['leaderboard-grove', String(entry.level).padStart(2, '0') + ' / 30'],
    ];
    for (const [className, text] of cells) {
      const cell = document.createElement('td');
      cell.className = className;
      cell.textContent = text;
      row.append(cell);
    }
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
}

async function refreshBoard({automatic = false} = {}) {
  if (automatic && document.hidden) return;
  if (boardLoading) { refreshQueued = true; return; }
  boardLoading = true;
  refreshButton.disabled = true;
  status(boardStatus, boardLoaded ? 'Refreshing scores…' : 'Loading the leaderboard…');
  try {
    const response = await fetch('./api/leaderboard', {
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Leaderboard request failed');
    const data = validateBoard(await response.json());
    renderBoard(data.entries);
    boardLoaded = true;
    const time = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(new Date(data.updatedAt));
    status(boardStatus, 'Updated ' + time + ' · Best saved scores');
  } catch {
    if (!boardLoaded) emptyRow('The leaderboard is temporarily unavailable. Try Refresh scores.');
    status(boardStatus, boardLoaded ? 'Could not refresh. Your last loaded scores are still shown.' : 'Could not load scores. Please try again.', true);
  } finally {
    boardLoading = false;
    refreshButton.disabled = false;
    if (refreshQueued) {
      refreshQueued = false;
      refreshBoard({automatic: true});
    }
  }
}

function verifiedOwner() {
  const account = api?.account;
  return account && account.expiresAt > Date.now() ? account.address : null;
}

function formState() {
  const disabled = !owner || owner !== verifiedOwner() || profileLoading || saving;
  input.disabled = disabled;
  saveButton.disabled = disabled;
  saveButton.textContent = saving ? 'Saving username…' : 'Save username';
}

async function accountChanged() {
  const nextOwner = verifiedOwner();
  if (nextOwner === owner) { formState(); return; }
  owner = nextOwner;
  const revision = ++profileRevision;
  input.value = '';
  saving = false;
  profileLoading = !!owner;
  formState();
  if (!owner) {
    status(profileStatus, 'Verify your NFTree wallet to choose a username.');
    return;
  }
  status(profileStatus, 'Loading your public username…');
  try {
    const data = await api.request('profile');
    if (revision !== profileRevision || owner !== verifiedOwner()) return;
    if (data.username !== null && (typeof data.username !== 'string' || !usernamePattern.test(data.username))) {
      throw Error('Invalid username response');
    }
    input.value = data.username || '';
    status(profileStatus, data.username ? 'Your public username is ' + data.username + '.' : 'Choose your name. Your best saved score will join the board.');
  } catch {
    if (revision === profileRevision && owner === verifiedOwner()) {
      status(profileStatus, 'Your username could not load. You can still choose a name and save it.', true);
    }
  } finally {
    if (revision === profileRevision) { profileLoading = false; formState(); }
  }
}

function bindSession() {
  if (!window.breakerSession || api === window.breakerSession) return;
  unsubscribe?.();
  api = window.breakerSession;
  owner = null;
  ++profileRevision;
  unsubscribe = api.subscribe(accountChanged);
  accountChanged();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!api || !owner || owner !== verifiedOwner() || saving || profileLoading) return;
  const username = input.value.trim().replace(/\s+/g, ' ');
  if (!usernamePattern.test(username)) {
    status(profileStatus, 'Use 3–20 letters, numbers, spaces, underscores or hyphens, starting with a letter or number.', true);
    input.focus();
    return;
  }
  const revision = profileRevision;
  saving = true;
  formState();
  status(profileStatus, 'Saving your public username…');
  try {
    const data = await api.request('setUsername', {username});
    if (revision !== profileRevision || owner !== verifiedOwner()) return;
    if (typeof data.username !== 'string' || !usernamePattern.test(data.username)) throw Error('Your username could not be confirmed. Please retry.');
    input.value = data.username;
    status(profileStatus, 'Public username saved: ' + data.username + '.');
    refreshBoard();
  } catch (error) {
    if (revision === profileRevision && owner === verifiedOwner()) {
      status(profileStatus, error?.message || 'Your username could not be saved. Please retry.', true);
    }
  } finally {
    if (revision === profileRevision) { saving = false; formState(); }
  }
});

refreshButton.addEventListener('click', () => refreshBoard());
input.addEventListener('focus', () => window.dispatchEvent(new Event('breaker-view-leaderboard')));
for (const link of document.querySelectorAll('.leaderboard-nav,.leaderboard-jump')) {
  link.addEventListener('click', async event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.dispatchEvent(new Event('breaker-view-leaderboard'));
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); }
      catch {
        link.textContent = 'Exit fullscreen first';
        status(boardStatus, 'Exit fullscreen to view the leaderboard.', true);
        return;
      }
    }
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    $('leaderboard').scrollIntoView({block: 'start', behavior});
    $('leaderboard-title').focus({preventScroll: true});
  });
}
window.addEventListener('breaker-ready', bindSession);
window.addEventListener('breaker-score-saved', () => {
  clearTimeout(scoreTimer);
  scoreTimer = setTimeout(() => refreshBoard({automatic: true}), 750);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { accountChanged(); refreshBoard({automatic: true}); }
});
setInterval(() => refreshBoard({automatic: true}), 30000);
bindSession();
refreshBoard();
