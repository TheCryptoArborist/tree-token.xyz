# Final Sui binding complete — November 22, 2026

All six approved configuration/binding transactions are complete. The final Sui
transaction is `EkZHu7fFx93QkttEekqXuqHrnQnfS6pNbZLUmeCcVf1a`. Independent direct-chain verification at checkpoint
348240675 (2026-11-23T05:24:32.805Z) confirms exact commands and owned capability
references, successful effects, peer/channel/options events, current security
settings, empty generation-zero bound custody, channel nonce state and retained
admin ownership. Original NFTree #2720 remains owned by the approved dev wallet.
The exact completed BNB receipts and fresh runtime/configuration reads reverified;
the BNB pass remains Unconfirmed, generation zero, purchases paused, canPlay false.

Binding net gas: **0.009266747 SUI**, below its **0.1-SUI** maximum.
Combined Sui configuration plus binding: **0.024218288 SUI**, below the approved
**0.2-SUI** combined cap. The four BNB settings cost **0.00002372695 BNB**, below
**0.0001 BNB** combined. Earlier publication/registration/deployment fees are
separate milestones, not included in those totals. Do not repeat completed steps.

`user-receipt.json` preserves the uploaded receipt. `verified/verification.json`
records freshly checked state; `verified/transaction.json` preserves the independently
fetched transaction, effects and events. Cloud submitted no transaction and made
no website changes while recording this receipt.

## Reproduction

Node 24 with existing root dependencies (`npm ci --ignore-scripts`):

```
node --use-env-proxy contracts/nftree-generation/scripts/verify-binding-receipt.mjs docs/multichain/generation-milestone/binding-completed/user-receipt.json /tmp/new-binding-receipt-verification
node --test tools/generation-binding/*.test.mjs
```

All 35 binding handoff/service/receipt checks passed. Live reconciliation passed
separately from mock-wallet/simulated receipt tests. No dependencies or contracts
were changed for receipt reconciliation.

## Next reviewed milestone

Prepare the end-to-end message-delivery validation plan for the new route,
including the exact transactions, fees, success criteria, failure recovery and
whether any funded backing is required by the lifecycle. Configuration/binding
alone does not prove delivery or authorize a deposit. Keep original NFTree #2720
in the wallet until a separately reviewed deposit milestone; refresh its exact
identity and ownership immediately beforehand. Sales and gameplay remain disabled.
The retired trial vault/pass/route must never be reused.

Use the final binding receipt verifier for current state. Earlier pre-binding
review/preflight helpers intentionally reject a now-bound vault and must not be
used to repeat registration/configuration or undo the completed binding. A future
funded/allocated lifecycle will require a verifier for that new expected state.
Capture a fresh complete live production inventory before any future website
release; preserve current authentication, payments, games, scoring and tournaments.
