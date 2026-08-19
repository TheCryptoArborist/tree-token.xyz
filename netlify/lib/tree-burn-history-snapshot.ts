export const TREE_BURN_HISTORY_SNAPSHOT = {
  generatedAt: '2026-08-18T20:52:06.422Z',
  source: 'Sui Mainnet zero-address TREE coin objects',
  coinObjects: 1507,
  totalTransactions: 722,
  totalBurned: '60422789.609865',
  recentBurns: [
    {
      digest: '45RWDeLWdMgy28kT1CASSft2SF5QgTV41BbZhSQ8Syhc',
      amount: '1658.854024',
      timestamp: '2026-08-16T02:15:10.519Z',
    },
    {
      digest: '4HL6UCLRKAtKbo9YtmXgpkqPckmhyuqwAPMZRrpzCNFu',
      amount: '4088.141633',
      timestamp: '2026-08-16T02:15:10.519Z',
    },
    {
      digest: 'nyAXpV85DtyP3xe2rPHAseSWrboojYhowo9jk5hJoDw',
      amount: '4474.967929',
      timestamp: '2026-08-16T02:09:09.082Z',
    },
  ],
} as const;

export function burnAge(timestamp: string, nowMs = Date.now()) {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || timestampMs > nowMs) return '—';
  const days = Math.floor((nowMs - timestampMs) / 86_400_000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor((nowMs - timestampMs) / 3_600_000);
  if (hours > 0) return `${hours}h`;
  return `${Math.max(0, Math.floor((nowMs - timestampMs) / 60_000))}m`;
}

export function verifiedBurnHistory(nowMs = Date.now()) {
  return {
    ...TREE_BURN_HISTORY_SNAPSHOT,
    recentBurns: TREE_BURN_HISTORY_SNAPSHOT.recentBurns.map((burn) => ({
      ...burn,
      age: burnAge(burn.timestamp, nowMs),
    })),
  };
}
