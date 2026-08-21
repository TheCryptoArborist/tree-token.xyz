const PANEL_IDS = [
  'swap',
  'limit',
  'earn',
  'v3',
  'stats',
  'removed',
  'canopy-draw',
  'leaderboard',
  'profile-studio',
  'documents',
];

const PANEL_LABELS = {
  swap: 'Swap',
  limit: 'Limit',
  earn: 'Earn',
  v3: 'V3',
  stats: 'Stats',
  removed: 'Burn',
  'canopy-draw': 'Challenge',
  leaderboard: 'Canopy',
  'profile-studio': 'Profile Studio',
  documents: 'Documents',
};

const panels = new Map(
  PANEL_IDS
    .map((id) => [id, document.getElementById(id)])
    .filter(([, panel]) => panel),
);
const nav = document.querySelector('.app-nav');
const navLinks = [...(nav?.querySelectorAll('a[href^="#"]') || [])];
let activePanelId = null;

panels.forEach((panel) => panel.classList.add('app-panel'));

function resolvePanelId(hash = location.hash) {
  const id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  if (panels.has(id)) return id;
  const target = id ? document.getElementById(id) : null;
  const containingPanel = target?.closest('section[id]');
  if (containingPanel && panels.has(containingPanel.id)) return containingPanel.id;
  return 'swap';
}

function updateNav(panelId) {
  navLinks.forEach((link, index) => {
    const targetId = link.getAttribute('href')?.slice(1);
    const selected = targetId === panelId;
    link.classList.toggle('active', selected);
    link.setAttribute('aria-selected', selected ? 'true' : 'false');
    link.setAttribute('tabindex', selected ? '0' : '-1');
    link.setAttribute('role', 'tab');
    if (!link.id) link.id = `tree-tab-${targetId || index}`;
    if (targetId && panels.has(targetId)) link.setAttribute('aria-controls', targetId);
  });
}

function showPanel(panelId, options = {}) {
  const selectedId = panels.has(panelId) ? panelId : 'swap';
  panels.forEach((panel, id) => {
    const selected = id === selectedId;
    panel.hidden = !selected;
    panel.classList.toggle('active-panel', selected);
    panel.setAttribute('aria-hidden', selected ? 'false' : 'true');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('tabindex', '-1');
    const controllingTab = navLinks.find((link) => link.getAttribute('href') === `#${id}`);
    if (controllingTab?.id) panel.setAttribute('aria-labelledby', controllingTab.id);
  });
  activePanelId = selectedId;
  updateNav(selectedId);
  document.body.dataset.activePanel = selectedId;
  document.title = `TREE Command Center | ${PANEL_LABELS[selectedId] || 'TREE'}`;

  if (options.scrollTop !== false) {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    resetScroll();
    requestAnimationFrame(resetScroll);
  }
  window.dispatchEvent(new CustomEvent('tree:panel-shown', { detail: { panelId: selectedId } }));
  window.dispatchEvent(new Event('resize'));
  return selectedId;
}

function activateFromLocation() {
  const rawId = decodeURIComponent(location.hash.replace(/^#/, ''));
  const panelId = showPanel(resolvePanelId(location.hash), { scrollTop: PANEL_IDS.includes(rawId) || !rawId });
  if (rawId && rawId !== panelId) {
    requestAnimationFrame(() => document.getElementById(rawId)?.scrollIntoView({ block: 'start' }));
  }
}

nav?.setAttribute('role', 'tablist');
nav?.setAttribute('aria-label', 'TREE utility navigation');

navLinks.forEach((link, index) => {
  link.addEventListener('click', (event) => {
    const panelId = link.getAttribute('href')?.slice(1);
    if (!panelId || !panels.has(panelId)) return;
    event.preventDefault();
    if (location.hash === `#${panelId}`) showPanel(panelId);
    else history.pushState({ panelId }, '', `#${panelId}`);
    showPanel(panelId);
  });
  link.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % navLinks.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + navLinks.length) % navLinks.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = navLinks.length - 1;
    navLinks[nextIndex]?.focus();
    navLinks[nextIndex]?.click();
  });
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || nav?.contains(link)) return;
  const rawId = link.getAttribute('href')?.slice(1);
  if (!rawId) return;
  const target = document.getElementById(rawId);
  const targetPanel = panels.has(rawId) ? rawId : target?.closest('section[id]')?.id;
  if (!targetPanel || !panels.has(targetPanel) || targetPanel === activePanelId) return;
  event.preventDefault();
  history.pushState({ panelId: targetPanel }, '', `#${rawId}`);
  showPanel(targetPanel);
  requestAnimationFrame(() => target?.scrollIntoView({ block: 'start' }));
});

const documentGrid = document.querySelector('#documents .document-grid');
if (documentGrid && !documentGrid.querySelector('[data-profile-studio-card]')) {
  const article = document.createElement('article');
  article.className = 'card document-tile';
  article.dataset.profileStudioCard = 'true';
  article.innerHTML = '<span class="card-icon">◎</span><h3>Profile Studio</h3><p>Create a TREE profile image locally in your browser.</p><a class="button secondary" href="#profile-studio">Open Profile Studio</a>';
  documentGrid.append(article);
}

const earnViews = ['routes', 'positions', 'victory'];
const earnTabs = { routes: document.getElementById('earnRoutesTab'), positions: document.getElementById('earnPositionsTab'), victory: document.getElementById('earnVictoryTab') };
const earnPanels = { routes: document.getElementById('earnRoutesPanel'), positions: document.getElementById('earnPositionsPanel'), victory: document.getElementById('earnVictoryPanel') };
function showEarnView(view) {
  const selected = earnViews.includes(view) ? view : 'routes';
  Object.entries(earnPanels).forEach(([name, panel]) => { if (panel) panel.hidden = name !== selected; });
  Object.entries(earnTabs).forEach(([name, tab]) => {
    if (!tab) return;
    const active = name === selected;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}
earnTabs.routes?.addEventListener('click', () => showEarnView('routes'));
earnTabs.positions?.addEventListener('click', () => showEarnView('positions'));
earnTabs.victory?.addEventListener('click', () => showEarnView('victory'));

const statsViews = ['market', 'supply', 'liquidity', 'nftree'];
const statsTabs = Object.fromEntries(statsViews.map((view) => [view, document.getElementById(`stats${view[0].toUpperCase()}${view.slice(1)}Tab`)]));
const statsPanels = Object.fromEntries(statsViews.map((view) => [view, document.getElementById(`stats${view[0].toUpperCase()}${view.slice(1)}Panel`)]));
function showStatsView(view) {
  const selected = statsViews.includes(view) ? view : 'market';
  Object.entries(statsPanels).forEach(([name, panel]) => { if (panel) panel.hidden = name !== selected; });
  Object.entries(statsTabs).forEach(([name, tab]) => {
    if (!tab) return;
    const active = name === selected;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
}
Object.entries(statsTabs).forEach(([view, tab]) => tab?.addEventListener('click', () => showStatsView(view)));

const raffleViews = ['daily', 'weekly', 'entries'];
const raffleTabs = Object.fromEntries(raffleViews.map((view) => [view, document.getElementById(`raffle${view[0].toUpperCase()}${view.slice(1)}Tab`)]));
const rafflePanels = Object.fromEntries(raffleViews.map((view) => [view, document.getElementById(`raffle${view[0].toUpperCase()}${view.slice(1)}Panel`)]));
function showRaffleView(view) {
  const selected = raffleViews.includes(view) ? view : 'daily';
  Object.entries(rafflePanels).forEach(([name, panel]) => { if (panel) panel.hidden = name !== selected; });
  Object.entries(raffleTabs).forEach(([name, tab]) => {
    if (!tab) return;
    const active = name === selected;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
}
Object.entries(raffleTabs).forEach(([view, tab]) => tab?.addEventListener('click', () => showRaffleView(view)));

window.addEventListener('hashchange', activateFromLocation);
window.addEventListener('popstate', activateFromLocation);
document.documentElement.classList.add('app-tabbed');
activateFromLocation();

window.TREE_PANEL_ROUTER = Object.freeze({
  panels: [...panels.keys()],
  showPanel,
  get activePanelId() { return activePanelId; },
});
