/** Server-only direct-continue receipt adapter. No database, signer, HTTP route,
 * environment loading, or transaction submission. Importing this file enables
 * nothing. An operator must supply the actual reviewed deployment first.
 */
import { connectMainnetReader } from '../client.mjs';
import { createCheckoutReceiptCodec, deploymentConfig } from './codec.mjs';
import { directContinueVerifier } from '../../direct-continue-verifier.mjs';
import { DIRECT_CONTINUE, validateFixedContinueTerms } from '../../continue-product.mjs';
import { digest32 } from '../../mainnet-reader.mjs';

const requireThat = (ok, code) => {
  if (!ok) throw Object.assign(new Error(code), { code });
};
const deploymentKeys = ['network', 'packageId', 'checkoutId', 'initialSharedVersion', 'keyEpoch', 'quotePublicKey'];

export function createDirectReceiptReader({ deployment, connect = connectMainnetReader } = {}) {
  const checked = deploymentConfig(deployment);
  const pinned = Object.freeze(Object.fromEntries(deploymentKeys.map(key => [key, checked[key]])));
  requireThat(typeof connect === 'function', 'reader-connector-required');
  const codec = createCheckoutReceiptCodec(pinned);
  const reader = connect({ decodeReceipt: codec });
  for (const method of ['getNetworkIdentity', 'getTreeMetadata', 'getFinalizedTransaction']) {
    requireThat(typeof reader?.[method] === 'function', 'incomplete-direct-reader');
  }
  const verify = directContinueVerifier(reader);

  function termsSnapshot(input) {
    // Copy BEFORE the first await. A caller changing its order object while the
    // node request is pending must not change which purchase is being verified.
    const terms = structuredClone(input);
    validateFixedContinueTerms(terms);
    requireThat(terms.checkoutPackage === pinned.packageId && terms.checkoutId === pinned.checkoutId,
      'direct-reader-deployment-mismatch');
    // Prior signing epochs remain settleable after a key rotation. The receipt
    // and saved order must still agree on the exact epoch in the core verifier.
    requireThat(BigInt(terms.keyEpoch) <= BigInt(pinned.keyEpoch), 'direct-reader-future-key-epoch');
    return Object.freeze(terms);
  }

  return Object.freeze({
    async verifyPayment(input, digest, configuredDeployment) {
      const terms = termsSnapshot(input);
      digest32(digest);
      if (configuredDeployment !== undefined) {
        deploymentConfig(configuredDeployment);
        requireThat(deploymentKeys.every(key => configuredDeployment[key] === pinned[key]),
          'direct-reader-runtime-config-changed');
      }
      // The connected reader checks checkpoint inclusion and decodes exact BCS;
      // the verifier then checks payer, recipient, amount and net TREE effects.
      // Its output is evidence only: it never issues credits or restores lives.
      return verify(terms, digest);
    },
    async inspect() {
      const identity = await reader.getNetworkIdentity();
      const metadata = await reader.getTreeMetadata();
      requireThat(identity?.network === DIRECT_CONTINUE.network &&
        identity.chainIdentifier === DIRECT_CONTINUE.chainIdentifier, 'wrong-direct-reader-network');
      requireThat(metadata?.coinType === DIRECT_CONTINUE.coinType &&
        metadata.decimals === DIRECT_CONTINUE.decimals, 'wrong-direct-reader-metadata');
      return Object.freeze({ network: identity.network, chainIdentifier: identity.chainIdentifier,
        coinType: metadata.coinType, decimals: metadata.decimals, requiredRaw: DIRECT_CONTINUE.requiredRaw,
        packageId: pinned.packageId, checkoutId: pinned.checkoutId,
        receiptDecoderConfigured: true, paymentsEnabled: false, restoreAuthorized: false });
    },
  });
}
