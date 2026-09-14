/** Offline unsigned transaction construction for review. No client, signer, execution,
 * simulation, publication, or live UI. Object inventories must later come from a trusted resolver.
 */
import { Transaction } from '@mysten/sui/transactions';
import { check, uint, address, TREE_TYPE, CC_SALES_RECIPIENT } from '../../mainnet-payment.mjs';
import { digest32 } from '../../mainnet-reader.mjs';
import { deploymentConfig } from './codec.mjs';
import { validateQuoteEnvelope } from './quote-authority.mjs';
const U64 = (1n<<64n)-1n;
const SUI = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
function coinRef(c, payer, type) {
  address(c?.objectId); digest32(c.digest);
  check(uint(c.version, U64) > 0n && c.owner === payer && c.coinType === type, 'coin-reference-mismatch');
  check(uint(c.balance, U64) > 0n, 'empty-coin');
  return { objectId: c.objectId, version: c.version, digest: c.digest };
}
export async function buildCheckoutForReview({ terms, deployment, envelope, paymentCoins, gasCoins, gasBudget, gasPrice, maxGasBudget, epoch }, now = Date.now()) {
  const d = deploymentConfig(deployment);
  const proof = validateQuoteEnvelope(terms, d, envelope, now);
  check(Array.isArray(paymentCoins) && paymentCoins.length > 0 && paymentCoins.length <= 32, 'payment-coins-required');
  check(Array.isArray(gasCoins) && gasCoins.length > 0 && gasCoins.length <= 8, 'gas-coins-required');
  const coins = paymentCoins.map(c => coinRef(c, terms.payer, TREE_TYPE));
  const gas = gasCoins.map(c => coinRef(c, terms.payer, SUI));
  const ids = [...coins, ...gas].map(c => c.objectId);
  check(new Set(ids).size === ids.length && !ids.includes(d.checkoutId) && !ids.includes(CLOCK), 'duplicate-or-invalid-input');
  const total = paymentCoins.reduce((n,c) => n+uint(c.balance,U64),0n);
  check(total <= U64 && total >= uint(terms.requiredRaw,U64), 'insufficient-or-overflowing-tree');
  const budget = uint(gasBudget,U64), cap = uint(maxGasBudget,U64), price = uint(gasPrice,U64);
  check(budget > 0n && cap > 0n && budget <= cap && price > 0n, 'explicit-gas-bound-required');
  const gasBalance = gasCoins.reduce((n,c)=>n+uint(c.balance,U64),0n);
  check(gasBalance <= U64 && gasBalance >= budget, 'insufficient-or-overflowing-gas');
  uint(epoch,U64);
  const tx = new Transaction();
  tx.setSender(terms.payer); tx.setGasOwner(terms.payer); tx.setGasPayment(gas);
  tx.setGasBudget(budget); tx.setGasPrice(price); tx.setExpiration({ Epoch: epoch });
  const main = tx.objectRef(coins[0]);
  if (coins.length > 1) tx.mergeCoins(main, coins.slice(1).map(c => tx.objectRef(c)));
  const [payment] = tx.splitCoins(main, [tx.pure.u64(terms.requiredRaw)]);
  tx.moveCall({ target: `${d.packageId}::checkout::pay`, typeArguments: [TREE_TYPE], arguments: [
    tx.sharedObjectRef({ objectId: d.checkoutId, initialSharedVersion: d.initialSharedVersion, mutable: true }),
    payment, tx.pure.vector('u8', proof.bytes), tx.pure.vector('u8', proof.signature),
    tx.sharedObjectRef({ objectId: CLOCK, initialSharedVersion: '1', mutable: false }),
  ] });
  // All inputs, sender and gas are resolved above: do NOT supply a network client.
  const bytes = await tx.build();
  return Object.freeze({ transaction: tx, bytes, payable: false,
    summary: Object.freeze({ network: 'sui:mainnet', recipient: CC_SALES_RECIPIENT,
      payer: terms.payer, coinType: TREE_TYPE, paymentRaw: terms.requiredRaw,
      baseCC: terms.baseCC, bonusCC: terms.bonusCC, totalCC: terms.totalCC,
      maxGasMist: budget.toString(), orderId: terms.orderId, expiresAtMs: terms.expiresAtMs }) });
}
