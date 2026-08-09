from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing {label}')
    return text.replace(old, new, 1)

# Limit trade-history methodology to the three recognized primary TREE pools.
activity_path = Path('netlify/lib/tree-trading-activity-provider.ts')
activity = activity_path.read_text(encoding='utf-8')
activity = once(activity, "import { TURBOS_TREE_POOL_IDS } from './turbos-tree-lp-provider.ts';", "", 'unused Turbos pool import')
activity = once(activity, "  ...TURBOS_TREE_POOL_IDS,", "  '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',", 'primary Turbos pool')
activity_path.write_text(activity, encoding='utf-8')

# Make the lifetime burn scan explicitly opt-in outside fixtures.
burn_path = Path('netlify/lib/tree-burn-badge-provider.ts')
burn = burn_path.read_text(encoding='utf-8')
burn = once(burn, "  maxScanMs?: number;\n};", "  maxScanMs?: number;\n  getEnv?: (name: string) => string | undefined;\n};", 'burn getEnv option')
burn = once(burn, "  const fetchImpl = options.fetchImpl ?? fetch;", "  const getEnv = options.getEnv ?? ((name) => Netlify.env.get(name));\n  const enabled = Boolean(options.fetchImpl) || (getEnv('TREE_BURN_BADGES_ENABLED') || '').trim().toLowerCase() === 'true';\n  if (!enabled) {\n    return finish('verification-incomplete', generatedAt, targets, totals, coverage, [\n      'Lifetime TREE burn verification is disabled for this environment.',\n    ]);\n  }\n  const fetchImpl = options.fetchImpl ?? fetch;", 'burn enable gate')
burn_path.write_text(burn, encoding='utf-8')

# Add optional evidence fields and public constants.
types_path = Path('netlify/lib/tree-exposure-types.ts')
types = types_path.read_text(encoding='utf-8')
types = once(types, "export const LP_MAXI_BADGE = 'lp-maxi';", "export const LP_MAXI_BADGE = 'lp-maxi';\nexport const DIAMOND_HANDS_BADGE = 'diamond-hands';\nexport const PAPER_HANDS_BADGE = 'paper-hands';\nexport const ACCUMULATOR_BADGE = 'accumulator';\nexport const BURNED_BADGE = 'burned';", 'badge constants')
types = once(types, "  badges: string[];\n};", "  activity30d?: {\n    windowStart: string;\n    windowEnd: string;\n    buyCount: number;\n    sellCount: number;\n    buyTreeRaw: string;\n    buyTree: string;\n    sellTreeRaw: string;\n    sellTree: string;\n  } | null;\n  burnedTreeRaw?: string | null;\n  burnedTree?: string | null;\n  badges: string[];\n};", 'entry badge evidence')
types_path.write_text(types, encoding='utf-8')

# Enrich complete exposure snapshots without allowing badge-provider failure to erase ranks.
runner_path = Path('netlify/lib/tree-exposure-scan-runner.ts')
runner = runner_path.read_text(encoding='utf-8')
runner = once(runner, "import { scanTurbosTreeLp } from './turbos-tree-lp-provider.ts';", "import { scanTurbosTreeLp } from './turbos-tree-lp-provider.ts';\nimport { scanTreeTradingActivity } from './tree-trading-activity-provider.ts';\nimport { scanTreeBurnContributions } from './tree-burn-badge-provider.ts';", 'provider imports')
runner = once(runner, "  LP_PROVIDER_BADGE,\n  type ExposureVenue,", "  LP_PROVIDER_BADGE,\n  DIAMOND_HANDS_BADGE,\n  PAPER_HANDS_BADGE,\n  ACCUMULATOR_BADGE,\n  BURNED_BADGE,\n  formatTreeRaw,\n  type ExposureVenue,", 'badge imports')
runner = once(runner, "  resolveSuins?: typeof resolveDefaultSuinsNames;", "  resolveSuins?: typeof resolveDefaultSuinsNames;\n  tradingActivityScan?: typeof scanTreeTradingActivity;\n  burnScan?: typeof scanTreeBurnContributions;", 'runner dependencies')
runner = once(runner, "  const resolveSuins = dependencies.resolveSuins ?? resolveDefaultSuinsNames;", "  const resolveSuins = dependencies.resolveSuins ?? resolveDefaultSuinsNames;\n  const tradingActivityScan = dependencies.tradingActivityScan ?? scanTreeTradingActivity;\n  const burnScan = dependencies.burnScan ?? scanTreeBurnContributions;", 'runner provider setup')
anchor = """    await emit('suins', 'Resolving verified default SuiNS names for the final Top 50.');
    let suins: SuinsResolutionResult;"""
insert = """    const rankedWallets = aggregate.entries.map((entry) => entry.wallet);
    const [activity, burns] = await Promise.all([
      tradingActivityScan(rankedWallets, { getEnv, now }),
      burnScan(rankedWallets, { getEnv, now }),
    ]);
    const activityComplete = activity.outcome === 'complete';
    const burnsComplete = burns.outcome === 'complete';
    const badgeWarnings = [
      ...activity.warnings,
      ...burns.warnings,
    ];
    const badgeEntries = aggregate.entries.map((entry) => {
      const activityStats = activityComplete ? activity.wallets[entry.wallet] : null;
      const burnStats = burnsComplete ? burns.wallets[entry.wallet] : null;
      const badges = [...entry.badges];
      if (activityStats?.badges.includes(DIAMOND_HANDS_BADGE)) badges.push(DIAMOND_HANDS_BADGE);
      if (activityStats?.badges.includes(PAPER_HANDS_BADGE)) badges.push(PAPER_HANDS_BADGE);
      if (activityStats?.badges.includes(ACCUMULATOR_BADGE)) badges.push(ACCUMULATOR_BADGE);
      if (burnStats?.qualifies) badges.push(BURNED_BADGE);
      return {
        ...entry,
        activity30d: activityStats ? {
          windowStart: activity.windowStart,
          windowEnd: activity.windowEnd,
          buyCount: activityStats.buyCount,
          sellCount: activityStats.sellCount,
          buyTreeRaw: activityStats.buyTreeRaw,
          buyTree: formatTreeRaw(BigInt(activityStats.buyTreeRaw)),
          sellTreeRaw: activityStats.sellTreeRaw,
          sellTree: formatTreeRaw(BigInt(activityStats.sellTreeRaw)),
        } : null,
        burnedTreeRaw: burnStats ? burnStats.burnedTreeRaw : null,
        burnedTree: burnStats ? formatTreeRaw(BigInt(burnStats.burnedTreeRaw)) : null,
        badges,
      };
    });

    await emit('suins', 'Resolving verified default SuiNS names for the final Top 50.');
    let suins: SuinsResolutionResult;"""
runner = once(runner, anchor, insert, 'badge enrichment')
runner = once(runner, "      suins = await resolveSuins(aggregate.entries.map((entry) => entry.wallet));", "      suins = await resolveSuins(badgeEntries.map((entry) => entry.wallet));", 'SuiNS badge entries')
runner = once(runner, "        names: Object.fromEntries(aggregate.entries.map((entry) => [entry.wallet, null])),\n        requestedCount: aggregate.entries.length,", "        names: Object.fromEntries(badgeEntries.map((entry) => [entry.wallet, null])),\n        requestedCount: badgeEntries.length,", 'SuiNS fallback')
runner = once(runner, "    const entries = aggregate.entries.map((entry) => ({", "    const entries = badgeEntries.map((entry) => ({", 'final enriched entries')
runner = once(runner, "      suins: {\n        requestedCount: suins.requestedCount,", "      activity: {\n        outcome: activity.outcome,\n        methodologyVersion: activity.methodologyVersion,\n        generatedAt: activity.generatedAt,\n        windowStart: activity.windowStart,\n        windowEnd: activity.windowEnd,\n        coverage: activity.coverage,\n        warnings: activity.warnings,\n      },\n      burns: {\n        outcome: burns.outcome,\n        methodologyVersion: burns.methodologyVersion,\n        generatedAt: burns.generatedAt,\n        coverage: burns.coverage,\n        warnings: burns.warnings,\n      },\n      suins: {\n        requestedCount: suins.requestedCount,", 'source badge coverage')
runner = once(runner, "      warnings: [...aggregate.warnings, ...suinsWarnings],", "      warnings: [...aggregate.warnings, ...badgeWarnings, ...suinsWarnings],", 'snapshot warnings')
runner = once(runner, "          lpMaxi: entries.filter((entry) => entry.badges.includes(LP_MAXI_BADGE)).length,", "          lpMaxi: entries.filter((entry) => entry.badges.includes(LP_MAXI_BADGE)).length,\n          diamondHands: entries.filter((entry) => entry.badges.includes(DIAMOND_HANDS_BADGE)).length,\n          paperHands: entries.filter((entry) => entry.badges.includes(PAPER_HANDS_BADGE)).length,\n          accumulator: entries.filter((entry) => entry.badges.includes(ACCUMULATOR_BADGE)).length,\n          burned: entries.filter((entry) => entry.badges.includes(BURNED_BADGE)).length,", 'summary badge counts')
runner_path.write_text(runner, encoding='utf-8')

# Expand cache schema and integrity checks. Existing fixtures without optional enrichment stay valid.
cache_path = Path('netlify/lib/tree-exposure-cache.ts')
cache = cache_path.read_text(encoding='utf-8')
cache = once(cache, "  LP_PROVIDER_BADGE,\n  TREE_EXPOSURE_METHODOLOGY_VERSION,", "  LP_PROVIDER_BADGE,\n  DIAMOND_HANDS_BADGE,\n  PAPER_HANDS_BADGE,\n  ACCUMULATOR_BADGE,\n  BURNED_BADGE,\n  TREE_EXPOSURE_METHODOLOGY_VERSION,", 'cache badge imports')
cache = once(cache, "  suins: {\n    requestedCount: number;", "  activity?: { outcome: string; methodologyVersion: string; generatedAt: string; windowStart: string; windowEnd: string; coverage: Record<string, unknown>; warnings: string[] };\n  burns?: { outcome: string; methodologyVersion: string; generatedAt: string; coverage: Record<string, unknown>; warnings: string[] };\n  suins: {\n    requestedCount: number;", 'source optional badge summaries')
cache = once(cache, "    lpMaxi: number;\n  };", "    lpMaxi: number;\n    diamondHands?: number;\n    paperHands?: number;\n    accumulator?: number;\n    burned?: number;\n  };", 'summary optional counts')
old_expected = """function expectedBadges(liquidRaw: bigint, lpRaw: bigint): string[] {
  const badges: string[] = [];
  if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
  if (lpRaw > liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
  return badges;
}"""
new_expected = """function expectedBadges(liquidRaw: bigint, lpRaw: bigint, entry: Partial<VerifiedExposureEntry>): string[] | null {
  const badges: string[] = [];
  if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
  if (lpRaw > liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
  if (entry.activity30d !== undefined && entry.activity30d !== null) {
    const activity = record(entry.activity30d);
    const buyRaw = parseUnsignedRaw(activity.buyTreeRaw);
    const sellRaw = parseUnsignedRaw(activity.sellTreeRaw);
    if (buyRaw === null || sellRaw === null
      || !safeNonNegativeInteger(activity.buyCount)
      || !safeNonNegativeInteger(activity.sellCount)
      || !safeGeneratedAt(activity.windowStart)
      || !safeGeneratedAt(activity.windowEnd)
      || activity.buyTree !== formatTreeRaw(buyRaw)
      || activity.sellTree !== formatTreeRaw(sellRaw)) return null;
    if (activity.sellCount === 0) badges.push(DIAMOND_HANDS_BADGE);
    if (sellRaw > buyRaw && sellRaw >= 100_000_000_000n) badges.push(PAPER_HANDS_BADGE);
    if (activity.buyCount >= 10 && buyRaw >= 100_000_000_000n && buyRaw > sellRaw) badges.push(ACCUMULATOR_BADGE);
  }
  if (entry.burnedTreeRaw !== undefined && entry.burnedTreeRaw !== null) {
    const burnedRaw = parseUnsignedRaw(entry.burnedTreeRaw);
    if (burnedRaw === null || entry.burnedTree !== formatTreeRaw(burnedRaw)) return null;
    if (burnedRaw >= 500_000_000_000n) badges.push(BURNED_BADGE);
  } else if (entry.burnedTree !== undefined && entry.burnedTree !== null) return null;
  return badges;
}"""
cache = once(cache, old_expected, new_expected, 'expected badge evidence')
cache = once(cache, "  const expected = expectedBadges(liquidRaw, lpRaw);\n  return badges.length === expected.length", "  const expected = expectedBadges(liquidRaw, lpRaw, entry);\n  if (!expected) return false;\n  return badges.length === expected.length", 'entry badge validation')
cache = once(cache, "  let lpMaxi = 0;", "  let lpMaxi = 0;\n  let diamondHands = 0;\n  let paperHands = 0;\n  let accumulator = 0;\n  let burned = 0;", 'cache badge counters')
cache = once(cache, "    if (entry.badges.includes(LP_MAXI_BADGE)) lpMaxi += 1;", "    if (entry.badges.includes(LP_MAXI_BADGE)) lpMaxi += 1;\n    if (entry.badges.includes(DIAMOND_HANDS_BADGE)) diamondHands += 1;\n    if (entry.badges.includes(PAPER_HANDS_BADGE)) paperHands += 1;\n    if (entry.badges.includes(ACCUMULATOR_BADGE)) accumulator += 1;\n    if (entry.badges.includes(BURNED_BADGE)) burned += 1;", 'cache count activity badges')
cache = once(cache, "    && badgeCounts.lpMaxi === lpMaxi\n    && validateSource(snapshot);", "    && badgeCounts.lpMaxi === lpMaxi\n    && (badgeCounts.diamondHands === undefined || badgeCounts.diamondHands === diamondHands)\n    && (badgeCounts.paperHands === undefined || badgeCounts.paperHands === paperHands)\n    && (badgeCounts.accumulator === undefined || badgeCounts.accumulator === accumulator)\n    && (badgeCounts.burned === undefined || badgeCounts.burned === burned)\n    && validateSource(snapshot);", 'summary activity counts')
cache_path.write_text(cache, encoding='utf-8')

# Accept both enrichment revisions in the preview UI and surface the new badges automatically.
app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')
app = once(app, "payload.methodologyVersion === 'verified-tree-exposure-v1'", "String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')", 'UI methodology check')
app = once(app, "payload.methodologyVersion === 'verified-tree-exposure-v1'", "String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')", 'loader methodology check')
app_path.write_text(app, encoding='utf-8')

# Extend the fixture with deterministic badge evidence so cache validation exercises the new rules.
fixture_path = Path('tests/fixtures/tree-exposure-fixture.ts')
fixture = fixture_path.read_text(encoding='utf-8')
fixture = once(fixture, "    badges,\n  };", "    activity30d: null,\n    burnedTreeRaw: null,\n    burnedTree: null,\n    badges,\n  };", 'fixture null evidence')
fixture_path.write_text(fixture, encoding='utf-8')
