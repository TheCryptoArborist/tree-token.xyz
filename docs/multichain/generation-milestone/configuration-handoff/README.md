# Approved configuration signing handoff — step 1 of 6

The user replied **“approved”** to the concrete six-transaction review in
`../configuration-review/README.md`: two Sui transactions capped at **0.2 SUI
combined** (0.1 each), four BNB configuration calls capped at **0.0001 BNB
combined**, requiring all three selected verifiers in both directions.
This approval remains valid for the later steps; do not ask for it again unless
scope or fee ceilings change.

This release exposes only step 1: explicit Sui libraries, executor, verification
settings and receiver metadata. Canonical page:
https://tree-token.xyz/play/generation-configuration/.
The dev account ending 45c4 signs in desktop Slush. Cloud has no signing keys.
The page caps this transaction at 0.1 SUI and performs no binding or deposit.
After independently verifying this receipt, prepare the four MetaMask/Ledger BNB
calls using the existing approval, then final Sui binding only after both sides'
configuration receipts and current state match. Sales/gameplay remain disabled.

## Verification and preservation

The GET-only new service rechecks the real registration, empty unbound custody,
original identity/ownership and completed inactive BNB deployment. It simulates
exact bytes with checks enabled and verifies effects, events and simulation-scoped
post-state. The browser independently validates the exact transaction kind,
simulation bytes, capability references, state, chain, expiry and wallet signature.
The review uses server time plus a monotonic clock. A digest is persisted before
submission; pending status and a cross-tab lock prevent accidental repeats.

Receipt verification checks successful exact execution, all four current app
settings, receiver metadata, custody and BNB inactivity. A page reload after a
submission exposes receipt checking instead of another signing attempt.
The existing returned-account Slush connection helper is reused unchanged.

The preservation release captures locked baseline `6b03bf7710cd526cae89e2ef`
(Root Rage complete free Greenbelt), retaining every existing static hash, all
55 complete backend/provider records, five schedules and protected configuration.
It adds two new files and one isolated read-only function. Existing backends and
the historical root build are never published. The exact-source preview supplies
metadata for the added function only; the production publisher waits for every
queued build, then rechecks the current baseline before switching and locking.

## Setup

Node 24; `npm ci --ignore-scripts` at repository root. No SDK upgrade.

```
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-configuration/*.test.mjs tests/generation-configuration-release.test.mjs tests/sti-preview-build.test.mjs
node tools/generation-configuration/build.mjs
node tools/generation-configuration/browser-test.mjs
```

Browser tests require Playwright and Chromium; `PLAYWRIGHT_MODULE` and `CHROMIUM`
can override their Cloud paths. `ASSET_ORIGIN` fetches candidate/canonical assets
while wallet mocks use the canonical location. No real transaction is submitted
by these tests. Fresh read/simulation evidence is `simulation.json`; saved bytes
are historical, not a reusable signing packet.

## Remaining work

Complete preserving release, candidate/canonical checks and publication evidence.
The user then signs step 1 and returns its verified receipt. Persist that actual
receipt before advancing. The remaining five transactions are already approved,
but depend on verified prior state and fresh fee quotes. NFT deposits, public
sales and gameplay activation are not approved by this configuration milestone.
