# Authenticated BNB checkout boundary

November 24, 2026 (America/Chicago). Source-only; no route is deployed.

The host now optionally accepts a trusted `readBnbPayment` reader and assembles
the native v2 BNB coordinator using the same runtime/database identity proof,
NFT ownership reader and reviewed checkpoint provider as the native session
bridge. Omitting the reader leaves BNB checkout unavailable.

Three proposed POST actions under `/play/treeforce89/api/` are handled by the
existing authenticated gateway:

| Action suffix | Exact JSON fields |
| --- | --- |
| shared-continue-bnb-challenge | payer (lowercase BNB address) |
| shared-continue-bnb-open | id, suiSignature, bnbSignature |
| shared-continue-bnb-reconcile | id, txHash |

All require the native bearer, same canonical origin, JSON and exact fields.
Account/run identity and payment terms come from trusted services. Both canonical
hostnames pass origin validation; the internal coordinator uses its existing
canonical identity `https://tree-token.xyz`. Requests cannot select that identity.
The signature envelope is bounded to 8 KiB, with a 6,000-character Sui signature
limit and a 65-byte EVM signature. Other bodies retain the 2 KiB limit. These are
input limits, not a claim that every wallet/signature scheme was exercised.

Responses allowlist each action's fields, strip credentials/checkpoints, and
force paymentEnabled, restoreAuthorized, continueAuthorized and gameplayAuthorized
false. No failure instructs repayment. The gateway keeps its existing default
legacy mode and requires fresh trusted drain/pause evidence before shared mode.
Ordinary native game/auth routes still delegate to the preserved handler.
The browser transport exposes these actions with no automatic retry, cookie,
redirect, signing or send operation and rejects a response after session changes.

## Validation and reproduction

Run the following using the existing setup documented in `native-bnb-checkout.md`:

```sh
node --test tests/multichain-native-gateway.test.mjs tests/multichain-native-composition.test.mjs tests/multichain-native-host.test.mjs tests/multichain-restore-http.test.mjs tests/multichain-shared-checkout.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-native-sui-session-postgres.mjs
node scripts/multichain/check-native-sui-session-postgres.mjs
```

The native database scenario now goes through the full host and HTTP adapters
for real disposable-key wallet signatures and synthetic receipt verification.
It checks denied admission, replay, reconciliation after entitlement loss and
idempotent receipt import without advancing the native continue counter.
Boundary tests reject identity/amount injection, malformed fields, wrong origins,
missing credentials, oversized signatures and provider error leakage. Results:
86 unit tests, 43 Netlify-mode database checks (including bundled checkout and
Phaser), and 39 restricted-role database checks passed. Machine-readable evidence
is in `bnb-http-tests.json`.

## Remaining before publication

Mount the explicit wallet-link/review UI on the canonical origin, integrate its
pending-payment journal and cross-payment coordination, and test actual wallet
and RPC flows. Supply the trusted checkpoint source, resolve expired-session BNB
reconciliation, review migration and legacy-writer drain, and capture a fresh
production inventory before any publication. No live payment or gameplay enablement
is included here. Individual original NFT identity, unique artwork and one-to-one
custody requirements remain separate launch gates.
