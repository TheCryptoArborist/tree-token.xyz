import { collections } from './arcade-seasonal-data.js';

// These are presentation-only dates. Eligibility and awards remain server controlled.
const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const activeMounts = new WeakMap();
function monthKey(date) { return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0'); }
function nextStart(now) {
  const d = new Date(now);
  if (!Number.isFinite(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1);
}
export function nextMonthUnlock(now = Date.now()) {
  const stamp = now instanceof Date ? now.getTime() : now;
  const timestamp = nextStart(stamp);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  const key = monthKey(date);
  const remaining = Math.max(0, Math.ceil((timestamp - stamp)/1000));
  const collection = Object.hasOwn(collections, key) ? collections[key] : null;
  return {
    key, label: names[date.getUTCMonth()]+' '+date.getUTCFullYear(),
    startsAt: timestamp, iso: date.toISOString(), remaining,
    days: Math.floor(remaining/86400), hours: Math.floor(remaining/3600)%24,
    minutes: Math.floor(remaining/60)%60, seconds: remaining%60,
    collectionTitle: collection?.title ?? null,
    collectionConfigured: Boolean(collection),
  };
}
const pad = value => String(value).padStart(2,'0');
const clock = result => result.days+'d '+pad(result.hours)+'h '+pad(result.minutes)+'m '+pad(result.seconds)+'s';
function createCard(doc, type) {
  const el = doc.createElement('section');
  el.className = 'arcade-next-unlock';
  el.dataset.arcadeNextUnlock = type;
  el.setAttribute('aria-label','Next monthly Arcade unlocks');
  el.innerHTML = '<div class="arcade-next-unlock__heading"><span>UP NEXT</span><strong data-unlock-month>Next month</strong></div>'
    + '<div class="arcade-next-unlock__items"><div><span>New daily calendar</span><strong data-unlock-calendar role="timer" aria-live="off">—</strong></div>'
    + '<div><span data-unlock-badge-name>Next badge collection</span><strong data-unlock-badges role="timer" aria-live="off">—</strong></div></div>'
    + '<p data-unlock-date></p>';
  return el;
}
export function mountNextMonthUnlocks({ root = globalThis.document, now = Date.now, timers = root?.defaultView || globalThis } = {}) {
  if (!root?.getElementById) return { update() {}, destroy() {} };
  if (activeMounts.has(root)) return activeMounts.get(root);
  const daily = root.getElementById('growth-today-panel');
  const month = root.getElementById('growth-month-panel');
  const badges = root.getElementById('growth-badges-panel');
  if (!daily || !month || !badges) return { update() {}, destroy() {} };
  const cards = [
    { parent: daily, type: 'daily' }, { parent: month, type: 'monthly' }, { parent: badges, type: 'badges' },
  ].map(item => ({ ...item, node: createCard(root, item.type) }));
  const forest = root.getElementById('arcade-attendance-forest');
  if (forest) forest.after(cards[0].node); else daily.prepend(cards[0].node);
  cards[1].parent.prepend(cards[1].node);
  cards[2].parent.prepend(cards[2].node);
  let dead = false;
  function update() {
    if (dead) return;
    const result = nextMonthUnlock(now());
    for (const { node } of cards) {
      if (!result) { node.hidden = true; continue; }
      node.hidden = false;
      node.dataset.nextMonth = result.key;
      node.querySelector('[data-unlock-month]').textContent = result.label;
      node.querySelector('[data-unlock-calendar]').textContent = clock(result);
      node.querySelector('[data-unlock-badge-name]').textContent = result.collectionConfigured
        ? result.collectionTitle+' badges' : 'Next badge collection';
      node.querySelector('[data-unlock-badges]').textContent = result.collectionConfigured
        ? clock(result) : 'Not announced';
      node.querySelector('[data-unlock-date]').textContent = result.collectionConfigured
        ? 'Both scheduled for '+names[new Date(result.startsAt).getUTCMonth()]+' 1, '+new Date(result.startsAt).getUTCFullYear()+' · 00:00 UTC. Badge eligibility is verified by the Arcade.'
        : 'Calendar begins '+names[new Date(result.startsAt).getUTCMonth()]+' 1, '+new Date(result.startsAt).getUTCFullYear()+' · 00:00 UTC. No badge release date is configured yet.';
    }
  }
  const interval = timers.setInterval(update, 1000);
  const visibility = () => update();
  root.addEventListener('visibilitychange', visibility);
  update();
  const control = { update, destroy() {
    if (dead) return;
    dead = true;
    timers.clearInterval(interval);
    root.removeEventListener('visibilitychange', visibility);
    cards.forEach(({ node }) => node.remove());
    activeMounts.delete(root);
  } };
  activeMounts.set(root, control);
  return control;
}
