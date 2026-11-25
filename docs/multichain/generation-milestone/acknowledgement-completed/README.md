# Acknowledgement delivered and BNB pass burned — November 23, 2026

The user's single approved Sui acknowledgement and actual BNB delivery verify.
**Do not resend.**

- Sui source: `ENfwF1vVK1ozuYgVZcyr422UZTjnzUEk7f3iQeGDGEeh`.
- GUID: `0x08156a875c94a547e7bdb2cb5e5720e26d97795abf35a82499cfc7b116b78341`.
- BNB burn transaction: `0x938da761ac35a1635edc0568c04bebbf0e94eea288c0374797de17ca92cf8c7c`.
- Actual source fee **0.094851295 SUI**, net gas **0.005041162 SUI**;
  total **0.099892457 SUI**, within approved 0.2 SUI.

Original NFTree #2720 remains owned by Sui dev 45c4. The new vault is empty at
phase 2/generation 1 with ack_sent true. BNB is **Retired, generation 1, purchases
paused, canPlay false**. Token 1's ownerOf returns the exact
ERC721NonexistentToken(1) error, and the original buyer has zero pass balance.
The completion message has not been sent (BNB outbound nonce remains 1).
Generation 1 remains allocated on Sui until the final kind-4 completion arrives.

## Independent evidence

`user-receipt.json` preserves the user-provided source receipt. `sui-verification.json`
and `sui-transaction.json` reconcile exact commands, native fees/payees/balances,
acknowledgement packet and permitted effects against the approved source verifier.
`nft-owner.json` confirms exact original object/type/number and dev ownership.
The historical `estimatedTotalMist` receipt field equals the actual message fee
plus net gas computed from successful execution, not a new estimate.

`bnb-reads.json` records read-only canonical RPC responses. The verifier checks
current code/security, controller/adapter/route/peer/treasury binding, exact
redemption/recipient, delivered GUID payload hash, Retired/paused/nonplayable state,
zero buyer balance, nonexistent token and no completion send. It independently
verifies the successful canonical receipt and block hash, Transfer of token 1
from buyer to zero, RedemptionFinalized for the exact request, MessageApplied for
kind 3/generation 1, and endpoint PacketDelivered for Sui sender/new adapter/nonce 2.
The receipt hash is pinned after its initial GUID-filtered log discovery, so later
reverification does not depend on a moving lookback window. Only the current
first-generation lifecycle is supported; later states intentionally stop it.

Run from the pinned Node 24 Cloud checkout:

```sh
node --use-env-proxy docs/multichain/generation-milestone/acknowledgement-completed/verify.mjs
node --test contracts/nftree-generation/scripts/verify-acknowledgement-bnb.test.mjs tools/generation-acknowledgement/receipt.test.mjs
```

All **14 focused tests passed**: exact burn acceptance; failed/removed/missing
receipt events; nonzero burn recipient, wrong token/request/GUID/kind; missing
endpoint delivery; source receipt acceptance without claiming a burn; wrong source
digest, forbidden NFT effect; and service rejection of writes/unknown parameters.
The Sui checks reuse the previously reviewed pinned GraphQL implementation. Current
Mysten skills README was refreshed; applicable data-access/GraphQL guidance was
already read in this conversation. No SDK migration, signature or transaction
submission is performed by the verification scripts.

## Remaining milestone

Prepare a fresh BNB `send(4)` completion quote and simulation for separate fee
approval. After its delivery, verify the Sui Completed event and phase 3 before
considering any new generation. No completion transaction, new deposit, public
sale, security change or gameplay activation is authorized by this receipt.
This evidence update does not deploy a website or contract. Preserve the complete
then-current production baseline for any later signing handoff.
