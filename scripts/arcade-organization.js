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
  if (campaignHeading) campaignHeading.innerHTML = '<div><p class="growth-eyebrow">PRACTICE FOR YOUR NEXT EVENT</p><h3>Find your next challenge.</h3><p>Discover a game, build your skills, then join its Event. Campaigns will introduce smaller reward opportunities along the way.</p></div>';

  const campaignFeature = element('section', 'arcade-campaign-feature', `
    <div class="arcade-campaign-feature__intro">
      <span class="arcade-campaign-state">CAMPAIGNS IN PREPARATION</span>
      <h4>Get ready for the next prize event.</h4>
      <p>No funded campaign is open yet. Each campaign will show its goals, deadline, reward pool and payout network before entry opens.</p>
    </div>
    <div class="arcade-campaign-event">
      <img src="/assets/arcade/tree-force-89-poster.webp" alt="" width="112" height="112" loading="lazy">
      <div><p class="growth-eyebrow">EXPLORE THE UPCOMING EVENT</p><h4>TREE Force ’89: Defend the Canopy</h4><p>Try the game now and read the Event details. Event dates are still to be announced; practice scores do not count.</p></div>
    </div>
    <ol class="arcade-campaign-path" aria-label="Your path into an Event">
      <li><strong>Explore</strong><span>Choose a game you enjoy.</span></li>
      <li><strong>Practice</strong><span>Learn its goals and controls.</span></li>
      <li><strong>Join an Event</strong><span>Read its rules when entry opens.</span></li>
    </ol>
    <div class="arcade-campaign-actions"><a class="growth-primary" href="/play/treeforce89/">Practice TREE Force ’89 <span aria-hidden="true">→</span></a><a class="growth-secondary" href="#events" data-arcade-route="events">View upcoming Event <span aria-hidden="true">→</span></a></div>
    <p class="arcade-campaign-footnote">Campaign completion is not an Event entry requirement unless the published Event rules say so.</p>
  `);
  if (campaignHeading) campaignHeading.after(campaignFeature);
  else campaigns.prepend(campaignFeature);

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
    // Leave the arranged DOM in place; remounting must never duplicate controls.
  } };
  mounted.set(doc, controller);
  return controller;
}

if (typeof document !== 'undefined') mountArcadeOrganization();
