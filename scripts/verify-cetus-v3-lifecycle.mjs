import { CetusClmmSDK } from '@cetusprotocol/sui-clmm-sdk';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  CETUS_TREE_POOL_ID, CETUS_TREE_COIN_TYPE, CETUS_SUI_COIN_TYPE,
  cetusPriceFromTick, validateCetusTreePool, validateCetusIncreaseTransaction,
  validateCetusCollectTransaction, validateCetusRemoveTransaction, validateCetusCloseTransaction,
  extractCetusIncreaseSimulation, extractCetusFeeSimulation, extractCetusRemoveSimulation,
  extractCetusCloseSimulation, minimumAfterCetusSlippage,
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

const pool = validateCetusTreePool(await sdk.Pool.getPool(CETUS_TREE_POOL_ID, true));
const position = await sdk.Position.getPositionById(POSITION_ID, false);
if (position.owner.toLowerCase() !== OWNER || position.pool !== CETUS_TREE_POOL_ID) throw new Error('Public Cetus verification position changed ownership or pool.');

const suiRaw = 1_000_000n;
const addMode = {
  is_full_range: false,
  min_price: String(cetusPriceFromTick(position.tick_lower_index)),
  max_price: String(cetusPriceFromTick(position.tick_upper_index)),
  coin_decimals_a: 6,
  coin_decimals_b: 9,
  price_base_coin: 'coin_a',
};
const quote = await sdk.Position.calculateAddLiquidityResultWithPrice({
  pool_id: CETUS_TREE_POOL_ID, coin_amount: suiRaw.toString(), fix_amount_a: false,
  slippage: 0.01, refresh_pool_price: true, add_mode_params: addMode,
});
const maxTreeRaw = BigInt(quote.coin_amount_limit_a);
const increase = await sdk.Position.createAddLiquidityFixTokenPayload({
  pool_id: CETUS_TREE_POOL_ID, pos_id: POSITION_ID,
  coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
  tick_lower: Number(position.tick_lower_index), tick_upper: Number(position.tick_upper_index),
  fix_amount_a: false, amount_a: quote.coin_amount_limit_a, amount_b: suiRaw.toString(),
  slippage: 0, is_open: false, collect_fee: false, rewarder_coin_types: [],
});
increase.setSenderIfNotSet(OWNER);
validateCetusIncreaseTransaction(increase, { owner: OWNER, positionId: POSITION_ID, maxTreeRaw, exactSuiRaw: suiRaw });
const increaseResult = extractCetusIncreaseSimulation(await simulate(increase), { positionId: POSITION_ID, maxTreeRaw, exactSuiRaw: suiRaw });

const collect = await sdk.Position.collectFeePayload({
  pool_id: CETUS_TREE_POOL_ID, pos_id: POSITION_ID,
  coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
});
collect.setSenderIfNotSet(OWNER);
validateCetusCollectTransaction(collect, { owner: OWNER, positionId: POSITION_ID });
const collectResult = extractCetusFeeSimulation(await simulate(collect), POSITION_ID);

async function protectedRemoval(close) {
  const liquidityRaw = close ? BigInt(position.liquidity) : BigInt(position.liquidity) / 100n;
  const make = async (minTreeRaw, minSuiRaw) => {
    const params = {
      pool_id: CETUS_TREE_POOL_ID, pos_id: POSITION_ID,
      coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
      delta_liquidity: liquidityRaw.toString(), min_amount_a: minTreeRaw.toString(), min_amount_b: minSuiRaw.toString(),
      collect_fee: true, rewarder_coin_types: [],
    };
    const tx = close ? await sdk.Position.closePositionPayload(params) : await sdk.Position.removeLiquidityPayload(params);
    tx.setSenderIfNotSet(OWNER);
    (close ? validateCetusCloseTransaction : validateCetusRemoveTransaction)(tx, { owner: OWNER, positionId: POSITION_ID });
    return tx;
  };
  const first = close
    ? extractCetusCloseSimulation(await simulate(await make(0n, 0n)), { positionId: POSITION_ID, expectedLiquidityRaw: liquidityRaw })
    : extractCetusRemoveSimulation(await simulate(await make(0n, 0n)), { positionId: POSITION_ID, expectedLiquidityRaw: liquidityRaw });
  const minTreeRaw = minimumAfterCetusSlippage(first.treeRaw);
  const minSuiRaw = minimumAfterCetusSlippage(first.suiRaw);
  const tx = await make(minTreeRaw, minSuiRaw);
  const result = await simulate(tx);
  return close
    ? extractCetusCloseSimulation(result, { positionId: POSITION_ID, expectedLiquidityRaw: liquidityRaw, minTreeRaw, minSuiRaw })
    : extractCetusRemoveSimulation(result, { positionId: POSITION_ID, expectedLiquidityRaw: liquidityRaw, minTreeRaw, minSuiRaw });
}

const removeResult = await protectedRemoval(false);
const closeResult = await protectedRemoval(true);
console.log(JSON.stringify({
  classification: 'CETUS_TREE_V3_FULL_LIFECYCLE_SIMULATION_VALID',
  pool: pool.id,
  position: POSITION_ID,
  increaseTreeRaw: increaseResult.treeRaw.toString(),
  increaseSuiRaw: increaseResult.suiRaw.toString(),
  claimTreeRaw: collectResult.treeRaw.toString(),
  claimSuiRaw: collectResult.suiRaw.toString(),
  removeTreeRaw: removeResult.treeRaw.toString(),
  removeSuiRaw: removeResult.suiRaw.toString(),
  closeTreeRaw: closeResult.treeRaw.toString(),
  closeSuiRaw: closeResult.suiRaw.toString(),
  signed: false,
  submitted: false,
}, null, 2));
