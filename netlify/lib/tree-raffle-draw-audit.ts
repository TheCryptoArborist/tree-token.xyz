import { createHash } from 'node:crypto';

export const TREE_RAFFLE_SELECTION_SCHEME = 'wallet-asc-cumulative-v1';
export const TREE_RAFFLE_LEDGER_COMMITMENT_VERSION = 'tree-raffle-ledger-v1';

const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const DRAW_ID = /^[a-z0-9][a-z0-9:_-]{2,95}$/;

export type TreeRaffleTicketRange = {
  wallet: string;
  tickets: string;
  start: string;
  endExclusive: string;
};

function unsigned(value: string, label: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`Invalid TREE raffle ${label}.`);
  return BigInt(value);
}

export function validateTreeRaffleTicketRanges(
  onchainDrawId: string,
  ranges: TreeRaffleTicketRange[],
): bigint {
  if (!DRAW_ID.test(onchainDrawId)) throw new Error('Invalid TREE raffle on-chain draw ID.');
  if (!Array.isArray(ranges) || ranges.length === 0) throw new Error('TREE raffle ticket ranges are empty.');

  let cursor = 0n;
  let previousWallet = '';
  const seen = new Set<string>();

  for (const range of ranges) {
    if (!SUI_ADDRESS.test(range.wallet)) throw new Error('Invalid TREE raffle ticket wallet.');
    if (seen.has(range.wallet) || range.wallet <= previousWallet) {
      throw new Error('TREE raffle ticket wallets must be unique and sorted ascending.');
    }
    seen.add(range.wallet);
    previousWallet = range.wallet;

    const tickets = unsigned(range.tickets, 'ticket count');
    const start = unsigned(range.start, 'range start');
    const endExclusive = unsigned(range.endExclusive, 'range end');
    if (tickets <= 0n || start !== cursor || endExclusive !== start + tickets) {
      throw new Error('TREE raffle ticket ranges must be positive and contiguous.');
    }
    cursor = endExclusive;
  }

  return cursor;
}

export function canonicalTreeRaffleLedger(
  onchainDrawId: string,
  ranges: TreeRaffleTicketRange[],
): string {
  validateTreeRaffleTicketRanges(onchainDrawId, ranges);
  const rows = ranges.map((range) => (
    `${range.wallet}:${range.tickets}:${range.start}:${range.endExclusive}`
  ));
  return `${TREE_RAFFLE_LEDGER_COMMITMENT_VERSION}\n${onchainDrawId}\n${rows.join('\n')}`;
}

export function treeRaffleLedgerCommitment(
  onchainDrawId: string,
  ranges: TreeRaffleTicketRange[],
): string {
  return createHash('sha256')
    .update(canonicalTreeRaffleLedger(onchainDrawId, ranges), 'utf8')
    .digest('hex');
}

export function treeRaffleWinnerForTicket(
  ranges: TreeRaffleTicketRange[],
  winningTicket: bigint,
): string {
  if (winningTicket < 0n) throw new Error('Invalid TREE raffle winning ticket.');
  for (const range of ranges) {
    const start = unsigned(range.start, 'range start');
    const endExclusive = unsigned(range.endExclusive, 'range end');
    if (winningTicket >= start && winningTicket < endExclusive) return range.wallet;
  }
  throw new Error('TREE raffle winning ticket is outside the committed ledger.');
}
