const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const DASHBOARD_URL = '/api/tree-dashboard';

const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

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

function formatMarket(field, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (field === 'price') return formatPrice(number);
  if (field === 'priceChange24h') return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return wholeNumber.format(number);
  return compactMoney.format(number);
}

function buildHeader() {
  const header = document.querySelector('header');
  if (!header) return;
  header.innerHTML = `
    <div class="simple-header-inner">
      <a class="simple-brand" href="/" aria-label="Thickquidity TREE home">
        <img src="/thick.png" alt="">
        <span><strong>THICKQUIDITY</strong><small>TREE on Sui</small></span>
      </a>
      <button class="simple-menu-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="simple-site-nav">
        <span></span><span></span><span></span>
      </button>
      <nav class="simple-site-nav" id="simple-site-nav" aria-label="Main navigation">
        <a class="active" href="/">Home</a>
        <a href="/dapp/">App</a>
        <a href="/about/">About</a>
        <a href="/tokenomics/">Tokenomics</a>
        <a href="/roadmap/">Roadmap</a>
        <a href="/faq/">FAQ</a>
        <a href="/documents/">Docs</a>
      </nav>
      <a class="simple-header-cta" href="/dapp/#swap">Buy TREE</a>
    </div>
  `;

  const menu = header.querySelector('.simple-menu-button');
  const nav = header.querySelector('.simple-site-nav');
  menu?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open') || false;
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  }));
}

function buildHomepage() {
  document.documentElement.classList.remove('home-v2');
  document.documentElement.classList.add('home-simple');
  document.querySelectorAll('.launch-popup,.fab-group,.swap-backdrop,.booklet-modal,.scroll-top,.toast,.parallax-layer').forEach((node) => node.remove());

  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="simple-hero" aria-labelledby="simple-hero-title">
        <div class="simple-hero-copy">
          <p class="simple-eyebrow">TREE ECOSYSTEM · BUILT ON SUI</p>
          <h1 id="simple-hero-title">Grow with the TREE ecosystem.</h1>
          <p class="simple-tagline"><strong>$TREE is the root token.</strong> NFTrees are your place in the forest.</p>
          <p class="simple-lead">Trade TREE, mint NFTrees, access holder rewards, play Garden Battles, and follow verified ecosystem data from one clear starting point.</p>
          <div class="simple-hero-actions">
            <a class="simple-button primary" href="/dapp/">Launch App</a>
            <a class="simple-button secondary" href="/dapp/#swap">Buy TREE</a>
            <a class="simple-text-link" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree ↗</a>
          </div>
        </div>
        <div class="simple-hero-visual" aria-label="Thickquidity TREE artwork">
          <div class="simple-orbit orbit-one"></div>
          <div class="simple-orbit orbit-two"></div>
          <img src="/assets/profile-thickquidity-art.png" alt="Thickquidity TREE hero artwork">
          <span class="simple-live-badge">LIVE ON SUI</span>
        </div>
        <div class="simple-stat-strip" aria-label="TREE market summary">
          <article><span>Price</span><strong data-home-market="price">Loading…</strong></article>
          <article><span>24h</span><strong data-home-market="priceChange24h">Loading…</strong></article>
          <article><span>Market Cap</span><strong data-home-market="marketCap">Loading…</strong></article>
          <article><span>Liquidity</span><strong data-home-market="liquidity">Loading…</strong></article>
          <article><span>Owners</span><strong data-home-market="holderCount">Loading…</strong></article>
        </div>
      </section>

      <section class="simple-live-row" aria-label="Live TREE utilities">
        <a href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer"><span>🌳</span><strong>NFTree Minting</strong><small>Live · 25 SUI</small></a>
        <a href="https://treedrop.xyz" target="_blank" rel="noopener noreferrer"><span>🎁</span><strong>TreeDrop Rewards</strong><small>Live holder claims</small></a>
        <a href="https://nftree.net/battle" target="_blank" rel="noopener noreferrer"><span>⚔️</span><strong>Garden Battles</strong><small>Live NFTree game</small></a>
      </section>
    `;
  }

  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = `
      <div class="simple-footer-inner">
        <div><strong>THICKQUIDITY · TREE</strong><p>Utility, NFTree access, rewards, games, liquidity, and verified data on Sui.</p></div>
        <div class="simple-footer-links">
          <a href="https://x.com/thickquidity" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://t.me/thickquidity" target="_blank" rel="noopener noreferrer">Telegram</a>
          <a href="https://www.youtube.com/@thecryptoarborist" target="_blank" rel="noopener noreferrer">YouTube</a>
          <a href="https://www.coingecko.com/en/coins/thickquidity" target="_blank" rel="noopener noreferrer">CoinGecko</a>
        </div>
        <p class="simple-risk">Digital assets, smart contracts, and liquidity positions involve risk. Verify the official TREE coin type before signing any transaction. Nothing on this site is financial advice.</p>
      </div>
    `;
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(DASHBOARD_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
    const payload = await response.json();
    const market = payload?.live?.data || null;
    document.querySelectorAll('[data-home-market]').forEach((element) => {
      const field = element.dataset.homeMarket;
      element.textContent = formatMarket(field, market?.[field]);
      if (field === 'priceChange24h' && Number.isFinite(Number(market?.[field]))) {
        element.classList.toggle('positive', Number(market[field]) >= 0);
        element.classList.toggle('negative', Number(market[field]) < 0);
      }
    });
  } catch (error) {
    document.querySelectorAll('[data-home-market]').forEach((element) => { element.textContent = 'Unavailable'; });
    console.error('TREE homepage dashboard unavailable:', error);
  }
}

function initializeSimpleHome() {
  buildHeader();
  buildHomepage();
  loadDashboard();
  window.TREE_COIN_TYPE = TREE_COIN_TYPE;
}

initializeSimpleHome();