import { HOME_MARKET_FIELDS, formatMarket, resolveHomeMarket, validMarketValue } from './home-market-core.js';

// Production serves this module directly without a Vite build. Keep asset URLs
// browser-native so embedded wallet browsers can evaluate the module.
const treeHeroVideoUrl = '/assets/tree-hero-walking.mp4';
const treeHeroPosterUrl = '/assets/tree-hero-poster.webp';
const treeBrandLogoUrl = '/assets/tree-token-logo-official.webp';
const coinGeckoLogoUrl = '/assets/CG.png';
const treeFundContributionUrl = '/assets/tree-fund-first-donation.png';
const salutingBranchesLogoUrl = '/assets/saluting-branches-logo.svg';
const nftreeArtworkUrl = '/assets/profile-nftree-art.jpg';

const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const DASHBOARD_URL = '/api/tree-dashboard';
const VERIFIED_LIQUIDITY_URL = '/api/tree-liquidity';
const HOME_MARKET_CACHE_KEY = 'tree-home-market-last-success-v1';

function readHomeMarketCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(HOME_MARKET_CACHE_KEY) || 'null');
    return cached && typeof cached.data === 'object' ? cached.data : null;
  } catch {
    try { localStorage.removeItem(HOME_MARKET_CACHE_KEY); } catch { /* storage is optional */ }
    return null;
  }
}

function writeHomeMarketCache(data) {
  if (!HOME_MARKET_FIELDS.every((field) => validMarketValue(data?.[field]))) return;
  try { localStorage.setItem(HOME_MARKET_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data })); } catch { /* storage is optional */ }
}

async function requestDashboard(fresh = false) {
  const url = fresh ? `${DASHBOARD_URL}?fresh=${Date.now()}` : DASHBOARD_URL;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: fresh ? 'no-store' : 'default' });
  if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
  return response.json();
}

async function requestVerifiedLiquidity() {
  const response = await fetch(`${VERIFIED_LIQUIDITY_URL}?fresh=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  const value = Number(payload?.liquidity?.recognizedLiquidityUsd);
  if (!response.ok || payload?.status !== 'ok' || !Number.isFinite(value) || value <= 0) throw new Error('Verified TREE liquidity is unavailable.');
  return value;
}

function buildHeader() {
  const header = document.querySelector('header');
  if (!header) return;
  header.innerHTML = `
    <div class="simple-header-inner">
      <a class="simple-brand" href="/" aria-label="Thickquidity TREE home">
        <img src="${treeBrandLogoUrl}" alt="TREE emblem">
        <span><strong>THICKQUIDITY</strong><small>TREE on Sui</small></span>
      </a>
      <button class="simple-menu-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="simple-site-nav">
        <span></span><span></span><span></span>
      </button>
      <nav class="simple-site-nav" id="simple-site-nav" aria-label="Main navigation">
        <a class="active" href="/">Home</a>
        <a href="/dapp/">App</a>
        <a href="/play">Play</a>
        <a href="/about/">About</a>
        <a href="/tokenomics/">Tokenomics</a>
        <a href="/roadmap/">Roadmap</a>
        <a href="/faq/">FAQ</a>
        <a href="/documents/">Docs</a>
      </nav>
      <div class="simple-header-actions">
        <div class="simple-header-socials" aria-label="TREE social media and market links">
          <a class="social-x" href="https://x.com/thickquidity" target="_blank" rel="noopener noreferrer" aria-label="TREE on X" title="X">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
          </a>
          <a class="social-telegram" href="https://t.me/thickquidity" target="_blank" rel="noopener noreferrer" aria-label="TREE on Telegram" title="Telegram">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.94 4.66c.3-1.4-.52-1.94-1.74-1.48L2.6 9.98c-1.2.47-1.18 1.14-.22 1.44l4.51 1.41L17.35 6.2c.49-.3.94-.14.57.19l-8.47 7.65-.32 4.65c.47 0 .68-.2.92-.44l2.22-2.12 4.6 3.39c.84.46 1.44.22 1.67-.78l3.4-14.08Z"/></svg>
          </a>
          <a class="social-youtube" href="https://www.youtube.com/@thecryptoarborist" target="_blank" rel="noopener noreferrer" aria-label="The Crypto Arborist on YouTube" title="YouTube">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.13C19.55 3.56 12 3.56 12 3.56s-7.55 0-9.4.51A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.13c1.85.51 9.4.51 9.4.51s7.55 0 9.4-.51a3 3 0 0 0 2.1-2.13A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"/><path class="youtube-play" d="m9.6 15.6 6.27-3.6L9.6 8.4v7.2Z"/></svg>
          </a>
          <a class="social-coingecko" href="https://www.coingecko.com/en/coins/thickquidity" target="_blank" rel="noopener noreferrer" aria-label="TREE on CoinGecko" title="CoinGecko">
            <img src="${coinGeckoLogoUrl}" alt="">
          </a>
        </div>
        <a class="simple-header-cta" href="/dapp/#swap">Buy TREE</a>
      </div>
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
  document.querySelectorAll('.launch-popup,.fab-group,.swap-backdrop,.booklet-modal,.simple-impact-modal,.scroll-top,.toast,.parallax-layer').forEach((node) => node.remove());

  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="simple-hero" aria-labelledby="simple-hero-title">
        <div class="simple-hero-copy">
          <p class="simple-eyebrow">TREE ECOSYSTEM · BUILT ON SUI</p>
          <h1 id="simple-hero-title">Grow with the TREE ecosystem.</h1>
          <p class="simple-tagline"><strong>$TREE is the root token.</strong> Holding an NFTree is your access pass to every utility released across the TREE ecosystem.</p>
          <p class="simple-lead">TREE connects token tools, NFTree ownership and utility, and a growing arcade of ecosystem games from one clear starting point.</p>
        </div>
        <div class="simple-hero-visual" aria-label="TREE hero video">
          <div class="simple-orbit orbit-one"></div>
          <div class="simple-orbit orbit-two"></div>
          <div class="simple-hero-media">
            <video class="simple-hero-video" autoplay muted loop playsinline preload="auto" poster="${treeHeroPosterUrl}" aria-label="TREE hero walking through the ecosystem">
              <source src="${treeHeroVideoUrl}" type="video/mp4">
            </video>
            <button class="simple-video-toggle" type="button" aria-label="Pause hero video" title="Pause video"><span aria-hidden="true">⏸</span></button>
            <span class="simple-live-badge">LIVE ON SUI</span>
          </div>
        </div>
        <div class="simple-hero-actions" aria-label="TREE ecosystem destinations">
          <a class="simple-button primary simple-launch-app simple-destination-button" href="/dapp/">
            <span class="simple-destination-icon"><img src="${treeBrandLogoUrl}" alt=""></span>
            <span class="simple-destination-copy"><strong>Open TREE App</strong><small>Trade · Earn · Explore</small></span>
            <b class="simple-destination-arrow" aria-hidden="true">→</b>
          </a>
          <div class="simple-action-stack nftree-action-stack">
            <a class="simple-button secondary simple-destination-button nftree-market-button" href="https://nftree.net/" target="_blank" rel="noopener noreferrer">
              <span class="simple-destination-icon"><img src="${nftreeArtworkUrl}" alt=""></span>
              <span class="simple-destination-copy"><strong>NFTree Marketplace</strong><small>Your ecosystem access pass</small></span>
              <b class="simple-destination-arrow" aria-hidden="true">↗</b>
            </a>
            <a class="simple-sub-button nftree-rewards-button" href="https://www.treedrop.xyz/" target="_blank" rel="noopener noreferrer"><span class="simple-reward-spark" aria-hidden="true">◆</span> Claim NFTree Rewards <span aria-hidden="true">↗</span></a>
          </div>
          <a class="simple-button arcade-button simple-destination-button" href="/play">
            <span class="simple-arcade-pixel" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="simple-destination-copy"><strong>Enter TREE Arcade</strong><small>Play TREE games</small></span>
            <b class="simple-destination-arrow" aria-hidden="true">→</b>
          </a>
        </div>
        <div class="simple-stat-strip" aria-label="TREE market summary">
          <article><span>Price</span><strong data-home-market="price">Loading…</strong></article>
          <article><span>24h</span><strong data-home-market="priceChange24h">Loading…</strong></article>
          <article><span>Market Cap</span><strong data-home-market="marketCap">Loading…</strong></article>
          <article><span>Liquidity</span><strong data-home-market="liquidity">Loading…</strong></article>
          <article><span>Owners</span><strong data-home-market="holderCount">Loading…</strong></article>
        </div>
      </section>
      <section class="simple-utility" aria-labelledby="simple-utility-title">
        <div class="simple-utility-heading">
          <div>
            <p class="simple-impact-kicker">UTILITY YOU CAN USE TODAY</p>
            <h2 id="simple-utility-title">What You Can Do With TREE</h2>
          </div>
          <p>Trade, earn, compete, and access a growing ecosystem from one connected wallet.</p>
        </div>
        <div class="simple-utility-grid">
          <a class="simple-utility-card utility-trade" href="/dapp/#swap">
            <span class="simple-utility-icon" aria-hidden="true">↕</span>
            <span><strong>Trade &amp; Earn</strong><small>Swap TREE, provide V2/V3 liquidity, manage positions, and put Victory rewards to work.</small></span>
            <b aria-hidden="true">→</b>
          </a>
          <a class="simple-utility-card utility-compete" href="/dapp/#canopy-draw">
            <span class="simple-utility-icon" aria-hidden="true">◆</span>
            <span><strong>Compete &amp; Build Rank</strong><small>Enter the TREE Knowledge Trial and climb the verified Canopy Top 50.</small></span>
            <b aria-hidden="true">→</b>
          </a>
          <a class="simple-utility-card utility-access" href="/play">
            <span class="simple-utility-icon" aria-hidden="true">♣</span>
            <span><strong>Access the Ecosystem</strong><small>NFTree ownership unlocks games, rewards, and new TREE utilities as they are released.</small></span>
            <b aria-hidden="true">→</b>
          </a>
        </div>
        <div class="simple-live-now" aria-label="TREE features available now">
          <strong><span aria-hidden="true"></span> Live Now</strong>
          <p>Swap <i>·</i> Limit Orders <i>·</i> V2/V3 Liquidity <i>·</i> Victory Center <i>·</i> Knowledge Trial <i>·</i> Canopy</p>
        </div>
        <div class="simple-onboarding-row">
          <a class="simple-beginner-path" href="/sui-guide/">
            <span class="simple-beginner-number" aria-hidden="true">123</span>
            <span><small>New to Sui?</small><strong>Open the Getting Started guide</strong></span>
            <b aria-hidden="true">→</b>
          </a>
          <div class="simple-trust-strip" aria-label="TREE ecosystem verification">
            <span>Built on Sui</span>
            <span>Liquidity across SuiDex, Turbos &amp; Cetus</span>
            <span>Live on-chain statistics</span>
            <button class="simple-coin-copy" type="button" data-copy-tree-coin title="Copy the official TREE coin type">
              <span>Verified TREE coin type</span><code>0x6c5a…4895cf</code><b>Copy</b>
            </button>
            <small class="simple-copy-status" aria-live="polite"></small>
          </div>
        </div>
      </section>
      <section class="simple-causes" id="causes-i-support" aria-labelledby="simple-causes-title">
        <div class="simple-causes-heading">
          <div>
            <p class="simple-impact-kicker">GROWING GOOD BEYOND THE ECOSYSTEM</p>
            <h2 id="simple-causes-title">Causes I Support</h2>
          </div>
          <p class="simple-causes-summary">I donate 5% of NFTree sales to causes like TREE Fund and Saluting Branches.</p>
        </div>
        <div class="simple-causes-grid">
          <article class="simple-impact simple-impact-tree-fund">
            <div class="simple-impact-preview simple-impact-proof-preview" aria-hidden="true">
              <img src="${treeFundContributionUrl}" alt="">
            </div>
            <div class="simple-impact-copy">
              <h3>TREE Fund</h3>
              <div class="simple-impact-actions">
                <a class="simple-button primary" href="https://treefund.org/" target="_blank" rel="noopener noreferrer">Learn About TREE Fund <span aria-hidden="true">↗</span></a>
                <button class="simple-button secondary simple-impact-proof-open" type="button">View Contribution</button>
              </div>
            </div>
          </article>
          <article class="simple-impact simple-impact-saluting-branches">
            <div class="simple-impact-preview simple-impact-logo-preview">
              <img src="${salutingBranchesLogoUrl}" alt="Saluting Branches logo">
            </div>
            <div class="simple-impact-copy">
              <h3>Saluting Branches</h3>
              <div class="simple-impact-actions">
                <a class="simple-button primary" href="https://www.salutingbranches.org/" target="_blank" rel="noopener noreferrer">Visit Saluting Branches <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </article>
        </div>
      </section>
      <div class="simple-impact-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="simple-impact-modal-title">
        <div class="simple-impact-modal-card">
          <div class="simple-impact-modal-header">
            <div>
              <p class="simple-impact-kicker">DOCUMENTED CONTRIBUTION</p>
              <h2 id="simple-impact-modal-title">TREE Fund contribution</h2>
            </div>
            <button class="simple-impact-modal-close" type="button" aria-label="Close contribution proof">×</button>
          </div>
          <div class="simple-impact-document">
            <img src="${treeFundContributionUrl}" alt="TREE Fund acknowledgment documenting a total contribution of $107.05 on May 23, 2026">
            <span class="simple-impact-redaction" aria-hidden="true"></span>
          </div>
          <p class="simple-impact-privacy-note">The personal greeting is concealed; the contribution date, amount, and NFTree proceeds explanation remain visible.</p>
        </div>
      </div>
    `;

    const heroVideo = main.querySelector('.simple-hero-video');
    const videoToggle = main.querySelector('.simple-video-toggle');
    if (heroVideo instanceof HTMLVideoElement && videoToggle instanceof HTMLButtonElement) {
      heroVideo.muted = true;
      heroVideo.defaultMuted = true;
      heroVideo.playsInline = true;
      heroVideo.setAttribute('muted', '');
      heroVideo.setAttribute('playsinline', '');
      heroVideo.setAttribute('webkit-playsinline', '');
      const updateVideoToggle = () => {
        const paused = heroVideo.paused;
        const icon = videoToggle.querySelector('span');
        if (icon) icon.textContent = paused ? '▶' : '⏸';
        videoToggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} hero video`);
        videoToggle.setAttribute('title', `${paused ? 'Play' : 'Pause'} video`);
      };
      const attemptAutoplay = () => {
        heroVideo.muted = true;
        try {
          const playback = heroVideo.play();
          if (playback && typeof playback.then === 'function') playback.then(updateVideoToggle).catch(updateVideoToggle);
          else updateVideoToggle();
        } catch {
          updateVideoToggle();
        }
      };
      videoToggle.addEventListener('click', () => {
        if (heroVideo.paused) attemptAutoplay();
        else heroVideo.pause();
      });
      heroVideo.addEventListener('play', updateVideoToggle);
      heroVideo.addEventListener('pause', updateVideoToggle);
      heroVideo.addEventListener('canplay', attemptAutoplay, { once: true });
      window.addEventListener('pageshow', attemptAutoplay, { once: true });
      document.addEventListener('touchstart', attemptAutoplay, { once: true, passive: true });
      attemptAutoplay();
      updateVideoToggle();
    }

    const impactModal = main.querySelector('.simple-impact-modal');
    const impactOpen = main.querySelector('.simple-impact-proof-open');
    const impactClose = main.querySelector('.simple-impact-modal-close');
    if (impactModal instanceof HTMLElement) document.body.append(impactModal);
    let impactReturnFocus = null;
    const closeImpactProof = () => {
      if (!(impactModal instanceof HTMLElement)) return;
      impactModal.classList.remove('open');
      impactModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('simple-impact-modal-open');
      if (impactReturnFocus instanceof HTMLElement) impactReturnFocus.focus();
    };
    const openImpactProof = () => {
      if (!(impactModal instanceof HTMLElement)) return;
      impactReturnFocus = document.activeElement;
      impactModal.classList.add('open');
      impactModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('simple-impact-modal-open');
      if (impactClose instanceof HTMLButtonElement) impactClose.focus();
    };
    impactOpen?.addEventListener('click', openImpactProof);
    impactClose?.addEventListener('click', closeImpactProof);
    impactModal?.addEventListener('click', (event) => {
      if (event.target === impactModal) closeImpactProof();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && impactModal?.classList.contains('open')) closeImpactProof();
    });

    const copyCoinButton = main.querySelector('[data-copy-tree-coin]');
    const copyCoinStatus = main.querySelector('.simple-copy-status');
    copyCoinButton?.addEventListener('click', async () => {
      const label = copyCoinButton.querySelector('b');
      try {
        await navigator.clipboard.writeText(TREE_COIN_TYPE);
        if (label) label.textContent = 'Copied';
        if (copyCoinStatus) copyCoinStatus.textContent = 'Official TREE coin type copied.';
      } catch {
        if (label) label.textContent = 'Copy unavailable';
        if (copyCoinStatus) copyCoinStatus.textContent = 'Copy was unavailable. The complete coin type is shown in the Command Center.';
      }
      window.setTimeout(() => {
        if (label) label.textContent = 'Copy';
        if (copyCoinStatus) copyCoinStatus.textContent = '';
      }, 2400);
    });
  }

  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = `
      <div class="simple-footer-inner">
        <div><strong>THICKQUIDITY · TREE</strong><p>Utility, NFTree access, rewards, games, liquidity, and verified data on Sui.</p></div>
        <p class="simple-risk">Digital assets, smart contracts, and liquidity positions involve risk. Verify the official TREE coin type before signing any transaction. Nothing on this site is financial advice.</p>
      </div>
    `;
  }
}

async function loadDashboard() {
  try {
    const cached = readHomeMarketCache();
    let payload = await requestDashboard();
    if (!HOME_MARKET_FIELDS.every((field) => validMarketValue(payload?.live?.data?.[field]))) {
      try { payload = await requestDashboard(true); } catch { /* retain the first response and verified cache */ }
    }
    const market = resolveHomeMarket(payload, cached);
    try {
      market.liquidity = await requestVerifiedLiquidity();
    } catch (liquidityError) {
      market.liquidity = validMarketValue(cached?.liquidity) ? Number(cached.liquidity) : null;
      console.error('Verified TREE homepage liquidity unavailable:', liquidityError);
    }
    writeHomeMarketCache(market);
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
  try {
    buildHeader();
    buildHomepage();
    loadDashboard();
    window.TREE_COIN_TYPE = TREE_COIN_TYPE;
  } finally {
    // The source document still contains the legacy fallback markup. Keep it
    // from painting, then reveal only after the current homepage is assembled.
    document.documentElement.classList.remove('home-pending');
  }
}

initializeSimpleHome();
