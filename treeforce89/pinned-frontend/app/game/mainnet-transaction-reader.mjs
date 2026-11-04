import { normalizeSuiAddress } from "./tree-payment.mjs";

/**
 * Trusted Sui mainnet transaction lookup adapter.
 * Use ONLY with a server-created SuiGrpcClient configured for mainnet.
 * Does not accept transaction details or network from the browser.
 *
 * Core API returns a tagged union; reject failed/missing/incomplete data.
 * Exact SDK field compatibility must be integration-tested against a known
 * mainnet transaction before enabling the payment endpoint.
 */
export function createMainnetTransactionReader(client) {
  if (!client?.core?.getTransaction) throw new Error("Trusted Sui Core client required");
  if (client.network !== "mainnet") throw new Error("Mainnet Sui client required");

  return async function fetchTransaction(digest) {
    if (typeof digest !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest)) {
      throw new Error("Invalid transaction digest");
    }
    const result = await client.core.getTransaction({
      digest,
      include: { effects: true, balanceChanges: true, transaction: true },
    });
    if (!result || result.$kind !== "Transaction" || !result.Transaction) {
      throw new Error("Transaction unavailable or failed");
    }
    const tx = result.Transaction;
    if (tx.digest !== digest) throw new Error("Digest mismatch");
    if (tx.status?.success !== true || !tx.effects || tx.effects.status?.success !== true) {
      throw new Error("Transaction effects do not confirm success");
    }
    if(typeof tx.checkpoint!=='string' || !/^\d+$/.test(tx.checkpoint) ||
      !Number.isSafeInteger(tx.timestampMs) || tx.timestampMs<=0)
      throw new Error('Transaction has not been checkpointed');
    if (typeof tx.transaction?.sender !== "string") {
      throw new Error("Missing transaction sender");
    }
    if (!Array.isArray(tx.balanceChanges)) {
      throw new Error("Missing transaction balance changes");
    }
    const balanceChanges = tx.balanceChanges.map(change => {
      if (typeof change.coinType !== "string" || typeof change.amount !== "string" ||
        !/^-?\d+$/.test(change.amount) || typeof change.address!=='string') {
        throw new Error("Invalid transaction balance change");
      }
      return {
        coinType:change.coinType,
        amount:change.amount,
        owner:{kind:"AddressOwner",address:normalizeSuiAddress(change.address)},
      };
    });
    return {
      network:"mainnet",
      success:true,
      checkpoint:tx.checkpoint,
      timestampMs:tx.timestampMs,
      sender:normalizeSuiAddress(tx.transaction.sender),
      balanceChanges,
    };
  };
}
