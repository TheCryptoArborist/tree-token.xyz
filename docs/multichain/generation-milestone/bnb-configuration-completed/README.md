# BNB configuration complete — November 22, 2026

All four approved BNB configuration calls were independently reconciled at block
135211528. Exact sender, destination, calldata, nonces 4742–4745, chain, successful
receipts, canonical block hashes and wallet fee ceilings match the reviewed plan.
The verifier checks against the recorded review quote and fixed gas limits, not
fee limits supplied in the uploaded receipt. Protocol/runtime identities, explicit
libraries, executor and send/receive security settings match final stage 4.

Actual combined fees: **0.00002372695 BNB**, below **0.0001 BNB**. Do not repeat
these calls. The original adapter/pass deployment receipts also reverified; the
pass is Unconfirmed, generation zero, purchases paused and non-playable. The
completed Sui configuration receipt/current settings reverified. Custody remains
empty and unbound; original NFT identity/ownership remain checked by the Sui
prerequisite service. No NFT deposit or activation occurred.

Evidence: `user-receipt.json`, `verified/verification.json`, `verified/rpc-reads.json`
and `verified/sui-prerequisite.json`. Reproduce with Node 24 and existing root/BNB
dependencies:

```
node --use-env-proxy contracts/bnb-generation/scripts/verify-configuration-receipt.mjs docs/multichain/generation-milestone/bnb-configuration-completed/user-receipt.json /tmp/new-bnb-receipt-verification
```

## Approved final Sui binding

Fresh checked simulation passed, including exact commands, events, effects,
capability ownership and simulation-scoped post-state. Estimated net gas:
**0.009266747 SUI**, against the approved **0.1 SUI** maximum. The simulated vault
remains empty at generation zero with the exact new BNB adapter as peer. This was
simulation only; final binding has not been submitted.

Evidence: `binding-review/`. Reproduce:

```
node --use-env-proxy contracts/nftree-generation/scripts/refresh-binding-review.mjs /tmp/new-binding-review
```

Current MystenLabs/skills README was fetched again at commit
`a384d9a158c4639f075ad3f6644d925108ddfc78`. Applicable ptbs and accessing-data
skills and building/commands/GraphQL references were read. Existing pinned SDK,
GraphQL queries and explicit approved gas ceiling are preserved.

Next: prepare/test/publish the final binding handoff under tree-token.xyz/play/
using the working Slush connection and review-clock protections. Verify fresh BNB
configuration and Sui prerequisites before signing, and verify the actual binding
receipt afterward. This step is already approved; no new approval is required
within its scope and 0.1-SUI ceiling. The recorded simulation is not a signing
handoff. Preserve the complete freshly captured live site during that release.
End-to-end delivery, deposits, sales and gameplay remain later reviewed milestones.

Validation: 22 existing configuration handoff checks passed; fresh full read-only
receipt reconciliation and checked Sui binding/post-state simulation passed.
