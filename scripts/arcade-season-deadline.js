// Presentation only. Award eligibility and paid recovery remain server concerns.
// A displayed collection never rolls forward just because the device month changes.
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const LABEL_PATTERN = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+(\\d{4})\\b`, 'i');
// These named collections are the seasons configured in arcade-seasonal-data.js.
// Their explicit years keep signed-out artwork aligned without guessing from now.
const COLLECTION_MONTHS = new Map([
  ['November · Autumn Guardians', '2026-11'],
  ['December · Christmas Guardians', '2026-12'],
]);
const mountedRoots = new WeakMap();
let headingSequence = 0;

function utcMonthStart(year, zeroBasedMonth) {
  const date = new Date(0);
  date.setUTCFullYear(year, zeroBasedMonth, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatUTCDeadline(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} · ${hours}:${minutes} UTC`;
}

export function parseSeasonMonth(monthKey) {
  const match = typeof monthKey === 'string' && MONTH_PATTERN.exec(monthKey);
  if (!match || Number(match[1]) === 0) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const startsAt = utcMonthStart(year, month - 1);
  const endsAt = utcMonthStart(year, month);
  return {
    monthKey,
    monthName: MONTH_NAMES[month - 1],
    year,
    startsAt,
    endsAt,
    deadlineISO: new Date(endsAt).toISOString(),
    deadlineLabel: formatUTCDeadline(endsAt),
  };
}

export function monthFromCalendarLabel(label) {
  const match = typeof label === 'string' && LABEL_PATTERN.exec(label);
  if (!match) return null;
  const month = MONTH_NAMES.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1;
  const key = `${match[2]}-${String(month).padStart(2, '0')}`;
  return parseSeasonMonth(key)?.monthKey || null;
}

export function monthFromCollectionTitle(title) {
  return typeof title === 'string' ? COLLECTION_MONTHS.get(title.trim()) || null : null;
}

export function resolveSeasonMonth({ calendarLabel, collectionTitle, progressMonth, fallbackMonth = '2026-11' } = {}) {
  return monthFromCalendarLabel(calendarLabel)
    || parseSeasonMonth(progressMonth)?.monthKey
    || monthFromCollectionTitle(collectionTitle)
    || parseSeasonMonth(fallbackMonth)?.monthKey
    || null;
}

export function seasonCountdown(monthKey, now = Date.now()) {
  const season = parseSeasonMonth(monthKey);
  const timestamp = now instanceof Date ? now.getTime() : now;
  if (!season || !Number.isFinite(timestamp)) return null;
  // Ceiling keeps the final fractional second open until the exclusive UTC end.
  const remainingSeconds = Math.ceil(Math.max(0, season.endsAt - timestamp) / 1000);
  return {
    ...season,
    state: timestamp >= season.endsAt ? 'closed' : timestamp < season.startsAt ? 'upcoming' : 'active',
    remainingSeconds,
    days: Math.floor(remainingSeconds / 86400),
    hours: Math.floor(remainingSeconds / 3600) % 24,
    minutes: Math.floor(remainingSeconds / 60) % 60,
    seconds: remainingSeconds % 60,
  };
}

export function countdownUnitLabel(unit, value) {
  return value === 1 ? unit : `${unit}s`;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function buildCard(container, doc) {
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  container.classList.add('arcade-season-deadline');
  const header = element('div', 'arcade-season-deadline__header');
  const title = element('h3', 'arcade-season-deadline__title');
  title.id = `arcade-season-deadline-title-${++headingSequence}`;
  container.setAttribute('aria-labelledby', title.id);
  const tag = element('span', 'arcade-season-deadline__tag', 'Limited-time collection');
  header.append(title, tag);

  const status = element('p', 'arcade-season-deadline__status');
  // Only phase changes update this live region; clock ticks never announce.
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const timer = element('div', 'arcade-season-deadline__timer');
  timer.setAttribute('role', 'timer');
  timer.setAttribute('aria-live', 'off');
  const units = ['day', 'hour', 'minute', 'second'].map((unit) => {
    const cell = element('span', 'arcade-season-deadline__unit');
    const value = element('strong', 'arcade-season-deadline__value', '0');
    const label = element('span', 'arcade-season-deadline__label', `${unit}s`);
    cell.append(value, label);
    timer.append(cell);
    return { unit, value, label };
  });
  const deadline = element('p', 'arcade-season-deadline__date');
  const prefix = element('span');
  const time = element('time');
  deadline.append(prefix, time);
  const note = element('p', 'arcade-season-deadline__note', 'Earned badges stay in your collection.');
  container.replaceChildren(header, status, timer, deadline, note);
  return { container, title, tag, status, timer, units, deadline, prefix, time };
}

function renderCard(card, result) {
  const { container, title, tag, status, timer, units, deadline, prefix, time } = card;
  if (!result) {
    container.dataset.countdownState = 'unavailable';
    delete container.dataset.resolvedSeasonMonth;
    setText(title, 'Monthly badges');
    setText(tag, 'Collection');
    setText(status, 'The collection deadline could not be loaded.');
    timer.hidden = true;
    deadline.hidden = true;
    return;
  }
  const { monthName, monthKey, state } = result;
  container.dataset.countdownState = state;
  container.dataset.resolvedSeasonMonth = monthKey;
  setText(title, `${monthName} badges`);
  setText(tag, state === 'closed' ? 'Closed collection' : state === 'upcoming' ? 'Upcoming collection' : 'Limited-time collection');
  setText(status, state === 'closed'
    ? `${monthName} earning window closed`
    : state === 'upcoming'
      ? `Earning opens ${formatUTCDeadline(result.startsAt)}`
      : 'Time left to earn');
  timer.hidden = state !== 'active';
  timer.setAttribute('aria-label', `Time left to earn ${monthName} badges`);
  for (const { unit, value, label } of units) {
    const count = result[`${unit}s`];
    setText(value, String(count));
    setText(label, countdownUnitLabel(unit, count));
  }
  deadline.hidden = false;
  setText(prefix, state === 'closed' ? 'Ended ' : 'Ends ');
  time.dateTime = result.deadlineISO;
  setText(time, result.deadlineLabel);
}

/**
 * Mount all [data-arcade-season-countdown] cards in root.
 * data-season-month supplies a fixed fallback (default 2026-11).
 * data-countdown-variant="compact" provides the Badge Collection presentation.
 * Inject now and { setInterval, clearInterval } timers for deterministic checks.
 * Calling destroy stops updates/listeners and leaves the last rendered card intact.
 */
export function mountSeasonCountdowns({
  root = globalThis.document,
  now = Date.now,
  timers = globalThis,
} = {}) {
  if (!root?.querySelectorAll) return { update() {}, destroy() {} };
  if (mountedRoots.has(root)) return mountedRoots.get(root);
  const doc = root.ownerDocument || root;
  const find = (selector) => root.matches?.(selector) ? root : root.querySelector(selector);
  const containers = [...root.querySelectorAll('[data-arcade-season-countdown]')];
  if (root.matches?.('[data-arcade-season-countdown]')) containers.unshift(root);
  if (!containers.length) return { update() {}, destroy() {} };
  const cards = containers.map((container) => buildCard(container, doc));
  const growth = find('#arcade-daily-growth');
  let progressMonth = null;
  let lastDisplayedMonth = null;
  let destroyed = false;

  const update = () => {
    if (destroyed) return;
    const calendarLabel = find('#growth-calendar-title')?.textContent || '';
    const collectionTitle = find('#seasonal-current-title')?.textContent || '';
    const displayedMonth = resolveSeasonMonth({ calendarLabel, collectionTitle, progressMonth, fallbackMonth: null });
    // Retain a real displayed collection if a temporary loading label replaces it.
    if (displayedMonth) lastDisplayedMonth = displayedMonth;
    const timestamp = now();
    for (const card of cards) {
      const monthKey = resolveSeasonMonth({
        calendarLabel,
        collectionTitle,
        progressMonth,
        fallbackMonth: lastDisplayedMonth || (card.container.dataset.seasonMonth ?? '2026-11'),
      });
      renderCard(card, seasonCountdown(monthKey, timestamp));
    }
  };
  const onProgress = (event) => {
    const detail = event.detail;
    const key = detail?.progress?.monthKey || detail?.monthKey || detail?.month;
    progressMonth = parseSeasonMonth(key)?.monthKey || null;
    update();
  };
  growth?.addEventListener('arcade-progress', onProgress);
  doc.addEventListener('visibilitychange', update);
  const monthSources = [find('#growth-calendar-title'), find('#seasonal-current-title')].filter(Boolean);
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer && monthSources.length ? new Observer(update) : null;
  for (const source of monthSources) {
    observer?.observe(source, { childList: true, characterData: true, subtree: true });
  }
  const interval = timers.setInterval(update, 1000);
  const controller = {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      timers.clearInterval(interval);
      observer?.disconnect();
      growth?.removeEventListener('arcade-progress', onProgress);
      doc.removeEventListener('visibilitychange', update);
      mountedRoots.delete(root);
    },
  };
  mountedRoots.set(root, controller);
  update();
  return controller;
}
