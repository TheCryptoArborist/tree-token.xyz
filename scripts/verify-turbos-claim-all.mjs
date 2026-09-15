import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { buildTurbosClaimAllFees } from '../dapp/turbos-locked-claim-core.js';
import { TURBOS_BURN_POSITION_NFT_TYPE, matchesTurbosPool, parseTurbosPositionObject } from '../dapp/turbos-position-core.js';

const owner = process.argv[2] || '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6';
if (!/^0x[0-9a-f]{64}$/i.test(owner)) throw new Error('Usage: node scripts/verify-turbos-claim-all.mjs [owner]');
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const owned = await client.core.listOwnedObjects({ owner, type: TURBOS_BURN_POSITION_NFT_TYPE, include: { json: true }, limit: 50 });
const wrappers = (owned.objects || []).map(parseTurbosPositionObject).filter((position) => matchesTurbosPool(position, {
  poolId: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
  coinTypeA: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  coinTypeB: '0x2::sui::SUI',
  feeType: '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee10000bps::FEE10000BPS',
}));
if (!wrappers.length) throw new Error('No currently owned locked Turbos TREE/SUI positions were found.');
const transaction = buildTurbosClaimAllFees({
  Transaction, owner,
  packageId: '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64',
  poolId: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
  positionsId: '0xf5762ae5ae19a2016bb233c72d9a4b2cba5a302237a82724af66292ae43ae52d',
  versionedId: '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
  coinTypeA: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  coinTypeB: '0x2::sui::SUI',
  feeType: '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee10000bps::FEE10000BPS',
  items: wrappers.map((position) => ({ nftId: position.objectId, kind: 'burn-proof', amountA: 18_446_744_073_709_551_615n, amountB: 18_446_744_073_709_551_615n })),
});
const bytes = await transaction.build({ client });
const result = await client.core.simulateTransaction({ transaction: bytes, include: { effects: true, events: true, balanceChanges: true } });
const core = result?.$kind === 'Transaction' ? result.Transaction : (result?.Transaction || result);
const success = core?.effects?.status?.success === true && !result?.FailedTransaction;
if (!success) throw new Error(JSON.stringify(result?.FailedTransaction?.status?.error || core?.effects?.status?.error || result));
console.log(JSON.stringify({ success, positions: wrappers.length, commands: transaction.getData().commands.map((command) => command.$kind), events: core?.events?.length ?? 0 }, null, 2));
