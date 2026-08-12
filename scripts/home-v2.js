const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const HOME_DASHBOARD_URL = '/api/tree-dashboard';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});
const amount = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  const digits = number < 0.0001 ? 10 : number < 0.01 ? 7 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  }).format(number);
}

function formatMarketValue(field, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (field === 'price') return formatPrice(number);
  if (field === 'priceChange24h') return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return new Intl.NumberFormat('en-US').format(number);
  return money.format(number);
}

function formatSnapshotValue(field, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (field === 'nftree.mintPriceSui') return `${number.toLocaleString()} SUI`;
  return amount.format(number);
}

function valueAt(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function headingCopy(title, eyebrow, description) {
  return `<div class="home-section-heading"><div><span class="supporting-label">${eyebrow}</span><h2>${title}</h2></div><p>${description}</p></div>`;
}

function replaceHeader() {
  const header = document.querySelector('header');
  const originalBrand = header?.querySelector('.brand-wrap');
  const nav = header?.querySelector('nav');
  const actions = header?.querySelector('.header-actions');
  const wallet = header?.querySelector('#wallet-btn');
  if (!header || !originalBrand || !nav || !actions) return;

  if (originalBrand.tagName !== 'A') {
    const brand = document.createElement('a');
    brand.className = 'brand-wrap';
    brand.href = '/';
    brand.setAttribute('aria-label', 'TREE homepage');
    while (originalBrand.firstChild) brand.append(originalBrand.firstChild);
    originalBrand.replaceWith(brand);
  }

  nav.innerHTML = `
    <a href="#about">About</a>
    <a href="#ecosystem">Ecosystem</a>
    <a href="#tokenomics">Tokenomics</a>
    <a href="#roadmap">Roadmap</a>
    <a href="#faq">FAQ</a>
    <a href="#documents">Documents</a>
  `;

  wallet?.setAttribute('hidden', '');
  let launch = actions.querySelector('.header-launch');
  if (!launch) {
    launch = document.createElement('a');
    launch.className = 'header-launch';
    launch.href = '/dapp/';
    launch.textContent = 'Launch App';
    actions.prepend(launch);
  }

  const navShell = document.getElementById('mobile-nav');
  const navToggle = document.getElementById('nav-toggle');
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    navShell?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));
}

function rebuildHero() {
  const hero = document.querySelector('.hero-shell');
  if (!hero) return;
  const kicker = hero.querySelector('.hero-kicker');
  const title = hero.querySelector('.hero-title');
  const sub = hero.querySelector('.hero-sub');
  const stats = hero.querySelector('.hero-stats');
  const actions = hero.querySelector('.hero-actions');
  const side = hero.querySelector('.hero-side');

  if (kicker) kicker.innerHTML = '<span class="seed"></span> TREE ECOSYSTEM • BUILT ON SUI';
  if (title) title.textContent = 'One TREE ecosystem. Clear paths to trade, earn, play, and participate.';
  if (sub) sub.textContent = 'Start with the Command Center for verified market data, wallet rankings, liquidity exposure, and ecosystem tools—then explore NFTree rewards, games, and future utilities.';
  if (stats) stats.innerHTML = `
    <div class="hero-stat"><b data-home-market="price">Loading…</b><span>TREE Price</span></div>
    <div class="hero-stat"><b data-home-market="marketCap">Loading…</b><span>Market Cap</span></div>
    <div class="hero-stat"><b data-home-market="liquidity">Loading…</b><span>Recognized Liquidity</span></div>
    <div class="hero-stat"><b data-home-market="holderCount">Loading…</b><span>Reported Owners</span></div>
  `;
  if (actions) actions.innerHTML = `
    <a class="btn command-center-primary" href="/dapp/"><span class="command-center-icon" aria-hidden="true">⌘</span><span>Launch Command Center<small>LIVE APP</small></span></a>
    <button class="btn hero-primary js-buy-tree-v2" type="button">Buy TREE</button>
    <a class="btn nft-primary" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree</a>
  `;
  if (side) side.innerHTML = `
    <article class="home-start-card">
      <span class="status-badge status-live">Live on Sui</span>
      <h2>New here? Start with the Command Center.</h2>
      <p>See TREE price and liquidity, connect a wallet, check your Canopy rank, and move directly into the utilities that matter to you.</p>
      <div class="home-start-links">
        <a href="/dapp/#swap"><span>Swap TREE</span><b>↗</b></a>
        <a href="/dapp/#leaderboard"><span>Canopy Board</span><b>↗</b></a>
        <a href="/dapp/#earn"><span>Earn</span><b>↗</b></a>
        <a href="/dapp/#documents"><span>Documents</span><b>↗</b></a>
      </div>
    </article>
  `;

  document.querySelectorAll('.js-buy-tree-v2').forEach((button) => button.addEventListener('click', () => {
    if (typeof window.openSwapModal === 'function') window.openSwapModal();
  }));
}

function createLauncher() {
  const hero = document.querySelector('.hero-shell');
  if (!hero || document.querySelector('.home-launcher')) return;
  const section = document.createElement('section');
  section.className = 'home-launcher';
  section.setAttribute('aria-labelledby', 'home-launcher-title');
  section.innerHTML = `
    <div class="home-section-heading">
      <div><span class="supporting-label">TREE APP</span><h2 id="home-launcher-title">Choose what you want to do.</h2></div>
      <p>Simple routes into every major TREE feature, modeled around action—not website jargon.</p>
    </div>
    <div class="home-action-grid">
      <a class="home-action-card" href="/dapp/#swap"><span class="home-action-status">Live</span><span class="home-action-icon">↕</span><strong>Swap</strong><small>Buy TREE through the supported SuiDex route.</small></a>
      <a class="home-action-card" href="/dapp/#limit"><span class="home-action-status planned">Planned</span><span class="home-action-icon">⌁</span><strong>Limit</strong><small>Review the planned TREE limit-order path.</small></a>
      <a class="home-action-card" href="/dapp/#earn"><span class="home-action-status">Live</span><span class="home-action-icon">✦</span><strong>Earn</strong><small>Find V2 farms and current TREE liquidity rewards.</small></a>
      <a class="home-action-card" href="/dapp/#v3"><span class="home-action-status">Live</span><span class="home-action-icon">◫</span><strong>V3</strong><small>Open concentrated-liquidity pools and positions.</small></a>
      <a class="home-action-card" href="/dapp/#stats"><span class="home-action-status">Live</span><span class="home-action-icon">▥</span><strong>Stats</strong><small>Price, liquidity, supply, chart, and NFTree data.</small></a>
      <a class="home-action-card" href="/dapp/#removed"><span class="home-action-status">Tracked</span><span class="home-action-icon">◎</span><strong>Supply Removed</strong><small>Track TREE held at the zero address with clear terminology.</small></a>
      <a class="home-action-card" href="/dapp/#canopy-draw"><span class="home-action-status planned">Development</span><span class="home-action-icon">🎟</span><strong>Raffle</strong><small>Review the Canopy Draw concept and status.</small></a>
      <a class="home-action-card" href="/dapp/#leaderboard"><span class="home-action-status">Live</span><span class="home-action-icon">♛</span><strong>Board</strong><small>See the verified Top 50 and your connected-wallet rank.</small></a>
      <a class="home-action-card" href="/dapp/#profile-studio"><span class="home-action-status">Live</span><span class="home-action-icon">◎</span><strong>Studio</strong><small>Create a TREE profile image entirely in your browser.</small></a>
      <a class="home-action-card" href="/dapp/#documents"><span class="home-action-status">Official</span><span class="home-action-icon">▤</span><strong>Documents</strong><small>Litepaper, coin type, methodology, and official links.</small></a>
    </div>
  `;
  hero.insertAdjacentElement('afterend', section);
}

function rebuildAbout(section) {
  section.classList.add('home-screen');
  section.innerHTML = `
    <div class="about-layout">
      <div class="about-copy">
        <span class="supporting-label">ABOUT TREE</span>
        <h2>A utility ecosystem built around one Sui token and one NFT access layer.</h2>
        <p>TREE is the utility token at the center of Thickquidity. NFTree is the ecosystem access asset connecting holder rewards, Garden Battles, identity, referral qualification, and planned future applications.</p>
        <p>The project combines transparent on-chain data, recognized liquidity venues, practical NFT utility, games, and documented real-world support through TREE Fund.</p>
        <div class="card-actions"><a class="btn command-center-primary" href="/dapp/">Open Command Center</a><a class="btn secondary" href="#ecosystem">Explore Utilities</a></div>
      </div>
      <div class="home-fact-list">
        <div class="home-fact"><span>Network</span><strong>Sui Mainnet</strong></div>
        <div class="home-fact"><span>Token</span><strong>TREE</strong></div>
        <div class="home-fact"><span>NFT access</span><strong>NFTree</strong></div>
        <div class="home-fact"><span>Live rewards</span><strong>TreeDrop</strong></div>
        <div class="home-fact"><span>Live game</span><strong>Garden Battles</strong></div>
        <div class="home-fact"><span>Impact allocation</span><strong>5% of NFTree sales</strong></div>
      </div>
    </div>
  `;
}

function rebuildTokenomics(section) {
  section.id = 'tokenomics';
  section.classList.add('home-screen');
  section.removeAttribute('style');
  section.innerHTML = `
    <div class="tokenomics-copy">
      <span class="supporting-label">TOKENOMICS</span>
      <h2>Fixed supply, visible locks, and clearly labeled supply removal.</h2>
      <p>TREE has a fixed total supply of one billion tokens. The dashboard separates total supply, effective supply, zero-address holdings, and Moonbags locks so investors can distinguish confirmed balances from estimates.</p>
    </div>
    <div class="tokenomics-grid">
      <article class="tokenomics-card"><span>Total Supply</span><strong data-home-snapshot="tree.totalSupply">Loading…</strong></article>
      <article class="tokenomics-card"><span>Effective Supply</span><strong data-home-snapshot="tree.effectiveSupply">Loading…</strong></article>
      <article class="tokenomics-card"><span>Effectively Removed</span><strong data-home-snapshot="tree.zeroAddressBalance">Loading…</strong></article>
      <article class="tokenomics-card"><span>Moonbags Locked</span><strong data-home-snapshot="tree.moonbagsLocked">Loading…</strong></article>
      <article class="tokenomics-card"><span>Native Network</span><strong>Sui Mainnet</strong></article>
      <article class="tokenomics-card"><span>NFTree Mint</span><strong data-home-snapshot="nftree.mintPriceSui">Loading…</strong></article>
      <article class="tokenomics-card"><span>Recognized Liquidity</span><strong data-home-market="liquidity">Loading…</strong></article>
      <article class="tokenomics-card"><span>Reported Owners</span><strong data-home-market="holderCount">Loading…</strong></article>
    </div>
    <p class="tokenomics-note">TREE held by the zero address is described as “effectively removed from circulation.” This does not mean the on-chain contract supply has been reduced. All dated snapshot figures remain labeled with their source date inside the Command Center.</p>
  `;
}

function createRoadmap() {
  const section = document.createElement('section');
  section.className = 'panel home-screen';
  section.id = 'roadmap';
  section.innerHTML = `
    ${headingCopy('A roadmap built around usable products.', 'ROADMAP', 'Completed work stays visible, active development is separated from future plans, and planned utilities are never presented as live.')}
    <div class="roadmap-grid">
      <article class="roadmap-card"><span class="phase">Phase 1</span><h3>Foundation</h3><p>TREE launch, recognized Sui liquidity, project website, NFTree collection, and TREE Fund allocation.</p><span class="roadmap-state">Complete</span></article>
      <article class="roadmap-card"><span class="phase">Phase 2</span><h3>Live Utility</h3><p>NFTree minting, TreeDrop rewards, Garden Battles, Command Center, verified exposure board, tiers, and badges.</p><span class="roadmap-state">Live</span></article>
      <article class="roadmap-card"><span class="phase">Phase 3</span><h3>Expansion</h3><p>Arboretum, expanded marketplace tooling, Canopy Draw legal and technical review, and deeper ecosystem integrations.</p><span class="roadmap-state building">Building</span></article>
      <article class="roadmap-card"><span class="phase">Phase 4</span><h3>Multichain Reach</h3><p>Extend selected TREE and NFTree utilities to additional chains while preserving Sui as the verified source of ownership.</p><span class="roadmap-state planned">Planned</span></article>
    </div>
  `;
  return section;
}

function createFaq() {
  const section = document.createElement('section');
  section.className = 'panel home-screen';
  section.id = 'faq';
  section.innerHTML = `
    ${headingCopy('Questions a new holder should be able to answer quickly.', 'FAQ', 'Direct answers about TREE, NFTree, rankings, supply terminology, and what is live today.')}
    <div class="faq-list">
      <details><summary>What is TREE?</summary><p>TREE is the utility token for the Thickquidity ecosystem on Sui. It connects liquidity, NFTree access, rewards infrastructure, games, identity, and future applications.</p></details>
      <details><summary>How do I buy TREE?</summary><p>Open the Command Center and use the Swap section or follow the official SuiDex route. Always verify the complete TREE coin type before signing a transaction.</p></details>
      <details><summary>What is NFTree?</summary><p>NFTree is a one-time 25 SUI ecosystem access asset. It can qualify a wallet for TreeDrop reward rounds, Garden Battles, referral eligibility, identity features, and planned future TREE utilities.</p></details>
      <details><summary>How is the Canopy Board calculated?</summary><p>The verified board ranks total TREE exposure: liquid TREE plus current principal TREE attributed to recognized SuiDex V2, SuiDex V3, and Turbos positions. Incomplete scans never replace a complete ranking.</p></details>
      <details><summary>Is TREE at the zero address officially burned?</summary><p>The public site uses the more precise wording “effectively removed from circulation.” Those tokens are inaccessible at the zero address, but the TREE contract’s reported total supply remains one billion.</p></details>
      <details><summary>Is the Canopy Draw raffle live?</summary><p>No. It remains a development preview. No entries are accepted and no prizes are offered until legal, funding, and technical requirements are completed.</p></details>
      <details><summary>Where can I find official documents?</summary><p>The Documents section includes the litepaper, official coin type, Command Center methodology, marketplace link, and official community channels.</p></details>
    </div>
  `;
  return section;
}

function createDocuments() {
  const section = document.createElement('section');
  section.className = 'panel home-screen';
  section.id = 'documents';
  section.innerHTML = `
    ${headingCopy('Verify before you participate.', 'DOCUMENTS', 'Official resources for investors, token users, NFTree holders, and anyone reviewing the project.')}
    <div class="documents-grid">
      <article class="document-card"><span class="home-action-icon">▤</span><h3>Litepaper</h3><p>Project vision, tokenomics, utilities, and ecosystem direction.</p><a class="btn secondary" href="Litepaper.pdf" target="_blank" rel="noopener noreferrer">Open Litepaper</a></article>
      <article class="document-card"><span class="home-action-icon">♛</span><h3>Board Methodology</h3><p>Review complete-only exposure calculations, tier thresholds, and badge definitions.</p><a class="btn secondary" href="/dapp/#leaderboard">View Methodology</a></article>
      <article class="document-card"><span class="home-action-icon">🌳</span><h3>NFTree Collection</h3><p>View holder-owned NFTrees and current marketplace listings.</p><a class="btn secondary" href="https://www.tradeport.xyz/sui/collection/0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT?tab=items" target="_blank" rel="noopener noreferrer">Open TradePort</a></article>
      <article class="document-card"><span class="home-action-icon">◉</span><h3>Market Data</h3><p>Open the official Noodles market page for the TREE coin type.</p><a class="btn secondary" href="https://noodles.fi/coins/${encodeURIComponent(TREE_COIN_TYPE)}?trade=market" target="_blank" rel="noopener noreferrer">Open Noodles</a></article>
    </div>
    <code class="home-coin-type">${TREE_COIN_TYPE}</code>
    <div class="card-actions" style="margin-top:10px"><button class="btn coin-copy-v2" type="button">Copy Official Coin Type</button><a class="btn command-center-primary" href="/dapp/#documents">Open App Documents</a></div>
  `;
  section.querySelector('.coin-copy-v2')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(TREE_COIN_TYPE);
      window.showToast?.('TREE coin type copied');
    } catch {
      window.showToast?.('Unable to copy coin type');
    }
  });
  return section;
}

function createGetStarted() {
  const section = document.createElement('section');
  section.className = 'panel home-screen';
  section.id = 'get-started';
  section.innerHTML = `
    ${headingCopy('From new visitor to active participant.', 'GET STARTED', 'A simple path for someone discovering TREE for the first time.')}
    <div class="get-started-grid">
      <article class="start-step"><span class="start-number">1</span><h3>Get a Sui wallet</h3><p>Use Slush, Phantom, or another Sui Wallet Standard provider. Back up your recovery information securely.</p></article>
      <article class="start-step"><span class="start-number">2</span><h3>Fund it with SUI</h3><p>SUI pays for network gas and is the primary route into TREE and the 25 SUI NFTree mint.</p></article>
      <article class="start-step"><span class="start-number">3</span><h3>Launch the app</h3><p>Open the Command Center to view stats, connect your wallet, trade, and check your Canopy position.</p></article>
      <article class="start-step"><span class="start-number">4</span><h3>Choose your utility</h3><p>Mint an NFTree, check TreeDrop, play Garden Battles, or participate through supported liquidity venues.</p></article>
    </div>
    <div class="card-actions" style="margin-top:16px"><a class="btn command-center-primary" href="/dapp/">Launch Command Center</a><a class="btn nft-primary" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree</a><a class="btn purple" href="https://treedrop.xyz" target="_blank" rel="noopener noreferrer">Check Rewards</a></div>
  `;
  return section;
}

function createNumbers() {
  const section = document.createElement('section');
  section.className = 'home-number-section';
  section.id = 'numbers';
  section.innerHTML = `
    <div class="home-section-heading"><div><span class="supporting-label">TREE BY THE NUMBERS</span><h2>Key data at a glance.</h2></div><p>Market values load live when available. Supply and NFTree figures remain visibly tied to the project snapshot returned by the dashboard.</p></div>
    <div class="home-number-grid">
      <article class="home-number"><span>Price</span><strong data-home-market="price">Loading…</strong></article>
      <article class="home-number"><span>24h Change</span><strong data-home-market="priceChange24h">Loading…</strong></article>
      <article class="home-number"><span>Market Cap</span><strong data-home-market="marketCap">Loading…</strong></article>
      <article class="home-number"><span>Liquidity</span><strong data-home-market="liquidity">Loading…</strong></article>
      <article class="home-number"><span>Total Supply</span><strong data-home-snapshot="tree.totalSupply">Loading…</strong></article>
      <article class="home-number"><span>NFTree Mint</span><strong data-home-snapshot="nftree.mintPriceSui">Loading…</strong></article>
    </div>
  `;
  return section;
}

function reorganizeContent() {
  const main = document.querySelector('main');
  const ecosystem = document.getElementById('ecosystem');
  const deck = document.querySelector('.deck');
  const content = deck?.firstElementChild;
  const about = document.getElementById('about');
  const tokenFacts = document.getElementById('token-facts');
  const impact = document.getElementById('impact');
  if (!main || !ecosystem || !deck || !content || !about || !tokenFacts) return;

  document.querySelector('.coin-strip')?.remove();
  deck.querySelector('.aside')?.remove();
  ecosystem.querySelector(':scope > .card-actions')?.remove();
  const ecosystemTitle = ecosystem.querySelector('.section-title');
  const ecosystemIntro = ecosystem.querySelector('.section-intro');
  if (ecosystemTitle) ecosystemTitle.textContent = 'Live TREE Utilities';
  if (ecosystemIntro) ecosystemIntro.textContent = 'Start with the product you need. Each card clearly distinguishes live utilities from planned development.';

  const removeTitles = new Set(['Our Mission', '$TREE Litepaper', 'Community & Updates', 'Join the TREE Ecosystem']);
  [...content.querySelectorAll(':scope > section')].forEach((section) => {
    const title = section.querySelector('.section-title')?.textContent?.trim();
    if (section.id === 'nftree' || section.id === 'litepaper' || section.id === 'join' || removeTitles.has(title)) section.remove();
  });

  rebuildAbout(about);
  rebuildTokenomics(tokenFacts);
  const roadmap = createRoadmap();
  const faq = createFaq();
  const documents = createDocuments();
  const getStarted = createGetStarted();

  about.insertAdjacentElement('afterend', tokenFacts);
  tokenFacts.insertAdjacentElement('afterend', roadmap);
  if (impact) {
    impact.classList.add('home-screen');
    impact.removeAttribute('style');
    roadmap.insertAdjacentElement('afterend', impact);
    impact.insertAdjacentElement('afterend', faq);
  } else roadmap.insertAdjacentElement('afterend', faq);
  faq.insertAdjacentElement('afterend', documents);
  documents.insertAdjacentElement('afterend', getStarted);
  main.append(createNumbers());
}

function simplifyFooter() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-v2">
      <div><h2>THICKQUIDITY · TREE on Sui</h2><p>Token utility, NFTree access, rewards, games, liquidity, verified holder data, and documented real-world impact.</p></div>
      <nav class="footer-links" aria-label="Footer links"><a href="/dapp/">Command Center</a><a href="#about">About</a><a href="#tokenomics">Tokenomics</a><a href="#roadmap">Roadmap</a><a href="#faq">FAQ</a><a href="#documents">Documents</a><a href="https://x.com/thickquidity" target="_blank" rel="noopener noreferrer">X</a><a href="https://t.me/thickquidity" target="_blank" rel="noopener noreferrer">Telegram</a></nav>
      <p class="footer-risk">TREE and related ecosystem products involve blockchain, digital-asset, smart-contract, liquidity, and transaction risk. Prices can fluctuate substantially. Verify the official TREE coin type and review transaction details before signing. Nothing on this website is financial advice.</p>
    </div>
  `;
}

async function loadHomeData() {
  try {
    const response = await fetch(HOME_DASHBOARD_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
    const payload = await response.json();
    const market = payload.live?.data || null;
    const snapshot = payload.snapshot || null;
    document.querySelectorAll('[data-home-market]').forEach((node) => {
      const field = node.dataset.homeMarket;
      node.textContent = formatMarketValue(field, market?.[field]);
      if (field === 'priceChange24h' && Number.isFinite(Number(market?.[field]))) {
        node.classList.toggle('price-change-up', Number(market[field]) >= 0);
        node.classList.toggle('price-change-down', Number(market[field]) < 0);
      }
    });
    document.querySelectorAll('[data-home-snapshot]').forEach((node) => {
      const field = node.dataset.homeSnapshot;
      node.textContent = formatSnapshotValue(field, valueAt(snapshot, field));
    });
  } catch (error) {
    document.querySelectorAll('[data-home-market],[data-home-snapshot]').forEach((node) => {
      if (/loading/i.test(node.textContent || '')) node.textContent = 'Unavailable';
    });
    console.warn('Homepage summary data was unavailable.', error);
  }
}

function disableLegacyClutter() {
  try { localStorage.setItem('tree.launchPopupDismissedAt', String(Date.now())); } catch { /* Storage is optional. */ }
  document.querySelector('.launch-popup')?.remove();
  document.querySelector('.fab-group')?.remove();
}

function initializeHomeV2() {
  document.documentElement.classList.add('home-v2');
  disableLegacyClutter();
  replaceHeader();
  rebuildHero();
  createLauncher();
  reorganizeContent();
  simplifyFooter();
  loadHomeData();
}

initializeHomeV2();
