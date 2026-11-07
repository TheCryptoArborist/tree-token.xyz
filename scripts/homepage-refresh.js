// Presentation-only enhancement. Keep the existing video controls, market nodes,
// market requests, wallet integrations and contribution dialog intact.
(() => {
  function refreshHome() {
    const hero = document.querySelector('.simple-hero');
    const nav = document.getElementById('simple-site-nav');
    if (!hero || !nav || hero.dataset.refreshed) return false;
    hero.dataset.refreshed = 'true';
    document.documentElement.classList.add('home-refreshed');
    document.getElementById('simple-hero-title').textContent = 'Play. Collect. Grow.';
    hero.querySelector('.simple-tagline').innerHTML = '<strong>Welcome to the TREE ecosystem.</strong> Discover arcade adventures, NFTree holder rewards, and token tools on Sui.';
    hero.querySelector('.simple-lead').textContent = 'Your NFTree unlocks supported games and holder benefits. TREE powers supported in-game purchases, upgrades, and continues.';
    nav.innerHTML = `
      <a class="active" href="/" aria-current="page">Home</a>
      <a href="/dapp/">App</a><a href="/play/">Arcade</a>
      <a href="https://nftree.net/">NFTrees</a><a href="/rewards/">NFTree Rewards</a>
      <a href="/about/">About</a>
      <details class="home-resources"><summary>Resources</summary><div>
        <a href="/sui-guide/">Getting Started</a><a href="/tokenomics/">Tokenomics</a>
        <a href="/roadmap/">Roadmap</a><a href="/faq/">FAQ</a><a href="/documents/">Docs</a>
      </div></details>`;
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      const button = document.querySelector('.simple-menu-button');
      button?.setAttribute('aria-expanded', 'false');
      button?.setAttribute('aria-label', 'Open navigation');
      nav.querySelector('details').open = false;
    }));
    const resources = nav.querySelector('details');
    document.addEventListener('click', event => { if (!resources.contains(event.target)) resources.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && resources.open) { resources.open = false; resources.querySelector('summary').focus(); } });
    hero.querySelector('.simple-hero-actions').innerHTML = `
      <a class="simple-button primary simple-launch-app simple-destination-button" href="/dapp/">
        <span class="simple-destination-icon"><img src="/assets/tree-token-logo-official.webp" alt=""></span>
        <span class="simple-destination-copy"><strong>Open TREE App</strong><small>Swap · Liquidity · Victory</small></span><b aria-hidden="true">→</b></a>
      <a class="simple-button arcade-button simple-destination-button" href="/play/">
        <span class="simple-arcade-pixel" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="simple-destination-copy"><strong>Enter TREE Arcade</strong><small>Find your next adventure</small></span><b aria-hidden="true">→</b></a>
      <a class="simple-button secondary simple-destination-button" href="https://nftree.net/">
        <span class="simple-destination-icon"><img src="/assets/profile-nftree-art.jpg" alt=""></span>
        <span class="simple-destination-copy"><strong>Get an NFTree</strong><small>Access · Collect · Grow</small></span><b aria-hidden="true">↗</b></a>
      <a class="simple-button secondary simple-destination-button home-rewards-destination" href="/rewards/">
        <span class="simple-destination-icon home-reward-icon" aria-hidden="true">◆</span>
        <span class="simple-destination-copy"><strong>NFTree Rewards</strong><small>Connect · Check · Collect</small></span><b aria-hidden="true">→</b></a>`;
    const featured = document.createElement('section');
    featured.className = 'home-featured simple-utility';
    featured.setAttribute('aria-labelledby', 'home-featured-title');
    featured.innerHTML = `
      <div class="simple-utility-heading"><div><p class="simple-impact-kicker">YOUR NEXT ADVENTURE IS LIVE</p><h2 id="home-featured-title">Step into the TREE Arcade.</h2></div><a class="home-section-link" href="/play/">Explore all games <span aria-hidden="true">→</span></a></div>
      <div class="home-game-grid">
        <a class="home-game" href="/play/treeforce89/"><div class="home-game-art force"><img src="/assets/arcade/tree-force-89-poster.webp" alt="TREE Force ’89: Canopy Command" loading="lazy" width="512" height="512"><span class="home-game-status">LIVE</span></div><div class="home-game-copy"><small>ARCADE SHOOTER</small><h3>TREE Force ’89</h3><p>Pilot the Arborwing. Blast through enemy waves and defend the canopy.</p><strong>Play TREE Force ’89 <span aria-hidden="true">→</span></strong></div></a>
        <a class="home-game" href="/play/canopy-defense/"><div class="home-game-art defense"><img src="/play/canopy-defense/checkout-test/assets/brand/canopy-home-scene.webp" alt="Oak Guardian and Archer Watchtower defend the Tree of Life" loading="lazy" width="1254" height="1254"><span class="home-game-status">LIVE</span></div><div class="home-game-copy"><small>TOWER DEFENSE</small><h3>Canopy Defense</h3><p>Build your defenses, earn Sap, and protect the Tree of Life from invaders.</p><strong>Play Canopy Defense <span aria-hidden="true">→</span></strong></div></a>
        <a class="home-game" href="/play/canopy-breaker/"><div class="home-game-art breaker"><img src="/assets/arcade/canopy-breaker-game.webp" alt="Canopy Breaker inside the glowing TREE Arcade gateway" loading="lazy" width="800" height="900"><span class="home-game-status">LIVE</span></div><div class="home-game-copy"><small>BRICK BREAKER</small><h3>Canopy Breaker</h3><p>Break through 30 levels across five worlds. Catch power-ups and face the Hollow Harvester.</p><strong>Play Canopy Breaker <span aria-hidden="true">→</span></strong></div></a>
      </div><p class="home-game-note">NFTree access · Entry requirements and optional TREE purchases are shown in each game.</p>`;
    hero.after(featured);
    const utility = document.querySelector('.simple-utility:not(.home-featured)');
    utility.querySelector('h2').textContent = 'Find your place in the ecosystem.';
    utility.querySelector('.simple-impact-kicker').textContent = 'HOW TREE & NFTREE WORK TOGETHER';
    utility.querySelector('.simple-utility-heading > p').textContent = 'An NFTree for access and benefits. TREE for token tools and supported game purchases.';
    const cards = utility.querySelectorAll('.simple-utility-card');
    cards[0].querySelector('strong').textContent = 'Use TREE';
    cards[0].querySelector('small').textContent = 'Swap, provide V2/V3 liquidity, manage positions, and explore the Victory Center. Token tools have their own requirements.';
    cards[1].href = 'https://nftree.net/';
    cards[1].querySelector('strong').textContent = 'Hold an NFTree';
    cards[1].querySelector('small').textContent = 'Your access pass to supported arcade games and NFTree holder benefits. Continues and optional purchases are separate.';
    cards[2].href = '/rewards/';
    cards[2].querySelector('strong').textContent = 'Collect available rewards';
    cards[2].querySelector('small').textContent = 'Connect the wallet holding your NFTrees. Eligible rewards are checked automatically, ready for you to collect.';
    utility.querySelector('.simple-live-now p').innerHTML = 'TREE App <i>·</i> TREE Arcade <i>·</i> NFTree Rewards <i>·</i> Victory Center';
    return true;
  }
  if (refreshHome()) return;
  const observer = new MutationObserver(() => { if (refreshHome()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
