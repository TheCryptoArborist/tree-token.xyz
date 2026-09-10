import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTreeRaffleExecuteDrawTransaction,
  buildTreeRaffleClaimTransaction,
  buildTreeRaffleRegisterWinnerTransaction,
  verifyTreeRaffleClaimTransaction,
  verifyTreeRaffleDrawTransaction,
} from '../netlify/lib/tree-raffle-sui-draw.ts';

class MockTransaction {
  commands: any[] = [];
  pure = {
    address: (value: string) => ({ address: value }),
    u64: (value: bigint | string) => ({ u64: value.toString() }),
    vector: (type: 'u8', value: number[]) => ({ vector: type, value }),
  };
  object(id: string) { return { object: id }; }
  moveCall(call: any) { this.commands.push(call); }
}

const PACKAGE = `0x${'1'.repeat(64)}`;
const POOL = `0x${'2'.repeat(64)}`;
const CAP = `0x${'3'.repeat(64)}`;
const WALLET = `0x${'a'.repeat(64)}`;
const DRAW_ID = 'daily:2026-08-20:main';
const COMMITMENT = 'ab'.repeat(32);

test('draw builder binds Random 0x8, the ledger commitment, and total tickets', () => {
  const tx = buildTreeRaffleExecuteDrawTransaction(MockTransaction as any, {
    packageId: PACKAGE, poolId: POOL, operatorCapId: CAP,
    onchainDrawId: DRAW_ID, ledgerCommitment: COMMITMENT, totalTickets: '5',
  }) as unknown as MockTransaction;
  assert.equal(tx.commands.length, 1);
  assert.equal(tx.commands[0].target, `${PACKAGE}::prize_pool::execute_draw`);
  assert.deepEqual(tx.commands[0].arguments[2], { object: '0x8' });
  assert.deepEqual(tx.commands[0].arguments[4].value, [...Buffer.from(COMMITMENT, 'hex')]);
  assert.deepEqual(tx.commands[0].arguments[5], { u64: '5' });
});

test('winner registration builder reserves the configured token and amount', () => {
  const tx = buildTreeRaffleRegisterWinnerTransaction(MockTransaction as any, {
    packageId: PACKAGE, poolId: POOL, operatorCapId: CAP,
    onchainDrawId: DRAW_ID, winner: WALLET,
    tokenType: '0x2::sui::SUI', amountRaw: '1000000000',
  }) as unknown as MockTransaction;
  assert.equal(tx.commands[0].target, `${PACKAGE}::prize_pool::register_winner`);
  assert.deepEqual(tx.commands[0].typeArguments, ['0x2::sui::SUI']);
  assert.deepEqual(tx.commands[0].arguments[3], { address: WALLET });
  assert.deepEqual(tx.commands[0].arguments[4], { u64: '1000000000' });
});

test('claim builder calls only the typed single-use claim entry point', () => {
  const tx = buildTreeRaffleClaimTransaction(MockTransaction as any, {
    packageId: PACKAGE, poolId: POOL, onchainDrawId: DRAW_ID,
    tokenType: '0x2::sui::SUI',
  }) as unknown as MockTransaction;
  assert.equal(tx.commands.length, 1);
  assert.equal(tx.commands[0].target, `${PACKAGE}::prize_pool::claim`);
  assert.deepEqual(tx.commands[0].typeArguments, ['0x2::sui::SUI']);
});

test('finalized DrawExecuted event is matched to the committed ticket owner', () => {
  const eventJson = {
    draw_id: [...new TextEncoder().encode(DRAW_ID)],
    ledger_commitment: [...Buffer.from(COMMITMENT, 'hex')],
    winning_ticket: '3',
    total_tickets: '5',
  };
  const result = verifyTreeRaffleDrawTransaction({
    transaction: {
      digest: '4'.repeat(40), effects: { status: { status: 'success' } },
      events: [{ type: `${PACKAGE}::prize_pool::DrawExecuted`, json: eventJson }],
    },
    packageId: PACKAGE, onchainDrawId: DRAW_ID,
    ledgerCommitment: COMMITMENT, totalTickets: '5',
    ticketRanges: [
      { wallet: `0x${'1'.repeat(64)}`, tickets: '2', start: '0', endExclusive: '2' },
      { wallet: WALLET, tickets: '3', start: '2', endExclusive: '5' },
    ],
  });
  assert.equal(result.winner, WALLET);
  assert.equal(result.winningTicket, '3');
});

test('draw verifier rejects failed, duplicate, or mismatched draw events', () => {
  const base = {
    digest: '4'.repeat(40), effects: { status: { status: 'success' } },
    events: [{ type: `${PACKAGE}::prize_pool::DrawExecuted`, json: {
      draw_id: [...new TextEncoder().encode(DRAW_ID)],
      ledger_commitment: [...Buffer.from(COMMITMENT, 'hex')],
      winning_ticket: '0', total_tickets: '1',
    } }],
  };
  const verify = (transaction: unknown) => verifyTreeRaffleDrawTransaction({
    transaction, packageId: PACKAGE, onchainDrawId: DRAW_ID,
    ledgerCommitment: COMMITMENT, totalTickets: '1',
    ticketRanges: [{ wallet: WALLET, tickets: '1', start: '0', endExclusive: '1' }],
  });
  assert.throws(() => verify({ ...base, effects: { status: { status: 'failure' } } }), /did not finalize/);
  assert.throws(() => verify({ ...base, events: [...base.events, ...base.events] }), /event count/);
  assert.throws(() => verify({ ...base, events: [{ ...base.events[0], json: { ...base.events[0].json, total_tickets: '2' } }] }), /does not match/);
});

test('claim verifier accepts only the winner, token, draw ID, and reserved amount', () => {
  const base = {
    digest: '5'.repeat(40), effects: { status: { status: 'success' } },
    events: [{
      type: `${PACKAGE}::prize_pool::PrizeClaimed<0x2::sui::SUI>`,
      json: {
        draw_id: [...new TextEncoder().encode(DRAW_ID)],
        winner: WALLET,
        amount: '1000000000',
      },
    }],
  };
  const verify = (transaction: unknown, amountRaw = '1000000000') => verifyTreeRaffleClaimTransaction({
    transaction, packageId: PACKAGE, onchainDrawId: DRAW_ID,
    wallet: WALLET, tokenType: '0x2::sui::SUI', amountRaw,
  });
  assert.equal(verify(base).digest, '5'.repeat(40));
  assert.throws(() => verify(base, '999'), /does not match/);
  assert.throws(() => verify({ ...base, events: [...base.events, ...base.events] }), /event count/);
});
