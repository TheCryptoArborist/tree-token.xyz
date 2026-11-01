// Scoped arcade addition to the pinned NFTree wallet module.
// Response fields verified against @mysten/sui 2.26.2 src/client/types.ts and src/grpc/core.ts.
const COLLECTION_TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
const PURCHASE_PACKAGE = '0x79459345a7abde29c4763c97c65f8f48b9e9878dc077ea7ab57c0ad7d585c736';
const MINT_CONFIG = '0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b';
const address = (value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : '';
const objectInput = (transaction, arg) => {
  if (!Number.isInteger(arg?.Input)) return '';
  const input = transaction.inputs?.[arg.Input]?.Object;
  return address(input?.SharedObject?.objectId || input?.ImmOrOwnedObject?.objectId || input?.Receiving?.objectId);
};
function paymentMist(transaction, payment) {
  const result = payment?.NestedResult;
  if (!Array.isArray(result) || result.length !== 2 || result[1] !== 0) return '';
  const split = transaction.commands?.[result[0]]?.SplitCoins;
  if (split?.coin?.GasCoin !== true || split.amounts?.length !== 1 || !Number.isInteger(split.amounts[0]?.Input)) return '';
  const encoded = transaction.inputs?.[split.amounts[0].Input]?.Pure?.bytes;
  try {
    const bytes = atob(encoded);
    if (bytes.length !== 8) return '';
    let value = 0n;
    for (let i = 7; i >= 0; i--) value = (value << 8n) + BigInt(bytes.charCodeAt(i));
    return value.toString();
  } catch { return ''; }
}
const outcome = (expected, status, reason, extra = {}) => ({
  status, reason, digest: expected.digest, accountAddress: expected.accountAddress,
  poolId: expected.poolId, ...extra,
});

export function verifyMintReceipt(result, expected) {
  const transaction = result?.$kind === 'Transaction' ? result.Transaction
    : result?.$kind === 'FailedTransaction' ? result.FailedTransaction : null;
  if (!transaction || transaction.digest !== expected.digest || transaction.effects?.transactionDigest !== expected.digest) {
    return outcome(expected, 'pending', 'RECEIPT_MISMATCH');
  }
  const data = transaction.transaction;
  const commands = data?.commands;
  const calls = Array.isArray(commands) ? commands.filter((command) => command?.MoveCall).map((command) => command.MoveCall) : [];
  const purchase = calls[0];
  // Match the actual reviewed two-command NFTree purchase, not an arbitrary transaction by this wallet.
  if (address(data?.sender) !== address(expected.accountAddress) || !address(expected.accountAddress) ||
      commands?.length !== 2 || calls.length !== 1 || address(purchase?.package) !== PURCHASE_PACKAGE ||
      purchase.module !== 'collection' || purchase.function !== 'purchase' || purchase.arguments?.length !== 3 ||
      objectInput(data, purchase.arguments[0]) !== expected.poolId ||
      objectInput(data, purchase.arguments[2]) !== MINT_CONFIG || paymentMist(data, purchase.arguments[1]) !== expected.mintPriceMist) {
    return outcome(expected, 'pending', 'PURCHASE_SCOPE_MISMATCH');
  }
  if (result.$kind === 'FailedTransaction' && transaction.status?.success === false && transaction.effects.status?.success === false) {
    return outcome(expected, 'failed', 'TRANSACTION_FAILED');
  }
  if (result.$kind !== 'Transaction' || transaction.status?.success !== true || transaction.effects.status?.success !== true) {
    return outcome(expected, 'pending', 'EXECUTION_UNVERIFIED');
  }
  const changes = transaction.effects.changedObjects;
  if (!Array.isArray(changes) || !transaction.objectTypes) return outcome(expected, 'pending', 'NFT_EFFECTS_UNAVAILABLE');
  const nfts = changes.filter((change) => transaction.objectTypes[change.objectId] === COLLECTION_TYPE);
  const nft = nfts[0];
  const newlyReceived = nft?.idOperation === 'Created' || nft?.inputState === 'DoesNotExist' ||
    (nft?.inputOwner?.$kind === 'ObjectOwner' && address(nft.inputOwner.ObjectOwner) === expected.poolId);
  if (nfts.length !== 1 || !address(nft?.objectId) || !newlyReceived || nft?.idOperation === 'Deleted' ||
      nft?.outputState !== 'ObjectWrite' || nft?.outputOwner?.$kind !== 'AddressOwner' ||
      address(nft.outputOwner.AddressOwner) !== address(expected.accountAddress)) {
    return outcome(expected, 'pending', 'NFT_TRANSFER_UNVERIFIED');
  }
  return outcome(expected, 'confirmed', '', { nftObjectId: address(nft.objectId), nftType: COLLECTION_TYPE });
}

export async function confirmMintReceiptWithClient(client, expected) {
  try {
    const result = await client.waitForTransaction({
      digest: expected.digest, timeout: 12_000, pollSchedule: [0, 400, 1000, 2500, 5000],
      include: { effects: true, objectTypes: true, transaction: true },
    });
    const receipt = verifyMintReceipt(result, expected);
    if (receipt.status === 'pending') return receipt;
    // A manually recovered digest must belong to this purchase window, not an older receipt.
    // The concrete gRPC service has timestamp/checkpoint fields that the core result omits.
    const { response } = await client.ledgerService.getTransaction({
      digest: expected.digest, readMask: { paths: ['digest', 'timestamp', 'checkpoint'] },
    }, { abort: AbortSignal.timeout(8_000) });
    const recorded = response?.transaction;
    const timestamp = recorded?.timestamp;
    const timestampMs = Number(timestamp?.seconds) * 1000 + Number(timestamp?.nanos || 0) / 1_000_000;
    if (recorded?.digest !== expected.digest || recorded.checkpoint === undefined ||
        !Number.isFinite(timestampMs) || !Number.isFinite(expected.createdAt) ||
        timestampMs < expected.createdAt - 120_000 || timestampMs > Date.now() + 10_000) {
      return outcome(expected, 'pending', 'CHECKPOINT_UNVERIFIED');
    }
    if (receipt.status === 'failed') return receipt;
    const { object } = await client.getObject({ objectId: receipt.nftObjectId, signal: AbortSignal.timeout(8_000) });
    if (address(object?.objectId) !== receipt.nftObjectId || object?.type !== COLLECTION_TYPE ||
        object?.owner?.$kind !== 'AddressOwner' || address(object.owner.AddressOwner) !== address(expected.accountAddress)) {
      return outcome(expected, 'pending', 'CURRENT_NFT_OWNERSHIP_UNVERIFIED');
    }
    return receipt;
  } catch {
    return outcome(expected, 'pending', 'CONFIRMATION_UNAVAILABLE');
  }
}
