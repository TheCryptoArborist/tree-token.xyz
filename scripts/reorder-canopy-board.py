from pathlib import Path
import re

html_path = Path('dapp/index.html')
html = html_path.read_text(encoding='utf-8')

replacements = [
    ('        <a class="button primary" href="#leaderboard">View Canopy Board</a>\n', ''),
    ('<h2 id="leaderboard-title">TREE Canopy Leaderboard</h2>', '<h2 id="leaderboard-title">Canopy Board</h2>'),
    ('<span class="rank-kicker">YOUR CANOPY RANK</span>', '<span class="rank-kicker">YOUR CANOPY POSITION</span>'),
    ('<strong class="rank-summary" id="yourRank">Connect a wallet to check.</strong>', '<strong class="rank-summary" id="yourRank">Connect a wallet to view your position.</strong>'),
    ('<h3>Verified TREE Exposure Leaders</h3>', '<h3>Top 50 Canopy Leaders</h3><p>Ranked by total verified TREE exposure, including liquid TREE and supported LP principal.</p>'),
    ('<div class="progress-track" aria-hidden="true"><span id="rankProgressBar"></span></div></div>', '<div class="progress-track" aria-hidden="true"><span id="rankProgressBar"></span></div><a class="tier-progress-link" href="#tier-guide">View all tiers</a></div>'),
]
for old, new in replacements:
    if old not in html:
        raise SystemExit(f'Missing expected Canopy Board markup: {old[:80]}')
    html = html.replace(old, new, 1)

pattern = re.compile(
    r'\s*<div class="rank-dashboard">\s*'
    r'(?P<rank><article class="rank-command-card">.*?</article>)\s*'
    r'(?P<snapshot><article class="snapshot-overview-card">.*?</article>)\s*'
    r'</div>\s*'
    r'(?P<tier><article class="tier-ladder-card">.*?</article>)\s*'
    r'(?P<top><div class="top-board-heading">.*?<div id="leaderboardWarnings" class="warnings" hidden></div>)\s*'
    r'(?P<coverage><details class="coverage-details">.*?</details>)',
    re.S,
)
match = pattern.search(html)
if not match:
    raise SystemExit('Could not locate the current Canopy Board content sequence.')

rank = match.group('rank').strip()
snapshot = match.group('snapshot').strip().replace('VERIFIED SNAPSHOT', 'BOARD SNAPSHOT', 1)
tier = match.group('tier').strip()
top = match.group('top').strip()
coverage = match.group('coverage').strip()

tier_inner = re.sub(r'^<article class="tier-ladder-card">', '', tier, count=1)
tier_inner = re.sub(r'</article>$', '', tier_inner, count=1).strip()
coverage_inner = re.sub(r'^<details class="coverage-details">', '', coverage, count=1)
coverage_inner = re.sub(r'</details>$', '', coverage_inner, count=1).strip()
coverage_inner = coverage_inner.replace('<summary>Verification details</summary>', '', 1).strip()

reordered = f'''

      <div class="board-personal-layout">
        {rank}
      </div>

      {top}

      <details class="tier-ladder-card tier-guide-details" id="tier-guide">
        <summary class="tier-guide-summary"><span><strong>How TREE Tiers Work</strong><small>View all 13 tiers and supply thresholds</small></span></summary>
        <div class="tier-guide-body">
          {tier_inner}
        </div>
      </details>

      <details class="coverage-details ranking-methodology">
        <summary>How Rankings Are Calculated</summary>
        {snapshot}
        {coverage_inner}
      </details>'''

html = html[:match.start()] + reordered + html[match.end():]
html_path.write_text(html, encoding='utf-8')

css_path = Path('dapp/styles.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Canopy Board information hierarchy */'
if marker not in css:
    css += r'''

/* Canopy Board information hierarchy */
.board-personal-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.board-personal-layout .rank-command-card{width:100%;display:grid;grid-template-columns:minmax(220px,.72fr) minmax(0,1.28fr);grid-template-areas:"top top" "summary summary" "identity balance" "progress progress" "actions status";column-gap:20px}
.board-personal-layout .rank-card-top{grid-area:top}.board-personal-layout .rank-summary{grid-area:summary}.board-personal-layout .rank-identity{grid-area:identity;align-self:center}.board-personal-layout .rank-balance{grid-area:balance}.board-personal-layout .rank-progress-panel{grid-area:progress}.board-personal-layout .rank-actions{grid-area:actions}.board-personal-layout .rank-share-status{grid-area:status;align-self:center;margin:12px 0 0}
.tier-progress-link{display:inline-flex;margin-top:10px;color:var(--cyan);font:800 .72rem var(--mono);text-decoration:none;text-transform:uppercase;letter-spacing:.06em}.tier-progress-link:hover{text-decoration:underline}
.top-board-heading p{margin:5px 0 0;color:var(--muted);font-size:.78rem}
.tier-guide-details{margin-top:18px;padding:0;overflow:hidden}
.tier-guide-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;cursor:pointer;list-style:none;color:var(--text)}.tier-guide-summary::-webkit-details-marker{display:none}.tier-guide-summary::after{content:"+";display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(53,200,255,.25);border-radius:8px;color:var(--cyan);font:900 1rem var(--mono)}.tier-guide-details[open] .tier-guide-summary::after{content:"−"}.tier-guide-summary span{display:grid}.tier-guide-summary strong{font:850 1rem var(--mono)}.tier-guide-summary small{margin-top:4px;color:var(--muted)}.tier-guide-details[open] .tier-guide-summary{border-bottom:1px solid rgba(255,255,255,.06)}.tier-guide-body{padding:0 18px 18px}.tier-guide-body>.card-title-row{margin-top:16px}
.ranking-methodology{margin-top:14px}.ranking-methodology>.snapshot-overview-card{margin:14px 0;box-shadow:none}.ranking-methodology>summary{font-size:.84rem}
@media(max-width:760px){.board-personal-layout .rank-command-card{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "summary" "identity" "balance" "progress" "actions" "status"}.board-personal-layout .rank-share-status{margin-top:4px}.top-board-heading p{max-width:31rem}.tier-guide-summary{padding:15px}.tier-guide-body{padding:0 14px 14px}}
'''
css_path.write_text(css, encoding='utf-8')

test_path = Path('tests/leaderboard-ui-state.test.mjs')
test = test_path.read_text(encoding='utf-8')
anchor = "assert.equal(dappMarkup.includes('Liquid TREE plus current principal TREE'), true);\n"
assertions = anchor + """assert.equal(dappMarkup.includes('View Canopy Board'), false);
assert.equal(dappMarkup.includes('YOUR CANOPY POSITION'), true);
assert.equal(dappMarkup.includes('Top 50 Canopy Leaders'), true);
assert.equal(dappMarkup.includes('How TREE Tiers Work'), true);
assert.equal(dappMarkup.includes('How Rankings Are Calculated'), true);
assert.ok(dappMarkup.indexOf('YOUR CANOPY POSITION') < dappMarkup.indexOf('Top 50 Canopy Leaders'));
assert.ok(dappMarkup.indexOf('Top 50 Canopy Leaders') < dappMarkup.indexOf('How TREE Tiers Work'));
assert.ok(dappMarkup.indexOf('How TREE Tiers Work') < dappMarkup.indexOf('How Rankings Are Calculated'));
"""
if anchor not in test:
    raise SystemExit('Could not locate the leaderboard markup assertions.')
test = test.replace(anchor, assertions, 1)
test_path.write_text(test, encoding='utf-8')
