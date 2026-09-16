import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { buildTreeRaffleBrowserClaim } from '../dapp/raffle-transaction-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const transaction = buildTreeRaffleBrowserClaim(Transaction, {
  packageId: '0xf732666a9e373afc1058229a9d6c46cd58ad401471e0c55362b0accca54ae00e',
  poolId: '0x4b46d5f0543b6c036641875145b86d792f858b4315ddc08cc97d4619202438d9',
  onchainDrawId: 'knowledge:2026-08-26:award',
  tokenType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
});
transaction.setSender('0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6');
const bytes = await transaction.build({ client });
const result = await client.core.simulateTransaction({
  transaction: bytes,
  checksEnabled: true,
  include: { effects: true, events: true, balanceChanges: true, commandResults: true },
});
console.log(JSON.stringify(result, null, 2));
