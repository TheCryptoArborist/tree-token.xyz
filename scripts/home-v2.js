import treeHeroVideoUrl from '../assets/tree-hero-walking.mp4?url';
import treeHeroPosterUrl from '../assets/tree-hero-poster.webp?url';
import treeBrandLogoUrl from '../assets/tree-token-logo-official.webp?url';
import coinGeckoLogoUrl from '../assets/CG.png?url';

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
        <img src="${treeBrandLogoUrl}" alt="TREE emblem">
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
  document.querySelectorAll('.launch-popup,.fab-group,.swap-backdrop,.booklet-modal,.scroll-top,.toast,.parallax-layer').forEach((node) => node.remove());

  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="simple-hero" aria-labelledby="simple-hero-title">
        <div class="simple-hero-copy">
          <p class="simple-eyebrow">TREE ECOSYSTEM · BUILT ON SUI</p>
          <h1 id="simple-hero-title">Grow with the TREE ecosystem.</h1>
          <p class="simple-tagline"><strong>$TREE is the root token.</strong> Holding an NFTree is your access pass to every utility released across the TREE ecosystem.</p>
          <p class="simple-lead">Trade TREE, mint NFTrees, access holder rewards, play Garden Battles, and follow verified ecosystem data from one clear starting point.</p>
          <div class="simple-hero-actions">
            <a class="simple-button primary simple-launch-app" href="/dapp/">Launch App</a>
          </div>
        </div>
        <div class="simple-hero-visual" aria-label="TREE hero video">
          <div class="simple-orbit orbit-one"></div>
          <div class="simple-orbit orbit-two"></div>
          <div class="simple-hero-media">
            <video class="simple-hero-video" autoplay muted loop playsinline preload="auto" poster="${treeHeroPosterUrl}" aria-label="TREE hero walking through the ecosystem">
              <source src="${treeHeroVideoUrl}" type="video/mp4">
            </video>
            <button class="simple-video-toggle" type="button" aria-label="Pause hero video">Pause</button>
            <span class="simple-live-badge">LIVE ON SUI</span>
          </div>
          <div class="simple-video-actions" aria-label="TREE hero actions">
            <a class="simple-button primary" href="/dapp/#swap">Buy TREE</a>
            <a class="simple-button secondary" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree</a>
          </div>
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

    const heroVideo = main.querySelector('.simple-hero-video');
    const videoToggle = main.querySelector('.simple-video-toggle');
    if (heroVideo instanceof HTMLVideoElement && videoToggle instanceof HTMLButtonElement) {
      heroVideo.muted = true;
      heroVideo.defaultMuted = true;
      const updateVideoToggle = () => {
        const paused = heroVideo.paused;
        videoToggle.textContent = paused ? 'Play' : 'Pause';
        videoToggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} hero video`);
      };
      videoToggle.addEventListener('click', () => {
        if (heroVideo.paused) heroVideo.play().catch(updateVideoToggle);
        else heroVideo.pause();
      });
      heroVideo.addEventListener('play', updateVideoToggle);
      heroVideo.addEventListener('pause', updateVideoToggle);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) heroVideo.pause();
      else heroVideo.play().catch(updateVideoToggle);
      updateVideoToggle();
    }
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
