/**
 * Pure, side-effect-free validation helpers for TREE continuation checkout.
 * Not a complete verifier: the trusted server MUST fetch transaction data
 * itself, confirm the actual recipient transfer, and atomically redeem digest.
 */
export const TREE_COIN_TYPE = "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";
export const TREE_CONTINUE_PRICE = 20_000n;
export const TREE_PAYMENT_RECIPIENT = "0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f";

export function normalizeSuiAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error("Invalid Sui address");
  }
  return "0x" + value.slice(2).toLowerCase().padStart(64, "0");
}

export function treeBaseUnits(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Unverified TREE coin decimals");
  }
  return TREE_CONTINUE_PRICE * (10n ** BigInt(decimals));
}

export function validateContinuationClaim(claim, expected) {
  if (!claim || !expected) throw new Error("Missing payment claim");
  if (expected.network !== "mainnet") throw new Error("Mainnet required");
  if (typeof claim.digest !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(claim.digest)) {
    throw new Error("Invalid transaction digest");
  }
  if (claim.runId !== expected.runId) throw new Error("Wrong run");
  if (normalizeSuiAddress(claim.wallet) !== normalizeSuiAddress(expected.wallet)) throw new Error("Wrong wallet");
  if (!expected.gameOver || expected.cleared) throw new Error("Run not eligible");
  return { digest: claim.digest, wallet: normalizeSuiAddress(claim.wallet), runId: claim.runId };
}

/**
 * This verifies a *subset* of server-fetched facts; it is NOT sufficient
 * to authorize continuation without transaction command inspection and
 * durable, atomic one-time redemption.
 */
export function validateObservedPayment(observed, expected) {
  if (!observed || observed.network !== "mainnet" || observed.success !== true) throw new Error("Transaction not confirmed");
  if (normalizeSuiAddress(observed.sender) !== normalizeSuiAddress(expected.wallet)) throw new Error("Wrong sender");
  if (observed.coinType !== TREE_COIN_TYPE) throw new Error("Wrong coin type");
  if (normalizeSuiAddress(observed.recipient) !== normalizeSuiAddress(TREE_PAYMENT_RECIPIENT)) throw new Error("Wrong recipient");
  if (BigInt(observed.amount) < treeBaseUnits(expected.decimals)) throw new Error("Insufficient TREE payment");
  return true;
}
