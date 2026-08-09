from pathlib import Path

path = Path('netlify/lib/tree-exposure-cache.ts')
text = path.read_text(encoding='utf-8')
old = """  let top50TotalRaw = 0n;
  let top50LiquidRaw = 0n;
  let top50LpRaw = 0n;
  let lpProvider = 0;
  let lpMaxi = 0;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    if (!validateEntry(entry, index + 1) || wallets.has(entry.wallet)) return false;
    wallets.add(entry.wallet);
    top50TotalRaw += BigInt(entry.totalExposureRaw);
    top50LiquidRaw += BigInt(entry.liquidTreeRaw);
    top50LpRaw += BigInt(entry.lpTreeRaw);
"""
new = """  let top50TotalRaw = 0n;
  let top50LiquidRaw = 0n;
  let top50LpRaw = 0n;
  let lpProvider = 0;
  let lpMaxi = 0;
  let previousTotalRaw: bigint | null = null;
  let previousLiquidRaw: bigint | null = null;
  let previousWallet: string | null = null;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    if (!validateEntry(entry, index + 1) || wallets.has(entry.wallet)) return false;
    const currentTotalRaw = BigInt(entry.totalExposureRaw);
    const currentLiquidRaw = BigInt(entry.liquidTreeRaw);
    if (previousTotalRaw !== null && previousLiquidRaw !== null && previousWallet !== null) {
      if (currentTotalRaw > previousTotalRaw
        || (currentTotalRaw === previousTotalRaw && currentLiquidRaw > previousLiquidRaw)
        || (currentTotalRaw === previousTotalRaw
          && currentLiquidRaw === previousLiquidRaw
          && entry.wallet.localeCompare(previousWallet) < 0)) return false;
    }
    previousTotalRaw = currentTotalRaw;
    previousLiquidRaw = currentLiquidRaw;
    previousWallet = entry.wallet;
    wallets.add(entry.wallet);
    top50TotalRaw += currentTotalRaw;
    top50LiquidRaw += currentLiquidRaw;
    top50LpRaw += BigInt(entry.lpTreeRaw);
"""
if text.count(old) != 1:
    raise SystemExit('Expected exposure cache validation block was not found exactly once.')
path.write_text(text.replace(old, new), encoding='utf-8')
