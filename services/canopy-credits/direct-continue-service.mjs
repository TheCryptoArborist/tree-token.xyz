import { createFixedContinueTerms, publicContinueOrder, validateFixedContinueTerms, commitment } from './continue-product.mjs';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const assert = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
/** Server orchestration. No HTTP route/keys configured and no CC ledger writes.
 * repository.transact must durably serialize each account/run. Tests may inject fixtures.
 * resolveFlight must use authenticated server state, never blindly trust a POSTed score/lives.
 */
export function createDirectContinueService({ repository, resolveFlight, loadConfiguration, authorizeQuote, verifyPayment, now = Date.now }) {
  return async (actor, command) => {
    assert(actor?.authenticated === true && actor.wallet?.family === 'sui' && uuid(actor.accountId), 'sui-sign-in-required');
    const config = await loadConfiguration();
    if (command?.action === 'status') return { enabled: config.paymentsEnabled === true };
    const fields = { order: [], reconcile: ['orderId', 'digest'], deliver: ['orderId', 'receiptId'], cancel: ['orderId'] };
    assert(Object.hasOwn(fields, command?.action) && Object.keys(command).every(k => ['action', 'requestId', 'runId', ...fields[command.action]].includes(k)), 'invalid-command');
    assert(uuid(command.runId) && uuid(command.requestId), 'invalid-request');
    return repository.transact(actor.accountId, command.runId, async record => {
      if (record) {
        validateFixedContinueTerms(record.terms);
        assert(record.terms.accountId === actor.accountId && record.terms.runId === command.runId && record.terms.payer === actor.wallet.address, 'wrong-flight-owner');
      }
      if (command.action === 'order') {
        assert(config.paymentsEnabled === true, 'checkout-not-enabled');
        if (!record) {
          const flight = await resolveFlight(actor, command.runId);
          const terms = createFixedContinueTerms({ actor, flight, deployment: config.deployment, metadata: config.metadata, now: now() });
          record = { terms, state: 'ordered', envelope: null, evidence: null, receiptId: null };
          // Persist in the transaction before signing; commit before returning the quote.
          await repository.save(record);
        }
        assert(record.state === 'ordered', 'purchase-already-started');
        assert(now() <= record.terms.expiresAtMs, 'quote-expired');
        if (!record.envelope) { record.envelope = await authorizeQuote(record.terms, config.deployment); await repository.save(record); }
        return { status: 'ordered', order: publicContinueOrder(record.terms, record.envelope, true) };
      }
      assert(uuid(command.orderId) && record && record.terms.orderId === command.orderId, 'order-not-found');
      if (command.action === 'cancel') {
        // Cancellation does NOT erase the order; an already signed transaction can settle later.
        if (record.state === 'ordered') { record.state = 'cancelled'; await repository.save(record); }
        return { status: record.state };
      }
      if (command.action === 'reconcile') {
        // Reconciliation and delivery remain available while new purchases are paused.
        if (!record.evidence && command.digest) {
          const evidence = await verifyPayment(record.terms, command.digest, config.deployment);
          assert(evidence?.source === 'chain-reader' && evidence.status === 'success' && evidence.finalized === true,
            'unverified-payment');
          assert(evidence.digest === command.digest && /^(0|[1-9][0-9]*)$/.test(evidence.eventIndex || ''), 'receipt-digest-mismatch');
          for (const [field, expected] of Object.entries({ orderId: record.terms.orderId, accountId: actor.accountId,
            payer: record.terms.payer, recipient: record.terms.recipient, coinType: record.terms.coinType,
            amountRaw: record.terms.requiredRaw, quoteHash: record.terms.quoteHash, checkoutId: record.terms.checkoutId,
            keyEpoch: record.terms.keyEpoch, network: record.terms.network })) assert(evidence[field] === expected, 'receipt-order-mismatch');
          const { evidenceHash, ...receipt } = evidence;
          assert(evidenceHash === commitment(receipt), 'receipt-evidence-mismatch');
          record.receiptId = `${evidence.network}:${evidence.digest}:${evidence.eventIndex}`;
          await repository.claimReceipt(record.receiptId, record.terms.orderId);
          record.evidence = evidence; record.state = 'verified'; await repository.save(record);
        }
        return { status: record.state === 'verified' || record.state === 'delivered' ? record.state : 'pending',
          order: publicContinueOrder(record.terms, record.envelope, false),
          authorization: record.evidence ? { orderId: record.terms.orderId, runId: command.runId, lives: 3, receiptId: record.receiptId } : null };
      }
      assert(record.evidence && ['verified', 'delivered'].includes(record.state) && command.receiptId === record.receiptId, 'payment-not-verified');
      if (record.state !== 'delivered') { record.state = 'delivered'; await repository.save(record); }
      return { status: 'delivered', orderId: record.terms.orderId, runId: command.runId };
    });
  };
}
