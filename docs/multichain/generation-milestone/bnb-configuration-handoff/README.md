# Approved BNB configuration handoff — steps 2–5 of 6

The user already approved all six configuration/binding transactions. Sui step 1
is complete and independently verified in `../configuration-completed/`.
This handoff presents the four BNB Endpoint calls, with **0.0001 BNB maximum
combined fees**, to MetaMask with Ledger admin ending 8789. No further approval
is needed within this scope and ceiling. Final Sui binding remains step 6.

Canonical signing page: https://tree-token.xyz/play/bnb-configuration/.
No preview-domain signing links. No deployment, token approval, USDT payment,
NFT deposit, sale or gameplay activation. Purchases remain paused.

## Reviewed sequence

1. Explicit send library.
2. Explicit receive library, zero grace period on the new inactive path.
3. Explicit send security (20 BNB confirmations, three required verifiers,
   no optional verifiers) and executor (10,000-byte maximum message size).
4. Explicit receive security (5 Sui confirmations, same three required operators,
   no optional verifiers).

Exact calldata and five stage states are pinned in
`contracts/bnb-generation/browser/configuration-pinned.json`. Nonces start at
4742. Protocol runtime hashes, deployed adapter/pass runtime and immutable
settings, reciprocal binding, admin/delegate and inactive state are checked.
All three selected operators (Horizen, Twinstake and LayerZero Labs) must verify;
one unavailable operator can delay delivery. BNB's stored optional count is 255,
while the effective count is zero. The Sui prerequisite is the exact verified
step-1 receipt plus current explicit settings and empty/unbound custody.

Gas limits are 120,000 / 140,000 / 400,000 / 350,000. Before each signature,
actual verified fees already spent plus the maximum fees for **all remaining
calls** at the fresh quote must fit the 0.0001-BNB cap. Submitted calldata, chain,
sender, destination, nonce, value and wallet fee limits are checked against the
saved request. Receipt blocks are checked against canonical block hashes.
Do not increase fee limits manually in MetaMask.

A pending request is saved before asking the wallet. Rejection can clear it;
uncertain outcomes retain it and prohibit repeats. Recover using the actual hash,
then verify the receipt before proceeding. A cross-tab lock reloads stored state
before signing. Progress can be exported/restored; unexpected on-chain stage,
nonce, runtime or settings fail closed. Public RPC fallback serves reads only;
account access and signing remain in MetaMask/Ledger.

## Validation

42 focused tests passed, covering exact requests/receipts, changed sender,
destination, calldata, nonce, chain, gas and value, aggregate fee overflow,
pending requests, duplicate receipts, wrong Sui state, canonical origin and
complete-site preservation. Eight mock-wallet browser cases passed: connection,
wrong account, rejection, uncertain submission, pending reload, expired review,
read-RPC fallback and off-origin signing prevention. No browser test submitted a
real transaction.

A fresh real-chain read confirmed step 0 and nonce 4742. The browser core then
executed all four calls only in an in-process mainnet fork at block 135209483
(the exact recorded block is authoritative in `review/fork.json`). All receipts,
intermediate states and aggregate fees verified; each call rejected an unauthorized
caller. Total simulated fees: **0.00002372695 BNB**. Fresh public preflight and
mock browser RPC fixtures are `review/preflight.json`; fork proof is
`review/fork.json`. No public RPC write is allowed by the fork's remote transport.

## Setup and reproduction

Node 24; root `npm ci --ignore-scripts`, then
`npm ci --ignore-scripts --prefix contracts/bnb-generation`.

```
node --test contracts/bnb-generation/test/configuration-handoff.test.mjs tests/bnb-configuration-release.test.mjs tests/sti-preview-build.test.mjs contracts/bnb-generation/test/read-rpc.test.mjs
node tools/bnb-configuration/build.mjs
node tools/bnb-configuration/browser-test.mjs
node --use-env-proxy contracts/bnb-generation/scripts/configuration-handoff-review.mjs /tmp/new-bnb-configuration-review
```

The review output directory must be new. Live reads/fork tests require network;
unit/browser tests use captured fixtures. `PLAYWRIGHT_MODULE`, `CHROMIUM` and
`ASSET_ORIGIN` can override browser test paths or select served candidate assets.
The existing Sui configuration receipt service is reused unchanged.

## Preservation and remaining work

Release captures current locked baseline `6b03c2e83a5903c9f492dbf6` (Root Rage
complete free Greenbelt), preserving all existing static hashes, all 56 complete
backend/provider records, five schedules and protected runtime/configuration.
Only two new static paths are added. No backend is uploaded or rebuilt, and the
historical root build is never published. The publisher waits for all queued
builds and rechecks the full locked baseline before switching.

Published and locked as `6b03c667c92f828214793fb9` at 22:53:35 America/Chicago
on November 22, 2026. Totals: 675 static paths, 56 functions, five schedules.
Preparation run 45114093569 and publication run 45114413903 passed 207 checks
each; eight browser cases passed on both candidate and canonical assets.
Canonical JavaScript matches source and the live Sui prerequisite verified.
Evidence: `candidate.json`, `publication.json`, `canonical-check.json` and
`*-browser-tests.json`. Source `a859f39`, publication control `3ab6f8f`.
Then the user signs each BNB call, checks receipts and refreshes the next review.
Independently verify all four final receipts/current states before preparing
already-approved final Sui binding (maximum 0.1 SUI). Deposits, sales and gameplay
remain later separately reviewed milestones. Do not repeat Sui step 1 or any
completed deployment/registration transaction.
