import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { buildTurbosLockedFeeClaim } from '../dapp/turbos-locked-claim-core.js';
import { TURBOS_BURN_POSITION_NFT_TYPE } from '../dapp/turbos-position-core.js';

const [owner, burnNftId] = process.argv.slice(2);
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(burnNftId || '')) {
  throw new Error('Usage: node scripts/verify-turbos-locked-claim.mjs <owner> <burn-nft-id>');
}

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const owned = await client.core.listOwnedObjects({
  owner,
  type: TURBOS_BURN_POSITION_NFT_TYPE,
  include: { json: true, owner: true },
  limit: 50,
});
const candidates = owned.objects || [];
const burnObject = candidates.find((object) => object?.objectId?.toLowerCase() === burnNftId.toLowerCase())
  || candidates.find((object) => String(object?.json?.position_id || object?.json?.fields?.position_id || '').toLowerCase() === burnNftId.toLowerCase());
if (!burnObject) throw new Error(`No directly owned Turbos burn wrapper matched ${burnNftId}. Found ${candidates.length} wrapper(s).`);
const resolvedBurnNftId = burnObject.objectId;
console.log(JSON.stringify({
  objectId: burnObject?.objectId,
  type: burnObject?.type,
  owner: burnObject?.owner,
  json: burnObject?.json,
}, null, 2));
const transaction = buildTurbosLockedFeeClaim({
  Transaction,
  owner,
  packageId: '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64',
  poolId: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
  positionsId: '0xf5762ae5ae19a2016bb233c72d9a4b2cba5a302237a82724af66292ae43ae52d',
  versionedId: '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
  burnNftId: resolvedBurnNftId,
  coinTypeA: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  coinTypeB: '0x2::sui::SUI',
  feeType: '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee10000bps::FEE10000BPS',
  amountA: 18_446_744_073_709_551_615n,
  amountB: 18_446_744_073_709_551_615n,
});
const bytes = await transaction.build({ client });
const result = await client.core.simulateTransaction({ transaction: bytes, include: { effects: true, events: true, balanceChanges: true } });
const core = result?.$kind === 'Transaction' ? result.Transaction : (result?.Transaction || result);
const success = core?.effects?.status?.success === true && !result?.FailedTransaction;
if (!success) throw new Error(JSON.stringify(result?.FailedTransaction?.status?.error || core?.effects?.status?.error || result));
console.log(JSON.stringify({ success, events: core?.events?.length ?? result?.events?.length ?? 0, balanceChanges: core?.balanceChanges?.length ?? result?.balanceChanges?.length ?? 0 }, null, 2));
