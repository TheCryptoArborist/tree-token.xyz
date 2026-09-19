import { Aftermath } from 'aftermath-ts-sdk';
import { TREE_TYPE, normalizeMoveType } from '../netlify/lib/tree-swap-route.ts';

const afSdk = await Aftermath.create({ network: 'MAINNET' });
const poolsApi = afSdk.Pools();
const allPools = await poolsApi.getAllPools();
const treePools = allPools.filter((pool) =>
  Object.keys(pool.pool.coins).some((type) => normalizeMoveType(type) === normalizeMoveType(TREE_TYPE))
);
const poolIds = treePools.map((pool) => pool.pool.objectId);
const stats = poolIds.length ? await poolsApi.getPoolsStats({ poolIds }) : [];

const rows = treePools.map((pool, index) => ({
  poolId: pool.pool.objectId,
  coinTypes: Object.keys(pool.pool.coins),
  coins: Object.fromEntries(Object.entries(pool.pool.coins).map(([type, coin]) => [type, {
    balance: coin.balance.toString(),
    weight: coin.weight,
    tradeFeeIn: coin.tradeFeeIn,
    tradeFeeOut: coin.tradeFeeOut,
    decimalsScalar: coin.decimalsScalar.toString(),
  }])),
  daoFeePercentage: pool.daoFeePercentage(),
  stats: stats[index] ?? null,
}));

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, pools: rows }, null, 2));
