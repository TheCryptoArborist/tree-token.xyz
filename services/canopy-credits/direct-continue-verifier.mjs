import { validateFixedContinueTerms } from './continue-product.mjs';
import { verifyFromReader } from './mainnet-payment.mjs';
/** Reader must be the configured real gRPC adapter with exact checkout BCS codec. */
export function directContinueVerifier(reader) {
  return async (terms, digest) => {
    validateFixedContinueTerms(terms);
    const transaction = await reader.getFinalizedTransaction(digest);
    const receipts = transaction.events.filter(e => e.type === terms.eventType && e.fields?.orderId === terms.orderId);
    if (receipts.length !== 1) throw Error('continue-receipt-not-unique');
    const evidence = await verifyFromReader(terms, digest, receipts[0].index, {
      getNetworkIdentity: () => reader.getNetworkIdentity(), getFinalizedTransaction: async () => transaction,
    });
    if (evidence.checkoutId !== terms.checkoutId || evidence.keyEpoch !== terms.keyEpoch) throw Error('wrong-continue-deployment');
    return evidence;
  };
}
