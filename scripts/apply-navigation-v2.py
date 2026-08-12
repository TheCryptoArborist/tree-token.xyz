from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing expected source for {label}')
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one replacement for {label}; found {count}')
    return updated


# Homepage: load the new organization layer after the legacy inline stylesheet and script.
home_path = Path('index.html')
home = home_path.read_text(encoding='utf-8')
home = replace_once(
    home,
    '\n</style>\n</head>',
    '\n</style>\n<link rel="stylesheet" href="styles/home-v2.css">\n</head>',
    'homepage stylesheet link',
)
home = replace_once(
    home,
    '\n</script>\n</body>\n</html>',
    '\n</script>\n<script type="module" src="scripts/home-v2.js"></script>\n</body>\n</html>',
    'homepage organization script',
)
home_path.write_text(home, encoding='utf-8')

# Command Center: replace the top navigation with action-first buttons.
dapp_path = Path('dapp/index.html')
dapp = dapp_path.read_text(encoding='utf-8')
new_nav = '''<nav class="app-nav" aria-label="Command Center navigation">
      <a href="#swap"><span aria-hidden="true">↕</span><b>Swap</b></a>
      <a href="#limit"><span aria-hidden="true">⌁</span><b>Limit</b></a>
      <a href="#earn"><span aria-hidden="true">✦</span><b>Earn</b></a>
      <a href="#v3"><span aria-hidden="true">◫</span><b>V3</b></a>
      <a href="#stats"><span aria-hidden="true">▥</span><b>Stats</b></a>
      <a href="#removed"><span aria-hidden="true">🔥</span><b>Burn</b></a>
      <a href="#canopy-draw"><span aria-hidden="true">🎟</span><b>Raffle</b></a>
      <a href="#leaderboard"><span aria-hidden="true">♛</span><b>Board</b></a>
      <a href="#profile-studio"><span aria-hidden="true">◎</span><b>Studio</b></a>
      <a href="#documents"><span aria-hidden="true">▤</span><b>Docs</b></a>
    </nav>'''
dapp = replace_regex(
    dapp,
    r'<nav class="app-nav" aria-label="Command Center navigation">[\s\S]*?</nav>',
    new_nav,
    'Command Center action navigation',
)

old_banner = '''<section class="command-banner" id="overview" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">TREE ecosystem utilities on Sui</p>
        <h1 id="page-title">TREE Command Center</h1>
        <p>Live market data, verified Liquid TREE plus LP exposure rankings, creator tools, and clear routes into the NFTree ecosystem.</p>
      </div>
      <div class="command-banner-actions">
        <a class="button gold" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree</a>
      </div>
    </section>'''
new_banner = '''<section class="command-banner" id="overview" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">TREE ecosystem utilities on Sui</p>
        <h1 id="page-title">TREE Command Center</h1>
        <p>One organized app for trading routes, liquidity access, live stats, supply tracking, the Canopy Board, creator tools, and official documents.</p>
      </div>
      <div class="command-banner-actions"><a class="button gold" href="https://nftree.net/mint" target="_blank" rel="noopener noreferrer">Mint NFTree</a><a class="button secondary" href="/">Project Home</a></div>
    </section>

    <section class="command-launcher" aria-labelledby="command-launcher-title">
      <div class="launcher-heading"><div><p class="eyebrow">Choose an action</p><h2 id="command-launcher-title">What do you want to do?</h2></div><p>Every major TREE destination in one consistent menu.</p></div>
      <div class="command-action-grid">
        <a href="#swap"><span>↕</span><strong>Swap</strong><small>Buy TREE</small><em>Live</em></a>
        <a href="#limit"><span>⌁</span><strong>Limit</strong><small>Planned orders</small><em class="planned">Planned</em></a>
        <a href="#earn"><span>✦</span><strong>Earn</strong><small>V2 farms</small><em>Live</em></a>
        <a href="#v3"><span>◫</span><strong>V3</strong><small>Concentrated LP</small><em>Live</em></a>
        <a href="#stats"><span>▥</span><strong>Stats</strong><small>Market data</small><em>Live</em></a>
        <a href="#removed"><span>🔥</span><strong>Burn</strong><small>Supply removal</small><em>Tracked</em></a>
        <a href="#canopy-draw"><span>🎟</span><strong>Raffle</strong><small>Canopy Draw</small><em class="planned">Development</em></a>
        <a href="#leaderboard"><span>♛</span><strong>Board</strong><small>Top 50</small><em>Live</em></a>
        <a href="#profile-studio"><span>◎</span><strong>Studio</strong><small>Profile maker</small><em>Live</em></a>
        <a href="#documents"><span>▤</span><strong>Docs</strong><small>Verify TREE</small><em>Official</em></a>
      </div>
    </section>'''
dapp = replace_once(dapp, old_banner, new_banner, 'Command Center banner and launcher')

# Insert Limit, Earn, and V3 sections between Swap and Stats.
stats_marker = '<section class="section" id="stats" aria-labelledby="stats-title">'
pre_stats = '''<section class="section utility-route-section" id="limit" aria-labelledby="limit-title">
      <div class="section-heading"><div><p class="eyebrow">Planned integration</p><h2 id="limit-title">TREE Limit Orders</h2><p>A dedicated home for target-price orders without presenting an unfinished transaction flow as live.</p></div><span class="data-state stale">Planned</span></div>
      <div class="route-card-grid">
        <article class="card route-card"><span class="card-icon">⌁</span><h3>Set a target instead of watching the chart</h3><p>The proposed flow will escrow the selected asset on Sui and fill only when the target price is reached. Contract, quote, fee, expiry, cancellation, and simulation requirements must be completed before launch.</p><strong>No TREE limit orders are accepted on this page today.</strong></article>
        <article class="card route-card"><span class="card-icon">↕</span><h3>Use the live swap route now</h3><p>Until a verified TREE limit-order contract is integrated, use SuiDex for current market execution and review every wallet transaction before signing.</p><a class="button secondary" href="https://dex.suidex.org/swap" target="_blank" rel="noopener noreferrer">Open SuiDex Swap</a></article>
      </div>
    </section>

    <section class="section utility-route-section" id="earn" aria-labelledby="earn-title">
      <div class="section-heading"><div><p class="eyebrow">Liquidity rewards</p><h2 id="earn-title">Earn with TREE Liquidity</h2><p>Choose between classic V2 liquidity and current SuiDex farm or incentive routes.</p></div><span class="data-state ok">Live routes</span></div>
      <div class="route-card-grid three">
        <article class="card route-card"><span class="card-icon">💧</span><h3>V2 Classic LP</h3><p>Provide equal-value TREE and SUI liquidity through the recognized SuiDex V2 pool. Classic LP positions use full-range liquidity.</p><a class="button secondary" href="https://dex.suidex.org/pools/0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc/add" target="_blank" rel="noopener noreferrer">Add V2 Liquidity</a></article>
        <article class="card route-card"><span class="card-icon">✦</span><h3>Farm Rewards</h3><p>Review current TREE/SUI reward programs and APR directly on SuiDex. Rates and eligibility can change, so the official farm interface is the source of truth.</p><a class="button secondary" href="https://dex.suidex.org/farms" target="_blank" rel="noopener noreferrer">Open SuiDex Farms</a></article>
        <article class="card route-card"><span class="card-icon">◉</span><h3>Your Portfolio</h3><p>Connect the same wallet on SuiDex to review positions, earned fees, and claimable rewards.</p><a class="button secondary" href="https://dex.suidex.org/portfolio" target="_blank" rel="noopener noreferrer">View Portfolio</a></article>
      </div>
    </section>

    <section class="section utility-route-section" id="v3" aria-labelledby="v3-title">
      <div class="section-heading"><div><p class="eyebrow">Concentrated liquidity</p><h2 id="v3-title">TREE V3 Liquidity</h2><p>Concentrate liquidity inside a chosen price range to pursue greater fee efficiency, with active range-management risk.</p></div><span class="data-state ok">SuiDex V3</span></div>
      <div class="route-card-grid three">
        <article class="card route-card"><span class="card-icon">◫</span><h3>Browse Pools</h3><p>Find the current SUI/TREE V3 pool, fee tier, TVL, volume, and incentives through the official SuiDex pool interface.</p><a class="button secondary" href="https://dex.suidex.org/pools" target="_blank" rel="noopener noreferrer">Open V3 Pools</a></article>
        <article class="card route-card"><span class="card-icon">◎</span><h3>Manage Positions</h3><p>V3 positions are NFTs that track range, principal, fees, and incentives. Earnings stop when a position moves out of range.</p><a class="button secondary" href="https://dex.suidex.org/portfolio" target="_blank" rel="noopener noreferrer">View Positions</a></article>
        <article class="card route-card"><span class="card-icon">▥</span><h3>V3 Analytics</h3><p>Review current pool activity, fee production, swaps, and period comparisons before selecting a liquidity range.</p><a class="button secondary" href="https://dex.suidex.org/pools/v3/analytics" target="_blank" rel="noopener noreferrer">Open V3 Analytics</a></article>
      </div>
      <p class="compliance">V3 liquidity can be more capital efficient than full-range liquidity, but it requires price-range decisions and can become inactive when the market moves outside the selected range.</p>
    </section>

    '''
dapp = replace_once(dapp, stats_marker, pre_stats + stats_marker, 'Limit, Earn, and V3 sections')

# Insert a precise supply-removal screen after Stats and before Canopy Draw.
draw_marker = '<section class="section" id="canopy-draw" aria-labelledby="canopy-title">'
removed_section = '''<section class="section removed-section" id="removed" aria-labelledby="removed-title">
      <div class="section-heading"><div><p class="eyebrow">Supply transparency</p><h2 id="removed-title">TREE Burn &amp; Supply Removal Tracker</h2><p>Track zero-address holdings without implying the TREE contract's reported total supply was reduced.</p></div><span class="data-state snapshot">Project snapshot</span></div>
      <div class="removed-hero-grid">
        <article class="removed-primary"><span>Effectively removed from circulation</span><strong data-snapshot="tree.zeroAddressBalance">—</strong><small>TREE held by the Sui zero address</small></article>
        <div class="removed-metrics"><article><span>Removal percentage</span><strong data-derived="removalPercent">—</strong></article><article><span>Effective supply</span><strong data-snapshot="tree.effectiveSupply">—</strong></article><article><span>Reported total supply</span><strong data-snapshot="tree.totalSupply">—</strong></article></div>
      </div>
      <div class="removed-explainer"><h3>Why the wording matters</h3><p>Tokens held at <code>0x000…000</code> are inaccessible and treated by the project as effectively removed from circulation. They are not described as an on-chain supply burn unless the TREE contract itself reports a reduced total supply.</p><a class="button secondary" href="#documents">Review Official Coin Information</a></div>
    </section>

    '''
dapp = replace_once(dapp, draw_marker, removed_section + draw_marker, 'supply removal section')

# Insert official documents before the final NFTree CTA.
nftree_marker = '<section class="section" id="nftree-next" aria-labelledby="nftree-title">'
documents_section = f'''<section class="section documents-section" id="documents" aria-labelledby="documents-title">
      <div class="section-heading"><div><p class="eyebrow">Official resources</p><h2 id="documents-title">TREE Documents &amp; Verification</h2><p>Project information, investor-facing explanations, and the complete official coin type in one place.</p></div><span class="data-state ok">Official</span></div>
      <div class="document-grid">
        <article class="card document-tile"><span class="card-icon">▤</span><h3>Litepaper</h3><p>Review the ecosystem vision, tokenomics, utilities, and project direction.</p><a class="button secondary" href="../Litepaper.pdf" target="_blank" rel="noopener noreferrer">Open Litepaper</a></article>
        <article class="card document-tile"><span class="card-icon">◎</span><h3>About TREE</h3><p>Start with a concise explanation of TREE, NFTree, live utilities, and real-world impact.</p><a class="button secondary" href="/#about">Read About TREE</a></article>
        <article class="card document-tile"><span class="card-icon">▥</span><h3>Tokenomics</h3><p>See fixed supply, effective supply, zero-address holdings, locks, and terminology.</p><a class="button secondary" href="/#tokenomics">View Tokenomics</a></article>
        <article class="card document-tile"><span class="card-icon">→</span><h3>Roadmap &amp; FAQ</h3><p>Separate completed work, active development, future plans, and common questions.</p><div class="actions"><a class="button secondary" href="/#roadmap">Roadmap</a><a class="button secondary" href="/#faq">FAQ</a></div></article>
      </div>
      <div class="coin-document"><span>Official TREE coin type · Sui Mainnet</span><code id="dappCoinType">0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE</code><div class="actions"><button class="button secondary" id="copyDappCoin" type="button">Copy Coin Type</button><a class="button secondary" href="https://noodles.fi/coins/0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE?trade=market" target="_blank" rel="noopener noreferrer">Open Noodles Market Page</a></div></div>
    </section>

    '''
dapp = replace_once(dapp, nftree_marker, documents_section + nftree_marker, 'Documents section')

# Add a bottom data ribbon inspired by the reference site's at-a-glance metrics.
main_close = '  </main>\n  <footer>'
bottom_metrics = '''    <section class="command-bottom-metrics" aria-label="TREE data points">
      <article><span>Price</span><strong data-market="price">—</strong></article>
      <article><span>24h Change</span><strong data-market="priceChange24h">—</strong></article>
      <article><span>Market Cap</span><strong data-market="marketCap">—</strong></article>
      <article><span>Liquidity</span><strong data-market="liquidity">—</strong></article>
      <article><span>Total Supply</span><strong data-snapshot="tree.totalSupply">—</strong></article>
      <article><span>Effectively Removed</span><strong data-snapshot="tree.zeroAddressBalance">—</strong></article>
    </section>
  </main>
  <footer>'''
dapp = replace_once(dapp, main_close, bottom_metrics, 'bottom data metrics')
dapp_path.write_text(dapp, encoding='utf-8')

# Add the navigation and new utility-screen styling.
styles_path = Path('dapp/styles.css')
styles = styles_path.read_text(encoding='utf-8')
styles += r'''

/* Action-first Command Center navigation v2 */
.app-nav{grid-template-columns:repeat(10,minmax(68px,1fr))}
.command-launcher{scroll-margin-top:150px;margin-top:18px;padding:20px;border:1px solid rgba(53,200,255,.16);border-radius:20px;background:linear-gradient(145deg,rgba(8,17,27,.96),rgba(4,10,15,.96));box-shadow:0 18px 58px rgba(0,0,0,.2)}
.launcher-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}.launcher-heading h2{margin:4px 0 0;font:800 clamp(1.35rem,3vw,2rem)/1.1 var(--mono)}.launcher-heading>p{max-width:520px;margin:0;color:var(--muted)}
.command-action-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.command-action-grid a{position:relative;display:grid;gap:5px;min-height:122px;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:linear-gradient(145deg,rgba(9,20,29,.92),rgba(4,10,15,.98));color:var(--text);text-decoration:none;transition:.18s ease}.command-action-grid a:hover{transform:translateY(-3px);border-color:rgba(53,200,255,.45);box-shadow:0 14px 34px rgba(0,0,0,.28)}.command-action-grid a>span{font-size:1.45rem}.command-action-grid a strong{color:var(--gold);font-family:var(--mono)}.command-action-grid a small{color:var(--muted)}.command-action-grid a em{position:absolute;top:9px;right:9px;padding:3px 5px;border-radius:999px;background:rgba(53,242,140,.09);border:1px solid rgba(53,242,140,.2);color:var(--green);font:850 .5rem var(--mono);letter-spacing:.08em;text-transform:uppercase;font-style:normal}.command-action-grid a em.planned{color:var(--amber);background:rgba(255,179,38,.08);border-color:rgba(255,179,38,.22)}
.utility-route-section{background:radial-gradient(circle at 92% 7%,rgba(53,200,255,.08),transparent 27%),linear-gradient(145deg,rgba(7,20,25,.94),rgba(4,10,16,.96))}.route-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.route-card-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.route-card{display:flex;flex-direction:column;gap:8px}.route-card h3,.document-tile h3{margin:0;color:var(--gold)}.route-card p,.document-tile p{margin:0;color:var(--muted);line-height:1.58}.route-card strong{color:var(--amber)}.route-card .button,.document-tile>.button{margin-top:auto}
.removed-section{background:radial-gradient(circle at 85% 12%,rgba(255,123,130,.09),transparent 30%),linear-gradient(145deg,rgba(12,16,23,.97),rgba(5,10,15,.98))}.removed-hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:13px}.removed-primary{display:grid;align-content:center;min-height:220px;padding:22px;border:1px solid rgba(255,123,130,.22);border-radius:17px;background:radial-gradient(circle at 80% 10%,rgba(255,123,130,.12),transparent 34%),rgba(5,10,15,.78)}.removed-primary span{color:var(--muted);font:800 .7rem var(--mono);letter-spacing:.09em;text-transform:uppercase}.removed-primary strong{margin:9px 0;color:var(--gold);font:900 clamp(2rem,5vw,4rem)/1 var(--mono);overflow-wrap:anywhere}.removed-primary small{color:var(--muted)}.removed-metrics{display:grid;gap:9px}.removed-metrics article{display:grid;align-content:center;padding:15px;border:1px solid rgba(255,255,255,.065);border-radius:14px;background:rgba(255,255,255,.027)}.removed-metrics span{color:var(--muted);font-size:.73rem}.removed-metrics strong{margin-top:4px;color:var(--green);font-size:1.1rem;overflow-wrap:anywhere}.removed-explainer{margin-top:12px;padding:15px;border-left:3px solid var(--purple);border-radius:10px;background:rgba(154,98,242,.06)}.removed-explainer h3{margin:0;color:var(--gold)}.removed-explainer p{color:var(--muted)}.removed-explainer code{color:var(--cyan)}
.document-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.document-tile{display:flex;flex-direction:column;gap:8px}.coin-document{margin-top:12px;padding:15px;border:1px solid rgba(53,200,255,.17);border-radius:14px;background:#02070b}.coin-document>span{display:block;color:var(--cyan);font:800 .68rem var(--mono);letter-spacing:.09em;text-transform:uppercase}.coin-document code{display:block;margin:9px 0 11px;color:#e1fbff;font:700 .78rem/1.55 var(--mono);overflow-wrap:anywhere}
.command-bottom-metrics{margin-top:24px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:15px;border:1px solid rgba(255,225,79,.18);border-radius:18px;background:linear-gradient(135deg,rgba(255,225,79,.07),rgba(53,200,255,.055),rgba(154,98,242,.06))}.command-bottom-metrics article{padding:12px;border-radius:12px;background:rgba(2,7,11,.68);border:1px solid rgba(255,255,255,.055)}.command-bottom-metrics span{display:block;color:var(--muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em}.command-bottom-metrics strong{display:block;margin-top:5px;color:var(--green);font:850 .88rem var(--mono);overflow-wrap:anywhere}
.anchor-alias{scroll-margin-top:150px}
@media(max-width:980px){.command-action-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.route-card-grid.three,.document-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.command-bottom-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:680px){.app-nav{grid-template-columns:repeat(10,minmax(66px,1fr));justify-content:start}.command-launcher{padding:15px}.launcher-heading{align-items:flex-start;flex-direction:column}.command-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.command-action-grid a{min-height:112px}.route-card-grid,.route-card-grid.three,.removed-hero-grid,.document-grid{grid-template-columns:1fr}.command-bottom-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
styles_path.write_text(styles, encoding='utf-8')

# Add active-navigation behavior and coin-type copy action.
app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')
insert_before = '\nexport { DAPP_SWAP_EXECUTION_ENABLED'
extra_js = r'''

function initCommandNavigation() {
  const links = [...document.querySelectorAll('.app-nav a[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const activate = (id) => links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
  links.forEach((link) => link.addEventListener('click', () => activate(link.getAttribute('href').slice(1))));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) activate(visible.target.id);
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0.05, 0.2, 0.45] });
    sections.forEach((section) => observer.observe(section));
  }
  const requested = location.hash.slice(1);
  activate(sections.some((section) => section.id === requested) ? requested : 'swap');
}

function initDocumentActions() {
  document.getElementById('copyDappCoin')?.addEventListener('click', async () => {
    const status = document.getElementById('swapStatus');
    try {
      await navigator.clipboard.writeText(TREE_COIN_TYPE);
      if (status) { status.textContent = 'Official TREE coin type copied.'; status.className = 'status success'; }
    } catch {
      if (status) { status.textContent = 'Coin type copy was unavailable.'; status.className = 'status error'; }
    }
  });
}

if (typeof document !== 'undefined') {
  initCommandNavigation();
  initDocumentActions();
}
'''
if insert_before not in app:
    raise SystemExit('Could not find dapp export anchor.')
app = app.replace(insert_before, extra_js + insert_before, 1)
app_path.write_text(app, encoding='utf-8')
