import type { Pool } from 'aftermath-ts-sdk';
import { coinKey, type SimulationPool } from './tree-route-simulation.ts';

const FIXED_ONE = 10n ** 18n;
type HealthCoin = { balance: unknown; weight: unknown; tradeFeeIn: unknown; tradeFeeOut: unknown; decimalsScalar: unknown };
export function aftermathStateError(coins: Record<string, HealthCoin>, daoFeePercentage?: number): string | undefined {
  try {
    const entries = Object.entries(coins);
    if (entries.length < 2 || new Set(entries.map(([type]) => coinKey(type))).size !== entries.length) return 'invalid-coins';
    let weightSum = 0n;
    for (const [,coin] of entries) {
      const integer = (value: unknown) => {
        if (!/^\d+$/.test(String(value ?? ''))) throw new Error();
        return BigInt(String(value));
      };
      if (integer(coin.balance) <= 0n || integer(coin.decimalsScalar) <= 0n) return 'empty-or-invalid-reserves';
      const weight = integer(coin.weight);
      if (weight <= 0n || weight >= FIXED_ONE) return 'invalid-weight';
      weightSum += weight;
      if (integer(coin.tradeFeeIn) >= FIXED_ONE || integer(coin.tradeFeeOut) >= FIXED_ONE) return 'invalid-fee';
    }
    // SDK serialization can round fixed-point weights by a few units at 1e18.
    if (weightSum < FIXED_ONE - 1024n || weightSum > FIXED_ONE + 1024n) return 'invalid-weight-sum';
    if (daoFeePercentage !== undefined && (!Number.isFinite(daoFeePercentage) || daoFeePercentage < 0 || daoFeePercentage >= 1)) return 'invalid-dao-fee';
  } catch { return 'malformed-state'; }
  return undefined;
}

export function aftermathSimulationPool(pool: Pool, verifiedAt: string): SimulationPool {
  let stateError = aftermathStateError(pool.pool.coins, pool.daoFeePercentage());
  if (typeof pool.pool.flatness !== 'bigint' || pool.pool.flatness < 0n || pool.pool.flatness > FIXED_ONE) stateError = 'invalid-flatness';
  for (const coin of Object.values(pool.pool.coins)) {
    if (typeof coin.balance !== 'bigint' || typeof coin.decimalsScalar !== 'bigint' || coin.normalizedBalance !== coin.balance * coin.decimalsScalar) stateError = 'invalid-normalized-balance';
  }
  return {
    venue: 'aftermath', poolId: pool.pool.objectId, coinTypes: Object.keys(pool.pool.coins),
    reserves: Object.fromEntries(Object.entries(pool.pool.coins).map(([type,coin]) => [type, String(coin.balance)])),
    verifiedAt, stateError,
    // Official weighted/stable math applies protocol, DAO and trade fees and
    // enforces the SDK's input/output reserve-ratio bounds. Do not approximate
    // these heterogeneous pools using constant-product formulas.
    quote: (coinInType, coinOutType, coinInAmount) => pool.getTradeAmountOut({ coinInType, coinOutType, coinInAmount }),
  };
}
