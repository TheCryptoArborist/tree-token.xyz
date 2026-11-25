# Reconciled focused frontend observations

November 25, 2026 (America/Chicago). Read-only; no live modification.

All 22 inspected paths are now accounted for without changing any served bytes:

- Twenty match the recorded r18 manifest. The earlier CSS drift flag was a checker
  error: the requested filename contains uppercase characters, while the manifest
  lowercases its path. Both canonical and historical-deploy CSS hash to SHA-1
  `664e14fb9c90d772eaa3d9dcd756d7a8321b6ea7`, the recorded manifest value.
- The seasonal module matches the committed festive-emoji release at
  ade51f373946afa4a3c16811b54de15fec99e368 exactly (SHA-256
  `2490af1986b844c77df6038a4702ee9a9cdc0ef5936908bd5ded9a724f418265`).
  Its publication record documents only two message-string changes.
- Canonical HTML matches the bytes served from the historical r18 deploy URL
  exactly (SHA-256 `eaadf252dc080c456606350403bb529224d1183a59394fd8fec87e18a3e0538d`).
  Both have six repeated Arboretum-link scripts, while the committed payload has
  five. This is served-byte evidence, not proof of where/when that transformation
  happened. No script cleanup or normalization was attempted.

`frontend-reconciliation.json` records hashes, classification and the stable
start/end entry check. The original observation is retained and annotated with
this correction. The checker now resolves only unique case-insensitive manifest
matches; missing paths or collisions stop the audit. Known newer bytes and
historical HTML are classified only with exact hashes and expected paths.

## What this establishes—and what remains

This resolves the three focused static differences. It does **not** establish that
the older native TSX rebuild reproduces r18, verify current backend identity,
verify a full production inventory, or authorize a publication. The BNB candidate
continues to report frontendReleaseParity:false and deployable:false. Current
controls, audio, mobile, holiday, authentication and payment behavior must be
preserved. No game or NFT code was altered by this reconciliation.

The next integration decision must use this reconciled release lineage: either
recover/build current native frontend source to exact parity, or design and review
an additive overlay that leaves these bytes intact and establishes an explicit
session/wallet interface. The current old-source candidate must not replace the
live game. Existing pending-payment, trusted-checkpoint, migration/drain and real
wallet test gates also remain. No payment, gameplay or NFT movement was enabled.

## Reproduce

```sh
git fetch --no-tags origin b052f377494d238679525c91c47276c0c588fa33
git fetch --no-tags origin ade51f373946afa4a3c16811b54de15fec99e368
NODE_USE_ENV_PROXY=1 node scripts/multichain/reconcile-native-frontend-release.mjs /tmp/frontend-reconciliation.json
node --test tests/multichain-native-frontend-release.test.mjs tests/multichain-native-bnb-entry.test.mjs
```

The direct r18 checker still reports the two byte differences; the reconciliation
command explains them using the exact documented/served evidence. Twelve offline
tests passed, including case-only paths, ambiguous collisions, wrong hashes,
wrong-path proof reuse and network failure. CI remains offline. Historical deploy
URLs are read-only evidence endpoints; wallet review must use tree-token.xyz/play.
