import { mountAdventGrove } from './arcade-advent-grove.js';
// A presentation of verified attendance. This module never signs, pays, or awards credit.
const DAY = 86400000;
const mounted = new WeakMap();
const address = value => typeof value === 'string' && /^0x[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
const dateNumber = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const n = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : NaN;
};
const dateKey = value => new Date(value).toISOString().slice(0, 10);
const monthName = value => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(value));
const dayName = value => new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
const utc = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';

export function normalizeAttendance(progress) {
  const fail = () => { throw new Error('Attendance is not a complete, consistent monthly snapshot.'); };
  const wallet = address(progress?.wallet), start = dateNumber(progress?.dateKey);
  if (!wallet || !Number.isFinite(start) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(progress?.monthKey || '')
    || progress.dateKey.slice(0, 7) !== progress.monthKey) return fail();
  const a = progress.attendance;
  const day = Number(progress.dateKey.slice(-2)), first = dateNumber(progress.monthKey + '-01');
  if (!a || !Number.isSafeInteger(a.checkedInDays) || a.checkedInDays < 0 || a.checkedInDays > day
    || !Number.isSafeInteger(a.streak) || a.streak < 0 || !Array.isArray(a.missedDates) || !Array.isArray(a.recoveredDates)) return fail();
  for (const list of [a.missedDates, a.recoveredDates]) {
    if (list.length > 31 || new Set(list).size !== list.length
      || list.some(d => !Number.isFinite(dateNumber(d)) || dateNumber(d) < first || dateNumber(d) >= start)) return fail();
  }
  const missed = new Set(a.missedDates), saved = [];
  for (let n = first; n < start; n += DAY) if (!missed.has(dateKey(n))) saved.push(dateKey(n));
  const today = a.checkedInDays - saved.length;
  if (today !== 0 && today !== 1) return fail();
  if (today) saved.push(progress.dateKey);
  const savedSet = new Set(saved);
  if (a.recoveredDates.some(d => !savedSet.has(d))) return fail();
  let anchor = start - (today ? 0 : DAY), localRun = 0;
  while (anchor >= first && savedSet.has(dateKey(anchor))) { localRun++; anchor -= DAY; }
  if ((anchor >= first && a.streak !== localRun) || (anchor < first && a.streak < localRun)) return fail();
  return {
    wallet, dateKey: progress.dateKey, monthKey: progress.monthKey, dayStart: start,
    resetAt: start + DAY, streakExpiresAt: a.streak ? start + (today ? 2 : 1) * DAY : null,
    checkedInDays: a.checkedInDays, streak: a.streak, todayChecked: Boolean(today),
    checkedDates: saved, recoveredDates: [...a.recoveredDates].sort(), missedDates: [...a.missedDates].sort(),
  };
}

export function attendanceCountdown(snapshot, serverNow) {
  if (!Number.isFinite(serverNow) || serverNow < snapshot.dayStart || serverNow >= snapshot.resetAt) return null;
  return {
    label: snapshot.todayChecked ? 'Next check-in opens in' : snapshot.streak ? 'Keep your streak · check in within' : 'Today’s check-in closes in',
    remaining: snapshot.resetAt - serverNow,
    streakRemaining: snapshot.streakExpiresAt === null ? null : snapshot.streakExpiresAt - serverNow,
    deadline: snapshot.streakExpiresAt,
  };
}
const duration = ms => {
  const n = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
};

function position(date) {
  const day = Number(date.slice(-2)) - 1, row = Math.min(2, Math.floor(day / 11)), col = day % 11;
  return { x: 25 + col * 49 + (row === 1 ? 13 : 0), y: 91 + row * 31, scale: .62 + row * .17 };
}
function tree(date, { small = false, recovered = false, planted = false, autumn = false } = {}) {
  const p = position(date);
  if (autumn) {
    const width = small ? 34 : 50, height = small ? 56 : 84;
    return '<g data-forest-tree data-date="' + date + '" data-forest-stage="' + (small ? 'sapling' : 'mature') + '" class="forest-tree' + (planted ? ' is-planted' : '') + '" transform="translate(' + p.x + ' ' + p.y + ') scale(' + p.scale + ')">'
      + '<g class="forest-tree-growth"><ellipse cy="1" rx="' + (small ? 12 : 20) + '" ry="4" fill="#23151e" opacity=".5"/>'
      + '<image href="/assets/arcade-seasonal/november-emblem-tree.png" x="' + (-width / 2) + '" y="' + (2 - height) + '" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMax meet"/>'
      + (recovered ? '<title>' + dayName(date) + ' check-in restored</title>' : '') + '</g></g>';
  }
  const crown = small
    ? '<path d="M0-15C-18-35-25-15-2-12C1-36 21-34 13-21C9-16 5-14 0-15Z" fill="#b6e578"/><path d="M0-14L-8-22M0-15L10-24" stroke="#6caa66" stroke-width="2"/>'
    : '<path d="M-6-31C-33-19-41-41-27-53C-36-68-15-78-5-68C3-91 30-75 25-59C47-57 41-33 23-33C14-19 6-22-6-31Z" fill="#377e68"/><path d="M-23-53C-29-66-13-72-4-64C6-82 27-69 20-57C34-55 32-40 20-40C12-28 4-31-5-38C-22-27-32-41-23-53Z" fill="#6ab775"/><path d="M-4-61C1-73 20-67 14-57C27-53 19-41 9-44C0-32-16-42-11-50C-24-56-13-66-4-61Z" fill="#a5d879"/>';
  return '<g data-forest-tree data-date="' + date + '" class="forest-tree' + (planted ? ' is-planted' : '') + '" transform="translate(' + p.x + ' ' + p.y + ') scale(' + p.scale + ')">'
    + '<g class="forest-tree-growth"><ellipse cy="1" rx="20" ry="5" fill="#061d1a" opacity=".55"/>'
    + '<path d="M-4 0L-3-' + (small ? 16 : 39) + 'L3-' + (small ? 16 : 39) + 'L5 0Z" fill="#a37b47"/>'
    + (small ? '' : '<path d="M0-25L-13-43M1-19L14-40" fill="none" stroke="#b18a50" stroke-width="3"/>')
    + crown + '<path d="M-9 2L-4-4M9 2L12-3" stroke="#7ba85c" stroke-width="2"/>'
    + (recovered ? '<title>' + dayName(date) + ' check-in restored</title>' : '') + '</g></g>';
}
function embers(date, extinguishing = false) {
  const p = position(date);
  return '<g data-forest-embers class="forest-embers' + (extinguishing ? ' is-extinguishing' : '') + '" transform="translate(' + p.x + ' ' + p.y + ')">'
    + '<ellipse rx="28" ry="8" fill="#a4522f" opacity=".35"/><path d="M-11 1L-8-19L-4-20L-3-5L8-17L11-14L4-2Z" fill="#504136"/>'
    + '<path d="M-17-2C-28-15-7-23-12-35C5-24-3-18 6-25C18-9 10 2-1 2Z" fill="#e78b3e"/>'
    + '<path d="M-9-1C-16-10-3-15-5-23C7-12 4-7 8-5C5 3-2 5-9-1Z" fill="#f5cf68"/></g>';
}
function scene(snapshot, { paused, rain, planted, rainWasPaused, rainDate, empty } = {}) {
  const autumn = Boolean(snapshot?.monthKey.endsWith('-11'));
  const colors = autumn
    ? { sky: '#302133', horizon: '#895738', ground: '#95603e', groundShade: '#44302c', moon: '#f5d7a0', moonShade: '#4a313a', stars: '#efd6ae', hills: '#654141', middle: '#744c35', front: '#49312b' }
    : { sky: '#102e32', horizon: '#1b493d', ground: '#3a6850', groundShade: '#173e32', moon: '#e6d98c', moonShade: '#163738', stars: '#bddebb', hills: '#274b43', middle: '#23503b', front: '#173c2e' };
  let art = '<svg data-forest-scene data-forest-season="' + (autumn ? 'autumn' : 'evergreen') + '" viewBox="0 0 560 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
    + '<defs><linearGradient id="forest-sky" x2="0" y2="1"><stop stop-color="' + colors.sky + '"/><stop offset="1" stop-color="' + colors.horizon + '"/></linearGradient>'
    + '<linearGradient id="forest-ground" x2="0" y2="1"><stop stop-color="' + colors.ground + '"/><stop offset="1" stop-color="' + colors.groundShade + '"/></linearGradient></defs>'
    + '<rect width="560" height="180" rx="14" fill="url(#forest-sky)"/>'
    + '<circle cx="473" cy="37" r="18" fill="' + colors.moon + '" opacity=".75"/><circle cx="466" cy="31" r="17" fill="' + colors.moonShade + '"/>'
    + '<g fill="' + colors.stars + '" opacity=".55"><circle cx="49" cy="25" r="1.4"/><circle cx="155" cy="15" r="1"/><circle cx="268" cy="32" r="1.3"/><circle cx="383" cy="17" r="1"/><circle cx="530" cy="49" r="1.4"/></g>'
    + '<path d="M0 89Q65 31 126 76Q193 29 273 72Q350 35 409 76Q494 35 560 82V180H0Z" fill="' + colors.hills + '"/>'
    + '<path d="M0 112Q93 69 178 105Q276 73 374 110Q472 75 560 103V180H0Z" fill="url(#forest-ground)"/>'
    + '<path d="M0 151Q90 113 180 145Q280 112 376 146Q477 121 560 142V180H0Z" fill="' + colors.middle + '"/>'
    + '<path d="M0 171Q134 142 248 169Q383 144 560 164V180H0Z" fill="' + colors.front + '"/>';
  if (autumn) {
    art += '<g data-forest-leaf-litter opacity=".65">';
    for (let i = 0; i < 20; i++) {
      const x = 16 + (i * 83) % 524, y = 126 + (i * 17) % 49;
      art += '<path d="M0 0Q2-6 8-3Q6 3 0 0Z" fill="' + ['#dfab51', '#bf6b3f', '#8c3f48'][i % 3] + '" transform="translate(' + x + ' ' + y + ') rotate(' + ((i * 37) % 180) + ')"/>';
    }
    art += '</g>';
  }
  if (snapshot) for (const date of snapshot.checkedDates) art += tree(date, {
    small: date === snapshot.dateKey || date === rainDate,
    recovered: snapshot.recoveredDates.includes(date), planted: date === planted, autumn,
  });
  if (paused) art += embers(snapshot.missedDates.at(-1) || snapshot.dateKey);
  if (rain && rainWasPaused && !paused) art += embers(rainDate || snapshot.dateKey, true);
  if (empty) art += '<g opacity=".65"><path d="M265 142Q280 126 295 142" fill="#8b7754"/><path d="M280 136V121M280 126Q265 111 268 123Q271 130 280 128M280 123Q295 105 294 119Q290 126 280 125" fill="#9dc880" stroke="#9dc880" stroke-width="2"/></g>';
  if (rain) {
    art += '<g class="forest-rain"><path d="M34 29Q42 12 59 18Q71 1 89 19Q110 14 119 33H34Z" fill="#92b8bc" opacity=".55"/>';
    for (let i = 0; i < 36; i++) {
      const x = 13 + (i * 47) % 539, y = (i * 31) % 144;
      art += '<path d="M' + x + ' ' + y + 'l-6 14" stroke="#9de9ed" stroke-width="2" opacity=".75" style="animation-delay:-' + (i % 7) * .1 + 's"/>';
    }
    art += '</g>';
  }
  return art + '</svg>';
}

export function mountAttendanceForest({ root, now } = {}) {
  if (!root) return null;
  if (mounted.has(root)) return mounted.get(root);
  const doc = root.ownerDocument, view = doc.defaultView;
  const monotonic = now || (() => view.performance.now());
  const daily = doc.getElementById('growth-today-panel');
  if (!daily) return null;
  const card = doc.createElement('section');
  card.id = 'arcade-attendance-forest'; card.className = 'arcade-attendance-forest';
  card.setAttribute('aria-labelledby', 'attendance-forest-title');
  card.innerHTML = '<div class="forest-copy"><p class="growth-eyebrow">SHOW UP. GROW SOMETHING.</p><h3 id="attendance-forest-title">Your check-in grove</h3>'
    + '<div class="forest-metrics"><div><strong data-forest-count>—</strong><span>Check-ins this month</span></div><div><strong data-forest-streak>—</strong><span>Current streak</span></div></div>'
    + '<div class="forest-clock"><span data-forest-timer-label>Sign in to see your grove</span><strong data-forest-timer>—</strong></div>'
    + '<p data-forest-deadline class="forest-deadline"></p></div>'
    + '<div class="forest-landscape"><div class="forest-art"></div><p class="forest-caption">One tree for each saved check-in this month.</p></div>'
    + '<div class="forest-footer"><p data-forest-status role="status" aria-live="polite">Your saved progress belongs to your wallet.</p><button type="button" data-forest-recover hidden>Review missed days <span aria-hidden="true">→</span></button></div>';
  const status = doc.getElementById('growth-status');
  const masthead = daily.querySelector('.arcade-daily-masthead');
  if (status?.parentElement === daily) status.after(card); else if (masthead) masthead.after(card); else daily.prepend(card);
  const advent = mountAdventGrove({ card, doc });
  const get = name => card.querySelector('[data-forest-' + name + ']');
  let wallet = null, snapshot = null, lastFresh = null, clock = null, fresh = false, loading = false, failed = false;
  let hadStreak = false, pendingRain = null, animation = null, animationTimer = null, disposed = false, lastRefresh = -Infinity;
  let artKey = '', notice = '', noticeUntil = 0, lastBoundary = null;
  const seenReceipts = new Set();
  const visible = () => (!root.dataset.arcadeView || root.dataset.arcadeView === 'daily') && !daily.hidden;
  const serverNow = () => clock ? clock.serverTime + Math.max(0, monotonic() - clock.monotonicAt) : NaN;
  function readClock(value, data) {
    if (!value || !Number.isFinite(value.serverTime) || !Number.isFinite(new Date(value.serverTime).getTime()) || !Number.isFinite(value.monotonicAt)
      || dateKey(value.serverTime) !== data.dateKey || value.monotonicAt > monotonic() + 1000) return null;
    return { serverTime: value.serverTime, monotonicAt: value.monotonicAt };
  }
  function clearAnimation() {
    if (animationTimer !== null) view.clearTimeout(animationTimer);
    animationTimer = null; animation = null; card.removeAttribute('data-forest-animation');
  }
  function reset(next) {
    clearAnimation(); wallet = next; snapshot = null; lastFresh = null; clock = null; fresh = false;
    hadStreak = false; pendingRain = null; notice = ''; artKey = ''; lastRefresh = -Infinity; lastBoundary = null;
  }
  function askRefresh(force = false) {
    if (disposed || (!force && (!wallet || loading || monotonic() - lastRefresh < 5000))) return;
    lastRefresh = monotonic(); root.dispatchEvent(new view.CustomEvent('arcade-attendance-refresh'));
  }
  function animate(kind, date, wasPaused = false) {
    clearAnimation();
    if (view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animation = { kind, date, wasPaused }; card.dataset.forestAnimation = kind;
    animationTimer = view.setTimeout(() => { clearAnimation(); render(); }, kind === 'rain' ? 1700 : 900);
  }
  function revealRain() {
    if (!pendingRain || !visible() || !snapshot || pendingRain.wallet !== wallet) return;
    const rain = pendingRain; pendingRain = null;
    notice = dayName(rain.dateKey) + ' check-in recovered. Current streak: ' + snapshot.streak + (snapshot.streak === 1 ? ' day.' : ' days.');
    noticeUntil = monotonic() + 8000;
    if (rain.dateKey.slice(0, 7) === snapshot.monthKey && snapshot.checkedDates.includes(rain.dateKey)) animate('rain', rain.dateKey, rain.wasPaused);
  }
  function render() {
    if (disposed) return;
    const current = serverNow(), timing = snapshot && fresh && clock ? attendanceCountdown(snapshot, current) : null;
    const stale = Boolean(snapshot && (!fresh || !timing));
    const paused = Boolean(snapshot && !stale && snapshot.streak === 0 && (snapshot.checkedInDays > 0 || hadStreak));
    const state = !wallet ? (loading ? 'loading' : 'signed-out') : !snapshot ? (failed ? 'stale' : 'loading') : stale ? 'stale' : paused ? 'paused' : snapshot.checkedInDays || snapshot.streak ? 'growing' : 'empty';
    card.dataset.forestState = state;
    card.dataset.forestSeason = snapshot?.monthKey.endsWith('-11') ? 'autumn' : 'evergreen';
    advent?.update(snapshot, { wallet, fresh: Boolean(fresh && !stale) });
    get('count').textContent = snapshot ? String(snapshot.checkedInDays) : '—';
    get('streak').textContent = snapshot ? snapshot.streak + (snapshot.streak === 1 ? ' day' : ' days') : '—';
    doc.getElementById('attendance-forest-title').textContent = snapshot ? 'Your ' + monthName(snapshot.dayStart) + ' grove' : 'Your check-in grove';
    get('timer-label').textContent = timing ? timing.label : !wallet ? 'Sign in to grow your grove' : stale || failed ? 'Last saved · checking attendance' : 'Loading your attendance';
    get('timer').textContent = timing ? duration(timing.remaining) : wallet ? 'Updating…' : '—';
    get('deadline').textContent = timing?.deadline ? 'Streak deadline: ' + utc(timing.deadline) + ' · ' + duration(timing.streakRemaining) + ' left'
      : timing ? 'A new check-in day starts at 00:00 UTC.' : wallet ? 'The timer returns when fresh attendance is available.' : 'One free check-in each UTC day.';
    let copy = !wallet ? 'Sign in above to see the trees you have grown.' : !snapshot ? failed ? 'Attendance is unavailable. Your saved progress has not been reset.' : 'Loading this wallet’s saved trees…'
      : stale ? 'Last saved progress. ' + (clock && current >= snapshot.resetAt ? 'Checking the new UTC day…' : 'Refreshing keeps your grove accurate.')
      : paused ? 'Your streak paused. Your ' + snapshot.checkedInDays + ' saved check-ins are kept.'
      : !snapshot.checkedInDays && snapshot.streak ? 'New month, new grove. Your ' + snapshot.streak + '-day streak continues.'
      : snapshot.todayChecked ? 'Today’s tree is planted. Come back tomorrow to keep growing.'
      : snapshot.streak ? 'Check in today to keep your forest growing.' : 'Plant your first tree with a free check-in.';
    if (notice && monotonic() < noticeUntil && !stale) copy = notice;
    if (get('status').textContent !== copy) get('status').textContent = copy;
    get('recover').hidden = !snapshot || stale || !snapshot.missedDates.length;
    get('recover').disabled = loading;
    get('recover').setAttribute('aria-label', 'Review missed check-in dates. Recovery costs 20,000 TREE plus SUI gas per date.');
    const nextArt = JSON.stringify([snapshot?.monthKey, snapshot?.checkedDates, snapshot?.recoveredDates, snapshot?.dateKey, paused, animation]);
    if (nextArt !== artKey) {
      artKey = nextArt; card.querySelector('.forest-art').innerHTML = scene(snapshot, {
        paused, rain: animation?.kind === 'rain', rainDate: animation?.kind === 'rain' ? animation.date : null,
        rainWasPaused: animation?.wasPaused, planted: animation?.date, empty: !snapshot || !snapshot.checkedDates.length,
      });
    }
    if (wallet && snapshot && fresh && (!clock || current >= snapshot.resetAt)) {
      const boundary = clock ? snapshot.dateKey + ':' + dateKey(current) : null;
      if (boundary && lastBoundary !== boundary) { lastBoundary = boundary; askRefresh(true); }
      else askRefresh();
    }
  }
  function onState(event) {
    const detail = event.detail || {}, next = detail.sessionActive ? address(detail.wallet) : null;
    if (next !== wallet) reset(next);
    loading = Boolean(detail.loading); failed = Boolean(detail.error);
    if (!next) { render(); return; }
    let accepted = null;
    try { accepted = normalizeAttendance(detail.progress); if (accepted.wallet !== wallet) accepted = null; } catch {}
    fresh = Boolean(accepted && detail.fresh);
    if (accepted) {
      snapshot = accepted; clock = readClock(detail.clock, accepted);
      if (fresh) {
        if (lastFresh?.monthKey === accepted.monthKey) {
          const planted = accepted.checkedDates.filter(d => !lastFresh.checkedDates.includes(d) && !accepted.recoveredDates.includes(d)).at(-1);
          if (planted && visible()) animate('plant', planted);
        }
        hadStreak ||= accepted.streak > 0;
        lastFresh = accepted;
      }
    } else if (!loading) { fresh = false; clearAnimation(); }
    revealRain(); render();
  }
  function onRecovered(event) {
    const d = event.detail || {}, r = d.receipt;
    if (!wallet || address(d.wallet) !== wallet || !r || r.price !== '20000'
      || !Number.isFinite(dateNumber(r.dateKey)) || typeof r.digest !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{20,100}$/.test(r.digest)) return;
    const key = wallet + ':' + r.dateKey + ':' + r.digest;
    if (seenReceipts.has(key)) return;
    let next; try { next = normalizeAttendance(d.progress); } catch { return; }
    if (next.wallet !== wallet || r.dateKey >= next.dateKey) return;
    if (r.dateKey.slice(0, 7) === next.monthKey && !next.recoveredDates.includes(r.dateKey)) return;
    const wasPaused = Boolean(snapshot && snapshot.streak === 0 && (snapshot.checkedInDays || hadStreak));
    seenReceipts.add(key); if (seenReceipts.size > 64) seenReceipts.delete(seenReceipts.values().next().value);
    snapshot = next; lastFresh = next; clock = readClock(d.clock, next); fresh = true; failed = false;
    hadStreak ||= next.streak > 0;
    pendingRain = { wallet, dateKey: r.dateKey, wasPaused };
    revealRain(); render();
  }
  const onProgress = event => { if (event.detail?.sessionActive === false) { reset(null); loading = false; render(); } };
  const onReturn = () => { render(); if (wallet) askRefresh(); };
  const onView = () => { revealRain(); render(); };
  const onRecoverClick = () => root.dispatchEvent(new view.CustomEvent('arcade-open-attendance-recovery', { detail: { dateKey: snapshot?.missedDates.at(-1) || null } }));
  root.addEventListener('arcade-attendance-state', onState);
  root.addEventListener('arcade-attendance-recovered', onRecovered);
  root.addEventListener('arcade-progress', onProgress);
  get('recover').addEventListener('click', onRecoverClick);
  view.addEventListener('focus', onReturn); view.addEventListener('pageshow', onReturn);
  const observer = new view.MutationObserver(onView);
  observer.observe(root, { attributes: true, attributeFilter: ['data-arcade-view'] });
  const timer = view.setInterval(render, 1000);
  render();
  const bootstrap = view.setTimeout(() => askRefresh(true), 0);
  const controller = { destroy() {
    disposed = true; clearAnimation(); view.clearInterval(timer); view.clearTimeout(bootstrap); observer.disconnect();
    root.removeEventListener('arcade-attendance-state', onState); root.removeEventListener('arcade-attendance-recovered', onRecovered);
    root.removeEventListener('arcade-progress', onProgress); view.removeEventListener('focus', onReturn); view.removeEventListener('pageshow', onReturn);
    advent?.destroy(); card.remove(); mounted.delete(root);
  } };
  mounted.set(root, controller);
  return controller;
}
