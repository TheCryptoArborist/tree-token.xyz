import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_FUNDING_WALLET,
  TREE_RAFFLE_PACKAGE_ID,
  TREE_RAFFLE_PRIZE_POOL_ID,
  TREE_TYPE,
  buildChallengePoolFundingTransaction,
  formatTreeRaw,
  isChallengeFundingWallet,
  parseTreeFundingAmount,
  summarizeChallengeKeeper,
} from '../dapp/challenge-funding-core.js';

class Transaction {
  commands = [];
  sender = '';
  pure = { u64: (value) => ({ u64: BigInt(value) }) };
  setSender(value) { this.sender = value; }
  object(value) { return { object: value }; }
  mergeCoins(target, sources) { this.commands.push({ MergeCoins: { target, sources } }); }
  splitCoins(coin, amounts) {
    this.commands.push({ SplitCoins: { coin, amounts } });
    return [{ splitCoin: true }];
  }
  transferObjects(objects, owner) { this.commands.push({ TransferObjects: { objects, owner } }); }
  moveCall(input) {
    const [pkg, module, fn] = input.target.split('::');
    this.commands.push({ MoveCall: { package: pkg, module, function: fn, ...input } });
  }
  getData() { return { commands: this.commands }; }
}

const client = {
  core: {
    async listCoins() {
      return {
        objects: [{ objectId: `0x${'a'.repeat(64)}`, balance: '1000000000000' }],
        hasNextPage: false,
        cursor: null,
      };
    },
  },
};

test('Challenge funding is visible only to the designated wallet identity', () => {
  assert.equal(isChallengeFundingWallet(CHALLENGE_FUNDING_WALLET), true);
  assert.equal(isChallengeFundingWallet(CHALLENGE_FUNDING_WALLET.toUpperCase()), true);
  assert.equal(isChallengeFundingWallet(`0x${'1'.repeat(64)}`), false);
  assert.equal(isChallengeFundingWallet(''), false);
});

test('TREE funding amounts use six exact decimals', () => {
  assert.equal(parseTreeFundingAmount('50,000'), 50_000_000_000n);
  assert.equal(parseTreeFundingAmount('350000'), 350_000_000_000n);
  assert.equal(parseTreeFundingAmount('1.000001'), 1_000_001n);
  assert.equal(formatTreeRaw(350_000_000_000n), '350,000');
  assert.throws(() => parseTreeFundingAmount('0'));
  assert.throws(() => parseTreeFundingAmount('1.0000001'));
});

test('funding builder creates one typed deposit call to the verified pool', async () => {
  const built = await buildChallengePoolFundingTransaction({
    Transaction,
    client,
    owner: CHALLENGE_FUNDING_WALLET,
    amountRaw: 350_000_000_000n,
  });
  assert.equal(built.transaction.sender, CHALLENGE_FUNDING_WALLET);
  const moveCalls = built.transaction.commands.filter((command) => command.MoveCall).map((command) => command.MoveCall);
  assert.equal(moveCalls.length, 1);
  assert.equal(moveCalls[0].target, `${TREE_RAFFLE_PACKAGE_ID}::prize_pool::deposit`);
  assert.deepEqual(moveCalls[0].typeArguments, [TREE_TYPE]);
  assert.deepEqual(moveCalls[0].arguments[0], { object: TREE_RAFFLE_PRIZE_POOL_ID });
});

test('funding builder rejects every other connected wallet', async () => {
  await assert.rejects(() => buildChallengePoolFundingTransaction({
    Transaction,
    client,
    owner: `0x${'1'.repeat(64)}`,
    amountRaw: 50_000_000_000n,
  }), /designated Challenge funding wallet/);
});

test('keeper summary separates available TREE from reserved winner prizes', () => {
  const winnerPrizeType = `0xf732::prize_pool::WinnerPrize<${TREE_TYPE}>`;
  const summary = summarizeChallengeKeeper({
    availableRaw: 25_000_000_000n,
    poolFields: [
      { value: { type: { repr: winnerPrizeType }, json: { balance: '50000000000' } } },
      { value: { type: { repr: '0xf732::prize_pool::DrawOutcome' }, json: {} } },
    ],
    recentRounds: [
      { state: 'scored', award: null },
      { state: 'awarded', award: { claimable: true } },
      { state: 'open', award: null },
    ],
  });
  assert.deepEqual(summary, {
    availableRaw: 25_000_000_000n,
    reservedRaw: 50_000_000_000n,
    totalRaw: 75_000_000_000n,
    reservedPrizeCount: 1,
    unresolvedRoundCount: 1,
  });
});
