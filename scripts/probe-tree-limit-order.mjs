import { Aftermath } from 'aftermath-ts-sdk';
import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const OWNER = '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6';
const SUI = '0x2::sui::SUI';
const TREE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';

const sdk = await Aftermath.create({ network: 'MAINNET' });
const limitOrders = sdk.LimitOrders();
const minOrderSizeUsd = await limitOrders.getMinOrderSizeUsd();
const userPublicKey = await sdk.UserData().getUserPublicKey({ walletAddress: OWNER });
console.log(JSON.stringify({ minOrderSizeUsd, userPublicKey }));
const transaction = await limitOrders.getCreateLimitOrderTx({
  walletAddress: OWNER,
  allocateCoinType: SUI,
  allocateCoinAmount: 10_000_000_000n,
  buyCoinType: TREE,
  expiryDurationMs: 60 * 60 * 1000,
  outputToInputExchangeRate: 0.000025,
  outputToInputStopLossExchangeRate: 0,
  isSponsoredTx: false,
});
transaction.setSender(OWNER);

const client = new SuiGrpcClient({
  network: 'mainnet',
  transport: new GrpcTransport({
    host: 'fullnode.mainnet.sui.io:443',
    channelCredentials: ChannelCredentials.createSsl(),
  }),
});
const simulation = await client.core.simulateTransaction({
  transaction,
  checksEnabled: true,
  include: { effects: true, events: true, balanceChanges: true, commandResults: true },
});

console.log(JSON.stringify({
  minOrderSizeUsd,
  commands: transaction.getData().commands,
  simulation,
}, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
