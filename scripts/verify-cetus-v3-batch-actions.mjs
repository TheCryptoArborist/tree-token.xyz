import { CetusClmmSDK } from '@cetusprotocol/sui-clmm-sdk';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  CETUS_TREE_POOL_ID, CETUS_TREE_COIN_TYPE, CETUS_SUI_COIN_TYPE,
  cetusPriceFromTick, validateCetusTreePool,
} from '../dapp/cetus-v3-core.js';

const POSITION_ID = '0xba03abee2ca9d79fb1b0604ae16c2bfbae4f2de6c4cfc8add469cc329fc02374';
const OWNER = '0x0de00c55730739622b2f7acc92ca571d3c344b219e7c0d63a3660d58774c83f1';
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const sdk = CetusClmmSDK.createSDK({ env: 'mainnet', sui_client: client });
sdk.setSenderAddress(OWNER);

async function simulate(transaction) {
  const bytes = await transaction.build({ client });
  return client.core.simulateTransaction({ transaction: bytes, include: { effects: true, events: true, balanceChanges: true } });
}

function succeeded(result) {
  const core = result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction;
  return core?.effects?.status?.success === true && !result?.FailedTransaction;
}

const pool = validateCetusTreePool(await sdk.Pool.getPool(CETUS_TREE_POOL_ID, true));
const position = await sdk.Position.getPositionById(POSITION_ID, false);
const fees = await sdk.Position.batchFetchPositionFees([POSITION_ID]);
const fee = fees[POSITION_ID] || {};
const treeRaw = BigInt(fee.fee_owned_a ?? fee.feeOwedA ?? 0);
const suiRaw = BigInt(fee.fee_owned_b ?? fee.feeOwedB ?? 0);
if (treeRaw <= 0n || suiRaw <= 0n) throw new Error('The public verification position has no two-sided fees to compound.');

const batch = await sdk.Rewarder.batchCollectRewardsPayload([{
  pool_id: CETUS_TREE_POOL_ID,
  pos_id: POSITION_ID,
  coin_type_a: CETUS_TREE_COIN_TYPE,
  coin_type_b: CETUS_SUI_COIN_TYPE,
  collect_fee: true,
  rewarder_coin_types: [],
}]);
batch.setSenderIfNotSet(OWNER);
const batchResult = await simulate(batch);
if (!succeeded(batchResult)) throw new Error(`Cetus batch claim failed: ${JSON.stringify(batchResult)}`);

const tx = new Transaction();
tx.setSender(OWNER);
const { fee_a: feeA, fee_b: feeB } = sdk.Position.createCollectFeeAndReturnCoinsPayload({
  pool_id: CETUS_TREE_POOL_ID,
  pos_id: POSITION_ID,
  coin_type_a: CETUS_TREE_COIN_TYPE,
  coin_type_b: CETUS_SUI_COIN_TYPE,
}, tx);
const treeFeeCoin = tx.moveCall({
  target: '0x2::coin::from_balance', typeArguments: [CETUS_TREE_COIN_TYPE], arguments: [feeA],
});
const suiFeeCoin = tx.moveCall({
  target: '0x2::coin::from_balance', typeArguments: [CETUS_SUI_COIN_TYPE], arguments: [feeB],
});
const addMode = {
  is_full_range: false,
  min_price: String(cetusPriceFromTick(position.tick_lower_index)),
  max_price: String(cetusPriceFromTick(position.tick_upper_index)),
  coin_decimals_a: 6,
  coin_decimals_b: 9,
  price_base_coin: 'coin_a',
};
let quote = await sdk.Position.calculateAddLiquidityResultWithPrice({
  pool_id: CETUS_TREE_POOL_ID,
  coin_amount: suiRaw.toString(),
  fix_amount_a: false,
  slippage: 0.01,
  refresh_pool_price: true,
  add_mode_params: addMode,
});
let fixAmountA = false;
if (BigInt(quote.coin_amount_limit_a) > treeRaw) {
  const protectedTreeInput = treeRaw * 98n / 100n;
  quote = await sdk.Position.calculateAddLiquidityResultWithPrice({
    pool_id: CETUS_TREE_POOL_ID,
    coin_amount: protectedTreeInput.toString(),
    fix_amount_a: true,
    slippage: 0.01,
    refresh_pool_price: true,
    add_mode_params: addMode,
  });
  fixAmountA = true;
}
if (BigInt(quote.coin_amount_limit_a) > treeRaw || BigInt(quote.coin_amount_limit_b) > suiRaw) {
  console.log(JSON.stringify({ treeRaw: treeRaw.toString(), suiRaw: suiRaw.toString(), fixAmountA, quote }, null, 2));
  throw new Error('The current fee ratio cannot form liquidity inside this range.');
}
await sdk.Position.createAddLiquidityPayload({
  pool_id: CETUS_TREE_POOL_ID,
  pos_id: POSITION_ID,
  coin_type_a: CETUS_TREE_COIN_TYPE,
  coin_type_b: CETUS_SUI_COIN_TYPE,
  tick_lower: quote.tick_lower,
  tick_upper: quote.tick_upper,
  delta_liquidity: quote.liquidity,
  max_amount_a: quote.coin_amount_limit_a,
  max_amount_b: quote.coin_amount_limit_b,
  collect_fee: false,
  rewarder_coin_types: [],
}, tx, treeFeeCoin, suiFeeCoin);
const compoundResult = await simulate(tx);
if (!succeeded(compoundResult)) throw new Error(`Cetus compound failed: ${JSON.stringify(compoundResult)}`);

console.log(JSON.stringify({
  success: true,
  pool: pool.id,
  position: POSITION_ID,
  treeFeesRaw: treeRaw.toString(),
  suiFeesRaw: suiRaw.toString(),
  batchCommandKinds: batch.getData().commands.map((command) => command.$kind),
  compoundCommandKinds: tx.getData().commands.map((command) => command.$kind),
  batchCalls: batch.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.package}::${command.MoveCall.module}::${command.MoveCall.function}`),
  compoundCalls: tx.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.package}::${command.MoveCall.module}::${command.MoveCall.function}`),
  batchObjects: batch.getData().inputs.filter((input) => input.$kind === 'UnresolvedObject').map((input) => input.UnresolvedObject.objectId),
  compoundObjects: tx.getData().inputs.filter((input) => input.$kind === 'UnresolvedObject').map((input) => input.UnresolvedObject.objectId),
}, null, 2));
