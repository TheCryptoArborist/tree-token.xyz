// Presentation only. Reuse the existing tab buttons and their quest/profile handlers.
export function mountArcadeNavigation(doc = document, view = window) {
  const root = doc.getElementById('arcade-daily-growth');
  const nav = doc.getElementById('arcade-subnav');
  if (!root || !nav) return;
  const tabs = [...nav.querySelectorAll('[role="tab"]')];
  const keys = ['games', 'daily', 'campaigns', 'community', 'events', 'month', 'badges'];
  const tabFor = new Map(keys.map((key, i) => [key, tabs[i]]));
  const keyFor = new Map(tabs.map((tab, i) => [tab, keys[i]]));
  const details = doc.getElementById('growth-details');
  const featured = doc.getElementById('arcade-featured-event');
  if (tabs.length !== keys.length || tabs.some(tab => !doc.getElementById(tab.getAttribute('aria-controls')))) return;

  function render(tab) {
    const key = keyFor.get(tab) || 'games';
    const changed = root.dataset.arcadeView !== key;
    root.dataset.arcadeView = key;
    if (changed) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (featured) featured.hidden = key !== 'games';
    // Legacy handlers select panels by ID, including Games outside the missions root.
    for (const item of tabs) doc.getElementById(item.getAttribute('aria-controls')).hidden = item !== tab;
    if (!details.open) details.open = true;
    return key;
  }
  function route(tab, historyMode) {
    for (const item of tabs) {
      const active = item === tab;
      if (item.getAttribute('aria-selected') !== String(active)) item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    const key = render(tab);
    if (historyMode && view.location.hash !== '#' + key) {
      view.history[historyMode + 'State'](null, '', '#' + key);
    }
  }
  // Capture presentation changes; let existing tab click handlers run normally.
  nav.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (keyFor.has(tab)) route(tab, 'push');
  }, true);
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tab = event.target.closest('[role="tab"]');
    const index = tabs.indexOf(tab);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
    tabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, true);
  const headerActions = [...root.querySelectorAll('#growth-badge-preview, #growth-invitation-open')];
  function labelHeaderActions() {
    for (const button of headerActions) {
      if (button.hasAttribute('aria-expanded')) button.removeAttribute('aria-expanded');
      if (button.getAttribute('aria-controls') !== 'growth-today-panel') button.setAttribute('aria-controls', 'growth-today-panel');
      if (button.getAttribute('aria-label') !== 'Open Daily') button.setAttribute('aria-label', 'Open Daily');
    }
  }
  const headerObserver = new view.MutationObserver(labelHeaderActions);
  for (const button of headerActions) {
    button.addEventListener('click', () => tabFor.get('daily').click());
    headerObserver.observe(button, { attributes: true, attributeFilter: ['aria-expanded', 'aria-controls', 'aria-label'] });
  }
  labelHeaderActions();
  // Also reflect programmatic selections made by existing Community/quest actions.
  new view.MutationObserver(() => {
    const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    if (active) {
      const key = render(active);
      if (view.location.hash !== '#' + key) view.history.replaceState(null, '', '#' + key);
    }
  }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  function fromHash() {
    const key = view.location.hash.slice(1).toLowerCase();
    const tab = tabFor.get(key === 'cabinets' ? 'games' : key);
    if (!tab) return;
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    else render(tab);
    if (key === 'cabinets') {
      const games = doc.getElementById('cabinets');
      games.focus({ preventScroll: true });
      games.scrollIntoView({ block: 'start' });
    } else tab.focus({ preventScroll: true });
  }
  view.addEventListener('hashchange', fromHash);
  view.addEventListener('popstate', fromHash);
  details.addEventListener('toggle', () => { if (!details.open) details.open = true; });
  route(tabFor.get('games'));
  fromHash();
}
if (typeof document !== 'undefined') mountArcadeNavigation();
