import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalTreeRaffleLedger,
  treeRaffleLedgerCommitment,
  treeRaffleWinnerForTicket,
  validateTreeRaffleTicketRanges,
  type TreeRaffleTicketRange,
} from '../netlify/lib/tree-raffle-draw-audit.ts';

const WALLET_A = `0x${'1'.repeat(64)}`;
const WALLET_B = `0x${'a'.repeat(64)}`;
const DRAW_ID = 'weekly:2026-08-23:main';
const RANGES: TreeRaffleTicketRange[] = [
  { wallet: WALLET_A, tickets: '2', start: '0', endExclusive: '2' },
  { wallet: WALLET_B, tickets: '3', start: '2', endExclusive: '5' },
];

test('canonical TREE raffle ledger is deterministic and committed with SHA-256', () => {
  assert.equal(validateTreeRaffleTicketRanges(DRAW_ID, RANGES), 5n);
  assert.equal(
    canonicalTreeRaffleLedger(DRAW_ID, RANGES),
    `tree-raffle-ledger-v1\n${DRAW_ID}\n${WALLET_A}:2:0:2\n${WALLET_B}:3:2:5`,
  );
  assert.equal(treeRaffleLedgerCommitment(DRAW_ID, RANGES).length, 64);
  assert.equal(treeRaffleLedgerCommitment(DRAW_ID, RANGES), treeRaffleLedgerCommitment(DRAW_ID, structuredClone(RANGES)));
});

test('winning ticket maps to exactly one wallet in the committed ranges', () => {
  assert.equal(treeRaffleWinnerForTicket(RANGES, 0n), WALLET_A);
  assert.equal(treeRaffleWinnerForTicket(RANGES, 1n), WALLET_A);
  assert.equal(treeRaffleWinnerForTicket(RANGES, 2n), WALLET_B);
  assert.equal(treeRaffleWinnerForTicket(RANGES, 4n), WALLET_B);
  assert.throws(() => treeRaffleWinnerForTicket(RANGES, 5n), /outside the committed ledger/);
});

test('malformed, unsorted, or non-contiguous ledgers fail closed', () => {
  assert.throws(
    () => validateTreeRaffleTicketRanges(DRAW_ID, [
      { wallet: WALLET_B, tickets: '2', start: '0', endExclusive: '2' },
      { wallet: WALLET_A, tickets: '3', start: '2', endExclusive: '5' },
    ]),
    /sorted ascending/,
  );
  assert.throws(
    () => validateTreeRaffleTicketRanges(DRAW_ID, [
      RANGES[0],
      { ...RANGES[1], start: '3', endExclusive: '6' },
    ]),
    /positive and contiguous/,
  );
});
