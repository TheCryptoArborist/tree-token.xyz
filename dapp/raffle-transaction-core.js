const SUI_ID = /^0x[0-9a-fA-F]{1,64}$/;

function id(value, label) {
  if (!SUI_ID.test(String(value || ''))) throw new Error(`Invalid TREE raffle ${label}.`);
  return String(value).toLowerCase();
}

function drawIdBytes(value) {
  const bytes = [...new TextEncoder().encode(String(value || ''))];
  if (!bytes.length || bytes.length > 96) throw new Error('Invalid TREE raffle draw ID.');
  return bytes;
}

export function buildTreeRaffleBrowserClaim(Transaction, input) {
  if (typeof Transaction !== 'function') throw new Error('The Sui transaction builder is unavailable.');
  if (!String(input?.tokenType || '').includes('::')) throw new Error('Invalid TREE raffle prize token type.');
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${id(input.packageId, 'package ID')}::prize_pool::claim`,
    typeArguments: [input.tokenType],
    arguments: [
      transaction.object(id(input.poolId, 'prize pool ID')),
      transaction.pure.vector('u8', drawIdBytes(input.onchainDrawId)),
    ],
  });
  return transaction;
}
