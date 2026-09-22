export const STI = '0x054e8315e419c9768faf889e36a0a12c90287e14669903f20f92f0ce9a8013c2::sti::STI';
export const SUI = '0x2::sui::SUI';
export const TREE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const POOL = '0xc9fb86078a0e88c31cee675386047edcb29b5a1f5ebe6358a968f1f816e9caa4';
export const CONFIG = '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f';
export const INTEGRATE = '0xae9c208cf58fd5ba36737c9ee5dcfa7f152d0fb5a5a99eebb7c881ebc2fe59e0';
export const FEED = 'https://sti-keeper-production.up.railway.app/badge';
export const GAS_BUDGET = 50_000_000n;
export const GAS_RESERVE = 100_000_000n;
export const QUOTE_TTL = 30_000;
export const SLIPPAGE_BPS = 100n;
const U64_MAX = (1n << 64n) - 1n;
const Q128 = 1n << 128n;
export const normalize = s => '0x' + String(s).replace(/^0x/, '').toLowerCase().padStart(64, '0');
export function parseSui(value) {
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(text)) throw new Error('Enter a SUI amount with up to 9 decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const raw = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
  if (raw <= 0n || raw > U64_MAX) throw new Error('Enter a positive SUI amount within the supported range.');
  return raw;
}
export function units(raw, decimals = 9) {
  const n = BigInt(raw), scale = 10n ** BigInt(decimals);
  const fraction = (n % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (n / scale).toString() + (fraction ? '.' + fraction : '');
}
export function validatePool(pool) {
  if (pool?.id !== POOL || pool.coin_type_a !== STI || pool.coin_type_b !== SUI || String(pool.fee_rate) !== '2500') throw new Error('The verified STI/SUI pool identity or fee has changed.');
  if (pool.pool_status?.disable_swap !== false || BigInt(pool.liquidity || 0) <= 0n) throw new Error('The STI pool is not available for trading.');
  return pool;
}
export function makeQuote(pool, response, amount, startedAt = Date.now()) {
  validatePool(pool);
  amount = BigInt(amount);
  if (amount <= 0n || amount > U64_MAX || response?.pool_address !== POOL || response.a2b !== false || response.by_amount_in !== true || response.is_exceed !== false || BigInt(response.amount || 0) !== amount || BigInt(response.estimated_amount_in || 0) !== amount) throw new Error('The pool could not quote the full requested amount.');
  const out = BigInt(response.estimated_amount_out || 0);
  if (out <= 0n || out > U64_MAX) throw new Error('No STI output is available.');
  const sqrt = BigInt(pool.current_sqrt_price);
  const spotOut = amount * Q128 / (sqrt * sqrt);
  if (spotOut <= 0n) throw new Error('The pool price is unavailable.');
  const impactBps = out >= spotOut ? 0n : ((spotOut - out) * 10000n + spotOut - 1n) / spotOut;
  if (impactBps > 300n) throw new Error('Price impact exceeds 3%. Try a smaller amount.');
  const minOut = out * (10000n - SLIPPAGE_BPS) / 10000n;
  if (minOut <= 0n) throw new Error('This amount is too small.');
  return Object.freeze({pool:POOL, amount, out, minOut, impactBps, fee:BigInt(response.estimated_fee_amount || 0), at:startedAt});
}
export function validateQuote(quote, amount, now = Date.now()) {
  if (!quote || quote.pool !== POOL || quote.amount !== BigInt(amount) || now < quote.at || now - quote.at >= QUOTE_TTL) throw new Error('Quote expired or changed. Get a new quote.');
  if (quote.out <= 0n || quote.minOut !== quote.out * (10000n - SLIPPAGE_BPS) / 10000n || quote.minOut <= 0n || quote.impactBps < 0n || quote.impactBps > 300n) throw new Error('Invalid purchase protection.');
  return quote;
}
export function requireBalance(raw, amount) {
  if (BigInt(raw) < BigInt(amount) + GAS_RESERVE) throw new Error('Insufficient SUI. Keep 0.1 SUI available for gas.');
}
export function buildPurchase(Transaction, owner, quote, now = Date.now()) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(owner)) throw new Error('Connect a valid Sui wallet.');
  validateQuote(quote, quote.amount, now);
  const tx = new Transaction();
  tx.setSender(owner);
  tx.setGasBudget(GAS_BUDGET);
  const emptySti = tx.moveCall({target:'0x2::coin::zero',typeArguments:[STI]});
  const [sui] = tx.splitCoins(tx.gas, [tx.pure.u64(quote.amount)]);
  // The verified Cetus entry point transfers resulting coins to the transaction sender.
  tx.moveCall({target:`${INTEGRATE}::pool_script_v2::swap_b2a`,typeArguments:[STI,SUI],arguments:[
    tx.object(CONFIG),tx.object(POOL),emptySti,sui,tx.pure.bool(true),
    tx.pure.u64(quote.amount),tx.pure.u64(quote.minOut),
    tx.pure.u128(79_226_673_515_401_279_992_447_579_055n),tx.object('0x6'),
  ]});
  return tx;
}
export function checkSimulation(result, owner, quote) {
  const transaction = result?.Transaction;
  if (transaction?.effects?.status?.success !== true) throw new Error('Purchase simulation failed. No wallet approval was requested.');
  const changes = transaction.balanceChanges;
  if (!Array.isArray(changes)) throw new Error('Could not verify purchase balance changes.');
  let received = 0n, spent = 0n;
  for (const change of changes) {
    if (normalize(change.address) !== normalize(owner)) continue;
    const amount = BigInt(change.amount);
    if (change.coinType === STI) received += amount;
    else if (change.coinType === SUI || change.coinType === `${normalize('0x2')}::sui::SUI`) spent -= amount;
    else if (amount < 0n) throw new Error('Simulation would spend an unexpected asset.');
  }
  if (received < quote.minOut || spent > quote.amount + GAS_BUDGET || spent < quote.amount - GAS_BUDGET) throw new Error('Simulation does not match the reviewed purchase.');
  return {received,spent};
}
export function parseFeed(data, now = Date.now()) {
  if (!Number.isSafeInteger(data?.at) || data.at > now + 60_000 || now - data.at > 5 * 60_000 || !Array.isArray(data.coins)) throw new Error('STI data is unavailable or out of date.');
  const coin = data.coins.find(c => c.type === TREE);
  if (!coin || coin.retiring) return {member:false, at:data.at};
  const share = coin.share;
  if (coin.decimals !== 6 || !/^[0-9]+$/.test(coin.held) || !Number.isFinite(share) || share < 0 || share > 1 || !Number.isSafeInteger(data.holders) || data.holders < 0) throw new Error('STI returned invalid index data.');
  return {member:true,at:data.at,share,held:coin.held,holders:data.holders,since:coin.since===null?null:(Number.isSafeInteger(coin.since)&&coin.since>0&&coin.since<=now?coin.since:undefined)};
}
