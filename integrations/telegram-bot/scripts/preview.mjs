import { formatNotification } from '../src/messages.mjs';

const payload = { wallet: `0x${'1'.repeat(64)}`, roundId: 'knowledge:2026-09-23',
  txDigest: '2'.repeat(44), treeAmountRaw: '1250000000000', qualifyingUsdCents: '2500' };
for (const kind of ['qualifying_buy', 'challenge_completed']) {
  console.log(JSON.stringify({ sampleOnly: true, ...formatNotification({ kind, payload }) }, null, 2));
}
