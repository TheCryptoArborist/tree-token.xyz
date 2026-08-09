from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing expected text for {label}')
    return text.replace(old, new, 1)


def remove_once(text: str, old: str, label: str) -> str:
    return replace_once(text, old, '', label)

# Keep the exposure refresh responsible only for liquid + LP ranking.
runner_path = Path('netlify/lib/tree-exposure-scan-runner.ts')
runner = runner_path.read_text(encoding='utf-8')
runner = remove_once(runner, "import { scanTreeTradingActivity } from './tree-trading-activity-provider.ts';\n", 'activity provider import')
runner = remove_once(runner, "import { scanTreeBurnContributions } from './tree-burn-badge-provider.ts';\n", 'burn provider import')
for name in ['DIAMOND_HANDS_BADGE', 'PAPER_HANDS_BADGE', 'ACCUMULATOR_BADGE', 'BURNED_BADGE', 'formatTreeRaw']:
    runner = runner.replace(f'  {name},\n', '')
runner = runner.replace("  tradingActivityScan?: typeof scanTreeTradingActivity;\n", '')
runner = runner.replace("  burnScan?: typeof scanTreeBurnContributions;\n", '')
runner = runner.replace("  const tradingActivityScan = dependencies.tradingActivityScan ?? scanTreeTradingActivity;\n", '')
runner = runner.replace("  const burnScan = dependencies.burnScan ?? scanTreeBurnContributions;\n", '')
runner, count = re.subn(
    r"\n    const rankedWallets = aggregate\.entries\.map\(\(entry\) => entry\.wallet\);[\s\S]*?\n\n    await emit\('suins'",
    "\n\n    await emit('suins'",
    runner,
    count=1,
)
if count != 1:
    raise SystemExit('Could not remove badge scans from the exposure runner.')
runner = runner.replace('resolveSuins(badgeEntries.map((entry) => entry.wallet))', 'resolveSuins(aggregate.entries.map((entry) => entry.wallet))')
runner = runner.replace('Object.fromEntries(badgeEntries.map((entry) => [entry.wallet, null]))', 'Object.fromEntries(aggregate.entries.map((entry) => [entry.wallet, null]))')
runner = runner.replace('requestedCount: badgeEntries.length', 'requestedCount: aggregate.entries.length')
runner = runner.replace('const entries = badgeEntries.map((entry) => ({', 'const entries = aggregate.entries.map((entry) => ({')
runner, count = re.subn(
    r"\n      activity: \{[\s\S]*?\n      burns: \{[\s\S]*?\n      \},\n      suins: \{",
    "\n      suins: {",
    runner,
    count=1,
)
if count != 1:
    raise SystemExit('Could not remove activity/burn source summaries from exposure snapshot.')
runner = runner.replace('warnings: [...aggregate.warnings, ...badgeWarnings, ...suinsWarnings],', 'warnings: [...aggregate.warnings, ...suinsWarnings],')
for line in [
    "          diamondHands: entries.filter((entry) => entry.badges.includes(DIAMOND_HANDS_BADGE)).length,\n",
    "          paperHands: entries.filter((entry) => entry.badges.includes(PAPER_HANDS_BADGE)).length,\n",
    "          accumulator: entries.filter((entry) => entry.badges.includes(ACCUMULATOR_BADGE)).length,\n",
    "          burned: entries.filter((entry) => entry.badges.includes(BURNED_BADGE)).length,\n",
]:
    runner = runner.replace(line, '')
if 'badgeEntries' in runner or 'tradingActivityScan' in runner or 'burnScan' in runner:
    raise SystemExit('Exposure runner still contains badge-scanner references.')
runner_path.write_text(runner, encoding='utf-8')

# Fix imports for shared six-decimal formatting.
for path_string in ['netlify/lib/tree-activity-index.ts', 'netlify/lib/tree-burn-index.ts']:
    path = Path(path_string)
    text = path.read_text(encoding='utf-8')
    text = text.replace(',\n  formatTreeRaw,\n} from \'./tree-badge-types.ts\';', "\n} from './tree-badge-types.ts';\nimport { formatTreeRaw } from './tree-exposure-types.ts';")
    text = text.replace("import { BURNED_BADGE_THRESHOLD_RAW, formatTreeRaw } from './tree-badge-types.ts';", "import { BURNED_BADGE_THRESHOLD_RAW } from './tree-badge-types.ts';\nimport { formatTreeRaw } from './tree-exposure-types.ts';")
    path.write_text(text, encoding='utf-8')

# Remove an unsupported extra option passed to the activity refresher.
worker_path = Path('netlify/lib/tree-badge-background-worker.ts')
worker = worker_path.read_text(encoding='utf-8')
worker = worker.replace("      sleepImpl,\n      onPoolComplete:", "      onPoolComplete:")
worker = worker.replace("    } as never);", "    });", 1)
worker_path.write_text(worker, encoding='utf-8')

# Merge only a complete badge snapshot that matches the exact exposure snapshot.
app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const leaderboardUrl = isDeployPreview ? '/api/tree-exposure' : '/api/tree-leaderboard';\n",
    "const leaderboardUrl = isDeployPreview ? '/api/tree-exposure' : '/api/tree-leaderboard';\nconst badgeUrl = isDeployPreview ? '/api/tree-badges' : null;\n",
    'badge API constant',
)
merge_helpers = r'''
function mergeBehaviorBadgeSnapshot(exposurePayload, badgePayload) {
  if (!exposurePayload || !badgePayload
    || !['ok', 'stale'].includes(exposurePayload.status)
    || !['ok', 'stale'].includes(badgePayload.status)
    || badgePayload.provider !== 'tree-badge-snapshot'
    || badgePayload.exposureSnapshotGeneratedAt !== exposurePayload.snapshotGeneratedAt
    || !Array.isArray(exposurePayload.entries)
    || !Array.isArray(badgePayload.entries)
    || badgePayload.entries.length !== 50) return { payload: exposurePayload, merged: false };

  const byWallet = new Map(badgePayload.entries.map((entry) => [String(entry.wallet).toLowerCase(), entry]));
  const entries = exposurePayload.entries.map((entry) => {
    const behavior = byWallet.get(String(entry.wallet).toLowerCase());
    if (!behavior || behavior.rank !== entry.rank) return entry;
    return {
      ...entry,
      badges: [...new Set([...(Array.isArray(entry.badges) ? entry.badges : []), ...(Array.isArray(behavior.badges) ? behavior.badges : [])])],
      activity30d: behavior.activity30d,
      burn: behavior.burn,
    };
  });
  if (entries.some((entry, index) => !byWallet.has(String(entry.wallet).toLowerCase()) || byWallet.get(String(entry.wallet).toLowerCase())?.rank !== index + 1)) {
    return { payload: exposurePayload, merged: false };
  }
  return {
    merged: true,
    payload: {
      ...exposurePayload,
      entries,
      behaviorBadgeSnapshot: {
        status: badgePayload.status,
        snapshotGeneratedAt: badgePayload.snapshotGeneratedAt,
        summary: badgePayload.summary,
        source: badgePayload.source,
      },
      warnings: [
        ...(Array.isArray(exposurePayload.warnings) ? exposurePayload.warnings : []),
        ...(Array.isArray(badgePayload.warnings) ? badgePayload.warnings : []),
      ],
    },
  };
}

'''
app = replace_once(app, 'async function loadLeaderboard() {', merge_helpers + 'async function loadLeaderboard() {', 'badge merge helper')
old_loader = r'''async function loadLeaderboard() {
  try {
    const response = await fetch(leaderboardUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
    const payload = await response.json();
    if (isDeployPreview && String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')) {
      payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), 'Deploy Preview: ranks combine liquid TREE with current verified principal in SuiDex V2, SuiDex V3, and Turbos positions.'];
    }
    renderLeaderboard(payload);
  } catch (error) {
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [], displayedCount: 0, excludedCount: 0, holderCount: null });
    console.error(error);
  }
}'''
new_loader = r'''async function loadLeaderboard() {
  try {
    const [leaderboardResponse, badgeResponse] = await Promise.all([
      fetch(leaderboardUrl, { headers: { Accept: 'application/json' } }),
      badgeUrl ? fetch(badgeUrl, { headers: { Accept: 'application/json' } }).catch(() => null) : Promise.resolve(null),
    ]);
    if (!leaderboardResponse.ok) throw new Error(`Leaderboard returned ${leaderboardResponse.status}`);
    let payload = await leaderboardResponse.json();
    let badgePayload = null;
    if (badgeResponse?.ok) badgePayload = await badgeResponse.json();
    const merged = mergeBehaviorBadgeSnapshot(payload, badgePayload);
    payload = merged.payload;
    if (isDeployPreview && String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')) {
      payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []),
        'Deploy Preview: ranks combine liquid TREE with current verified principal in SuiDex V2, SuiDex V3, and Turbos positions.',
        ...(merged.merged ? ['All four behavioral badges are from a complete snapshot aligned to this exposure ranking.'] : ['Behavioral badges are still building or do not yet match this exposure snapshot.']),
      ];
    }
    renderLeaderboard(payload);
  } catch (error) {
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [], displayedCount: 0, excludedCount: 0, holderCount: null });
    console.error(error);
  }
}'''
app = replace_once(app, old_loader, new_loader, 'leaderboard loader')
app = replace_once(
    app,
    'export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSupplyPercentFromRaw, formatTreePrice, normalizeLeaderboardEntry, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };',
    'export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSupplyPercentFromRaw, formatTreePrice, mergeBehaviorBadgeSnapshot, normalizeLeaderboardEntry, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };',
    'app exports',
)
app_path.write_text(app, encoding='utf-8')

# Document the new isolated badge controls.
env_path = Path('.env.example')
env = env_path.read_text(encoding='utf-8')
if 'TREE_BADGE_AUTO_BOOTSTRAP' not in env:
    env += """

# Separate behavioral badge index. Badge history never blocks exposure ranking.
TREE_BADGE_AUTO_BOOTSTRAP=false
TREE_BADGE_PREVIEW_BRANCH=feature/leaderboard-badges-v1
TREE_BADGE_REFRESH_SECRET=
TREE_BADGE_PRODUCTION_ENABLED=false
TREE_BADGE_STALE_AFTER_MS=21600000
"""
env_path.write_text(env, encoding='utf-8')
