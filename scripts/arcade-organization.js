import { mountSeasonCountdowns } from './arcade-season-deadline.js';

// Presentation only: move existing nodes so wallet, quest and saved-state handlers
// retain their original controls. This module never submits attendance or payments.
const mounted = new WeakMap();

export function mountArcadeOrganization(doc = document, view = window) {
  if (mounted.has(doc)) return mounted.get(doc);
  const byId = (id) => doc.getElementById(id);
  const root = byId('arcade-daily-growth');
  const daily = byId('growth-today-panel');
  const campaigns = byId('growth-campaigns-panel');
  const month = byId('growth-month-panel');
  const badges = byId('growth-badges-panel');
  const cabinets = byId('cabinets');
  if (![root, daily, campaigns, month, badges, cabinets].every(Boolean)) return null;

  const element = (tag, className, html) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };
  const section = (node, key, title, description) => {
    if (!node) return null;
    const wrapper = element('details', 'arcade-activity-section');
    wrapper.dataset.campaignSection = key;
    const summary = element('summary', '', `<span><strong>${title}</strong><span>${description}</span></span><span class="arcade-disclosure-icon" aria-hidden="true">+</span>`);
    wrapper.append(summary, node);
    campaigns.append(wrapper);
    return wrapper;
  };

  root.setAttribute('aria-label', 'TREE Arcade activities');
  root.removeAttribute('aria-labelledby');
  const strip = root.querySelector('.growth-strip');
  if (strip) daily.prepend(strip);
  const status = byId('growth-status');
  if (status && strip) strip.after(status);

  const summary = doc.querySelector('.month-progress-summary');
  const shortcuts = summary?.querySelector('.guided-actions');
  if (shortcuts) {
    shortcuts.classList.add('arcade-game-shortcuts');
    shortcuts.setAttribute('aria-label', 'Attendance shortcuts');
    cabinets.querySelector('.floor-heading')?.append(shortcuts);
  }
  if (summary) {
    summary.dataset.monthlyOverview = '';
    const rail = byId('growth-month-rail');
    root.insertBefore(summary, rail || byId('growth-details'));
  }

  const community = byId('arcade-community-home');
  if (community) {
    const heading = element('div', 'arcade-community-heading', '<p class="growth-eyebrow">AROUND THE ARCADE</p><h3>Have your say. Stay connected.</h3><p>Vote for the next spotlight and catch up with the community.</p>');
    community.prepend(heading);
    daily.append(community);
  }
  const featured = byId('arcade-featured-event');
  if (featured) cabinets.after(featured);


  const campaignHeading = campaigns.querySelector('.quest-board-heading');
  if (campaignHeading) campaignHeading.innerHTML = '<div><p class="growth-eyebrow">ARCADE SPOTLIGHTS</p><h3>Find your next game.</h3><p>Explore the featured game and the planned rotation. Every working Arcade game gets a turn.</p></div>';

  // Presentation only: no scheduled window, eligible result, award or payout is implied.
  const campaignFeature = element('section', 'arcade-campaign-feature arcade-campaign-spotlight', `
    <img class="arcade-campaign-spotlight-art" src="/assets/arcade/tree-force-89-poster.webp" alt="" width="512" height="512" loading="lazy" decoding="async">
    <div class="arcade-campaign-spotlight-copy">
      <span class="arcade-campaign-state">FEATURED FIRST · PRACTICE SPOTLIGHT</span>
      <h4>TREE Force ’89</h4>
      <p>Take the Arborwing into battle. How far can you fight through the enemy waves?</p>
      <div class="arcade-campaign-actions"><a class="growth-primary" href="/play/treeforce89/">Play TREE Force ’89 <span aria-hidden="true">→</span></a><a class="growth-secondary" href="#events" data-arcade-route="events">Explore its Event <span aria-hidden="true">→</span></a></div>
      <p class="arcade-campaign-footnote">No funded campaign is open yet. Dates and rewards are not set; practice scores do not count toward an upcoming Event.</p>
    </div>
  `);
  if (campaignHeading) campaignHeading.after(campaignFeature);
  else campaigns.prepend(campaignFeature);

  const nextFeature = element('section', 'arcade-campaign-next', `
    <img src="/play/canopy-defense/checkout-test/assets/brand/canopy-home-scene.webp" alt="" width="200" height="200" loading="eager" decoding="async">
    <div><p class="growth-eyebrow">UP NEXT · SECOND IN ROTATION</p><h4>Canopy Defense</h4><p>Build towers, hold the line and protect the Tree of Life. Its spotlight dates are not set.</p></div>
    <a class="growth-secondary" href="/play/canopy-defense/">Explore game <span aria-hidden="true">→</span></a>
  `);
  campaignFeature.after(nextFeature);

  const rotation = element('details', 'arcade-campaign-rotation', `
    <summary><span><strong>Full Arcade rotation</strong><small>All LIVE games get a turn before repeats · dates not scheduled.</small></span><span class="arcade-disclosure-icon" aria-hidden="true">+</span></summary>
    <ol class="arcade-campaign-rotation-list"></ol>
  `);
  nextFeature.after(rotation);
  const roster = rotation.querySelector('ol');
  const priority = ['force-title', 'canopy-title'];
  const liveCabinets = [...cabinets.querySelectorAll('article.game-poster')]
    .filter(card => card.querySelector('.status-tag--live') && card.querySelector('.poster-link[href]') && card.querySelector('.poster-title'));
  liveCabinets.sort((first, second) => {
    const rank = card => { const i = priority.indexOf(card.querySelector('.poster-title')?.id); return i === -1 ? priority.length : i; };
    return rank(first) - rank(second);
  });
  for (const card of liveCabinets) {
    const href = card.querySelector('.poster-link').getAttribute('href') || '';
    if (!/^\/play\/[a-z0-9/_-]+\/?$/.test(href) && !/^https:\/\/(?:tree-token\.xyz\/play\/|nftree\.net\/battle\/)[a-z0-9/_-]+\/?$/.test(href)) continue;
    const li = element('li', 'arcade-campaign-rotation-item');
    const number = element('span', 'arcade-campaign-rotation-number');
    number.textContent = String(roster.children.length + 1).padStart(2, '0');
    const link = element('a', '');
    link.href = href;
    link.textContent = card.querySelector('.poster-title').textContent.trim();
    if (href.startsWith('https://nftree.net/')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    li.append(number, link);
    roster.append(li);
  }
  rotation.querySelector('summary small').textContent = roster.children.length + ' LIVE-listed games · one turn per game before repeating. No dates are scheduled.';

  const trialPilot = element('section', 'arcade-campaign-feature arcade-campaign-pilot', `
    <div class="arcade-campaign-feature__intro"><span class="arcade-campaign-state">TEST CHALLENGE · NO PRIZES</span><h4>Try Arborist Trials.</h4><p>Play four cards, grow your canopy and beat Garden Bot. This free pilot lets you try the challenge format before funded campaigns begin.</p></div>
    <div class="arcade-campaign-actions"><a class="growth-primary" href="/play/challenge/">Play the test challenge <span aria-hidden="true">→</span></a></div>
    <p class="arcade-campaign-footnote">Free entry · No purchase or gas fee · Sign in with your Arcade wallet. Test results do not award prizes, attendance or daily quest credit.</p>
  `);
  const pilotDisclosure = element('details', 'arcade-activity-section arcade-campaign-technical',
    '<summary><span><strong>Optional: Try the test challenge</strong><span>Arborist Trials · no prizes or quest credit</span></span><span class="arcade-disclosure-icon" aria-hidden="true">+</span></summary>');
  pilotDisclosure.append(trialPilot);
  rotation.after(pilotDisclosure);

  const access = element('p', 'arcade-signin-help', '<a href="#daily" data-arcade-route="daily">Open Daily to sign in</a><span>Your saved progress works across all six tabs.</span>');
  const toolbar = campaigns.querySelector('.quest-toolbar');
  if (toolbar) toolbar.before(access);
  const intro = campaigns.querySelector(':scope > .guided-card');
  const legacyGrid = campaigns.querySelector(':scope > .quest-card-grid');
  section(intro, 'getting-started', 'New to TREE Arcade? Start here', 'Free check-in, game discovery and share cards.');
  section(byId('quest-first-round'), 'first-round', 'Collect the First Round badge', 'An optional achievement with four verified tasks.');
  section(byId('know-your-tree'), 'learning', 'Know Your TREE quiz', 'Three questions to learn the basics.');
  if (legacyGrid) {
    for (const divider of legacyGrid.querySelectorAll(':scope > hr')) divider.remove();
    if (!legacyGrid.children.length) legacyGrid.remove();
  }

  const monthAccess = element('p', 'arcade-signin-help arcade-month-signin-help', '<a href="#daily" data-arcade-route="daily">Open Daily for check-in and sign-in</a><span>Attendance and verified quest days are tracked separately.</span>');
  byId('arcade-monthly-panel')?.prepend(monthAccess);

  const monthlyCountdown = element('section', 'arcade-month-deadline');
  monthlyCountdown.dataset.arcadeSeasonCountdown = '';
  monthlyCountdown.dataset.seasonMonth = '2026-11';
  summary ? summary.before(monthlyCountdown) : month.prepend(monthlyCountdown);
  const badgeCountdown = element('section');
  badgeCountdown.dataset.arcadeSeasonCountdown = '';
  badgeCountdown.dataset.seasonMonth = '2026-11';
  badgeCountdown.dataset.countdownVariant = 'compact';
  badges.prepend(badgeCountdown);
  const badgeAccess = element('p', 'arcade-signin-help', '<a href="#daily" data-arcade-route="daily">Open Daily to sign in</a><span>See the badges already saved to your wallet.</span>');
  const earnedHeading = badges.querySelector('.growth-earned-heading');
  if (earnedHeading) earnedHeading.before(badgeAccess);
  else badges.append(badgeAccess);

  const infoSummary = root.querySelector('.monthly-info > summary');
  if (infoSummary) infoSummary.innerHTML = '<span class="monthly-action-copy"><span class="monthly-action-title">Quest Details</span><span class="monthly-action-description">How verified quest days work</span></span><span class="monthly-action-chevron" aria-hidden="true">⌄</span>';
  const recoverySummary = root.querySelector('.monthly-recovery > summary');
  if (recoverySummary) recoverySummary.innerHTML = '<span class="monthly-action-copy"><span class="monthly-action-title">Recover a Missed Day</span><span class="monthly-action-description">Restore attendance for this month</span></span><span class="monthly-action-price">20,000 TREE <small>+ SUI gas</small></span><span class="monthly-action-chevron" aria-hidden="true">⌄</span>';

  function reflectView() {
    // The preserved guided runtime still sets this from its Games observer.
    // Correct only a changed value, avoiding observer feedback loops.
    const shouldHide = root.dataset.arcadeView !== 'daily';
    if (community && community.hidden !== shouldHide) community.hidden = shouldHide;
  }
  function updateSignInCopy() {
    for (const id of ['campaign-service-status', 'monthly-status']) {
      const node = byId(id);
      if (node?.textContent.includes('Sign in above')) {
        node.textContent = node.textContent.replace('Sign in above', 'Open Daily and sign in');
      }
    }
  }
  function reflectCheckIn(event) {
    // Only reduce duplicate confirmations after the existing runtime reports
    // fresh, signed-in attendance. Keep every original control and all stale,
    // loading and error guidance available; this flag never awards progress.
    const state = event.detail;
    daily.toggleAttribute('data-arcade-checkin-saved', Boolean(
      state?.sessionActive && !state.stale && !state.busy && state.progress?.today?.checkedIn
    ));
  }
  function revealActivity(node) {
    let parent = node?.parentElement;
    while (parent && parent !== campaigns) {
      if (parent.matches('details.arcade-activity-section')) parent.open = true;
      parent = parent.parentElement;
    }
  }
  const actions = {
    'campaign-open-quiz': 'campaign-quiz-details',
    'guided-open-share': 'guided-campaign-share',
  };
  function onClick(event) {
    const target = event.target.closest?.('[data-arcade-route], #campaign-open-quiz, #guided-open-share');
    if (!target) return;
    if (target.dataset.arcadeRoute) {
      const key = target.dataset.arcadeRoute;
      const tab = byId(key === 'daily' ? 'growth-today-tab' : `growth-${key}-tab`);
      if (!tab) return;
      event.preventDefault();
      tab.click();
      tab.focus({ preventScroll: true });
      if (key === 'daily') strip?.scrollIntoView({ block: 'start', behavior: 'auto' });
    } else revealActivity(byId(actions[target.id]));
  }
  // Capture opens the new details before preserved handlers scroll to a quiz/card.
  doc.addEventListener('click', onClick, true);
  root.addEventListener('arcade-progress', reflectCheckIn);
  const viewObserver = new view.MutationObserver(reflectView);
  viewObserver.observe(root, { attributes: true, attributeFilter: ['data-arcade-view'] });
  if (community) viewObserver.observe(community, { attributes: true, attributeFilter: ['hidden'] });
  const copyObserver = new view.MutationObserver(updateSignInCopy);
  for (const id of ['campaign-service-status', 'monthly-status']) {
    const node = byId(id);
    if (node) copyObserver.observe(node, { childList: true, characterData: true, subtree: true });
  }
  reflectView();
  updateSignInCopy();
  root.dataset.arcadeOrganization = 'ready';
  doc.body.classList.add('arcade-organization-page');
  const countdown = mountSeasonCountdowns({ root: doc });
  const controller = { destroy() {
    countdown.destroy();
    viewObserver.disconnect();
    copyObserver.disconnect();
    doc.removeEventListener('click', onClick, true);
    root.removeEventListener('arcade-progress', reflectCheckIn);
    // Leave the arranged DOM in place; remounting must never duplicate controls.
  } };
  mounted.set(doc, controller);
  return controller;
}

if (typeof document !== 'undefined') mountArcadeOrganization();
