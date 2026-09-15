import { normalizeTurbosAddress, normalizeTurbosType } from './turbos-position-core.js';

export const TURBOS_CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const TURBOS_LOCKED_FEE_FUNCTION = 'burn_nft_collect_fee_with_return_';
export const TURBOS_STANDARD_FEE_FUNCTION = 'collect';

function moveCall(command) {
  return command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
}

function transferObjects(command) {
  return command?.TransferObjects || (command?.$kind === 'TransferObjects' ? command.TransferObjects : null);
}

function unresolvedObjectId(input) {
  return input?.UnresolvedObject?.objectId || (input?.$kind === 'UnresolvedObject' ? input.UnresolvedObject?.objectId : null);
}

export function validateTurbosLockedFeeClaimTransaction(transaction, {
  owner, packageId, poolId, positionsId, versionedId, burnNftId, coinTypeA, coinTypeB, feeType,
}) {
  const data = transaction?.getData?.();
  if (!data) throw new Error('The Turbos locked-fee transaction is not inspectable.');
  if (normalizeTurbosAddress(data.sender) !== normalizeTurbosAddress(owner)) throw new Error('The Turbos locked-fee sender does not match the connected wallet.');
  const calls = (data.commands || []).map(moveCall).filter(Boolean);
  const transfers = (data.commands || []).map(transferObjects).filter(Boolean);
  if (calls.length !== 1 || transfers.length !== 1 || (data.commands || []).length !== 2) throw new Error('The Turbos locked-fee transaction contains unexpected commands.');
  const [call] = calls;
  if (normalizeTurbosAddress(call.package) !== normalizeTurbosAddress(packageId)
    || call.module !== 'position_manager' || call.function !== TURBOS_LOCKED_FEE_FUNCTION) throw new Error('The Turbos locked-fee transaction targets an unexpected function.');
  const actualTypes = (call.typeArguments || []).map(normalizeTurbosType);
  const expectedTypes = [coinTypeA, coinTypeB, feeType].map(normalizeTurbosType);
  if (actualTypes.length !== expectedTypes.length || actualTypes.some((value, index) => value !== expectedTypes[index])) throw new Error('The Turbos locked-fee transaction uses unexpected coin or fee types.');
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeTurbosAddress);
  for (const required of [poolId, positionsId, burnNftId, TURBOS_CLOCK_ID, versionedId]) {
    if (!objectIds.includes(normalizeTurbosAddress(required))) throw new Error('The Turbos locked-fee transaction is missing a verified protocol object.');
  }
  return transaction;
}

export function buildTurbosLockedFeeClaim({
  Transaction, owner, packageId, poolId, positionsId, versionedId, burnNftId,
  coinTypeA, coinTypeB, feeType, amountA, amountB, deadline = Date.now() + 180_000,
}) {
  const feeA = BigInt(amountA || 0);
  const feeB = BigInt(amountB || 0);
  if (!Transaction || !/^0x[0-9a-f]{64}$/i.test(String(owner || ''))) throw new Error('A connected Sui wallet is required.');
  if (!/^0x[0-9a-f]{64}$/i.test(String(burnNftId || '')) || (feeA <= 0n && feeB <= 0n)) throw new Error('No locked Turbos fees are currently claimable.');
  const transaction = new Transaction();
  transaction.setSender(owner);
  const [coinA, coinB] = transaction.moveCall({
    target: `${packageId}::position_manager::${TURBOS_LOCKED_FEE_FUNCTION}`,
    typeArguments: [coinTypeA, coinTypeB, feeType],
    arguments: [
      transaction.object(poolId),
      transaction.object(positionsId),
      transaction.object(burnNftId),
      transaction.pure.u64(feeA),
      transaction.pure.u64(feeB),
      transaction.pure.u64(BigInt(deadline)),
      transaction.object(TURBOS_CLOCK_ID),
      transaction.object(versionedId),
    ],
  });
  transaction.transferObjects([coinA, coinB], transaction.pure.address(owner));
  return validateTurbosLockedFeeClaimTransaction(transaction, {
    owner, packageId, poolId, positionsId, versionedId, burnNftId, coinTypeA, coinTypeB, feeType,
  });
}

export function validateTurbosClaimAllFeesTransaction(transaction, {
  owner, packageId, poolId, positionsId, versionedId, coinTypeA, coinTypeB, feeType, items,
}) {
  const data = transaction?.getData?.();
  if (!data) throw new Error('The Turbos Claim All transaction is not inspectable.');
  if (normalizeTurbosAddress(data.sender) !== normalizeTurbosAddress(owner)) throw new Error('The Turbos Claim All sender does not match the connected wallet.');
  const reviewed = (items || []).filter((item) => BigInt(item.amountA || 0) > 0n || BigInt(item.amountB || 0) > 0n);
  if (!reviewed.length) throw new Error('No Turbos fees are currently claimable.');
  const calls = (data.commands || []).map(moveCall).filter(Boolean);
  const transfers = (data.commands || []).map(transferObjects).filter(Boolean);
  const lockedCount = reviewed.filter((item) => item.kind === 'burn-proof').length;
  if (calls.length !== reviewed.length || transfers.length !== (lockedCount ? 1 : 0)) throw new Error('The Turbos Claim All transaction contains unexpected commands.');
  calls.forEach((call, index) => {
    const item = reviewed[index];
    const expectedFunction = item.kind === 'burn-proof' ? TURBOS_LOCKED_FEE_FUNCTION : TURBOS_STANDARD_FEE_FUNCTION;
    if (normalizeTurbosAddress(call.package) !== normalizeTurbosAddress(packageId)
      || call.module !== 'position_manager' || call.function !== expectedFunction) throw new Error('The Turbos Claim All transaction targets an unexpected function.');
    const actualTypes = (call.typeArguments || []).map(normalizeTurbosType);
    const expectedTypes = [coinTypeA, coinTypeB, feeType].map(normalizeTurbosType);
    if (actualTypes.length !== expectedTypes.length || actualTypes.some((value, typeIndex) => value !== expectedTypes[typeIndex])) throw new Error('The Turbos Claim All transaction uses unexpected coin or fee types.');
  });
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeTurbosAddress);
  const allowedObjects = new Set([poolId, positionsId, versionedId, TURBOS_CLOCK_ID, ...reviewed.map((item) => item.nftId)].map(normalizeTurbosAddress));
  for (const required of allowedObjects) if (!objectIds.includes(required)) throw new Error('The Turbos Claim All transaction is missing a reviewed protocol object.');
  if (objectIds.some((objectId) => !allowedObjects.has(objectId))) throw new Error('The Turbos Claim All transaction references an unexpected object.');
  return transaction;
}

export function buildTurbosClaimAllFees({
  Transaction, owner, packageId, poolId, positionsId, versionedId,
  coinTypeA, coinTypeB, feeType, items, deadline = Date.now() + 180_000,
}) {
  const reviewed = (items || []).filter((item) => BigInt(item.amountA || 0) > 0n || BigInt(item.amountB || 0) > 0n);
  if (!Transaction || !/^0x[0-9a-f]{64}$/i.test(String(owner || '')) || !reviewed.length) throw new Error('A connected wallet with claimable Turbos fees is required.');
  const transaction = new Transaction();
  transaction.setSender(owner);
  const returnedCoins = [];
  for (const item of reviewed) {
    const baseArguments = [
      transaction.object(poolId), transaction.object(positionsId), transaction.object(item.nftId),
      transaction.pure.u64(BigInt(item.amountA || 0)), transaction.pure.u64(BigInt(item.amountB || 0)),
    ];
    if (item.kind === 'burn-proof') {
      const [coinA, coinB] = transaction.moveCall({
        target: `${packageId}::position_manager::${TURBOS_LOCKED_FEE_FUNCTION}`,
        typeArguments: [coinTypeA, coinTypeB, feeType],
        arguments: [...baseArguments, transaction.pure.u64(BigInt(deadline)), transaction.object(TURBOS_CLOCK_ID), transaction.object(versionedId)],
      });
      returnedCoins.push(coinA, coinB);
    } else {
      transaction.moveCall({
        target: `${packageId}::position_manager::${TURBOS_STANDARD_FEE_FUNCTION}`,
        typeArguments: [coinTypeA, coinTypeB, feeType],
        arguments: [...baseArguments, transaction.pure.address(owner), transaction.pure.u64(BigInt(deadline)), transaction.object(TURBOS_CLOCK_ID), transaction.object(versionedId)],
      });
    }
  }
  if (returnedCoins.length) transaction.transferObjects(returnedCoins, transaction.pure.address(owner));
  return validateTurbosClaimAllFeesTransaction(transaction, {
    owner, packageId, poolId, positionsId, versionedId, coinTypeA, coinTypeB, feeType, items: reviewed,
  });
}
