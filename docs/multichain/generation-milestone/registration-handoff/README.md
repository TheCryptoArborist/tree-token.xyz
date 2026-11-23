# Approved Sui registration handoff

The user approved one registration transaction: “I approve the registration
transaction. Please proceed.” Maximum gas is 0.02 SUI. The desktop Slush dev
account ending 45c4 signs at https://tree-token.xyz/play/generation-registration/.
Cloud holds no signing key. This creates the new package's LayerZero messaging
channel and registration entry only. Peer/security configuration, NFT deposit,
sales and gameplay activation remain separate reviewed milestones.

The existing Sui package, empty slot and all three completed BNB transactions
must not be repeated. See ../path-review/README.md and ../bnb-deployed/README.md.
The live registration channel must come from the verified signed receipt; the
channel in simulation.json is not a deployed object.

## Validation and setup

Use Node 24 and `npm ci --ignore-scripts` at repository root. No SDK upgrades.

```
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-publication/core.test.mjs tools/generation-slot/*.test.mjs tools/generation-registration/*.test.mjs tests/generation-registration-release.test.mjs tests/sti-preview-build.test.mjs
node tools/generation-registration/build.mjs
node tools/generation-registration/browser-test.mjs
```

133 automated checks passed in the combined validation run. Eight browser
scenarios passed using mocked wallet responses with zero chain submissions:
returned-account getter lag, wallet rejection, wrong account, expired review,
desktop clock skew, changed signed bytes, pending receipt recovery and an
unapproved origin. These do not establish real Slush acceptance. The fresh
checks-enabled simulation and frontend byte review passed with estimated net
gas 0.004668124 SUI. The maximum remains 0.02 SUI. BNB runtime and receipts were
independently rechecked; purchases remain paused and gameplay disabled.

The GET-only service independently checks chain state, exact transaction shape,
protected custody/capabilities and BNB inactivity. The browser verifies exact
simulated bytes and signature before submission, and saves the digest before
broadcast. A pending receipt blocks a second submission. Review age uses server
time plus a monotonic clock rather than the desktop wall clock.

## Preservation release

`scripts/release-generation-registration.mjs` captures the entire locked live
baseline 6b03b6a483cce56f74fa4bfc, preserving every existing static hash, all 54
complete backend/provider records, five schedules and protected configuration.
It adds only two page files and one isolated read-only function. The exact-source
preview provides metadata for that new function; no existing function is rebuilt.
The preparation commit intentionally permits a preview build. The publication
workflow waits for every queued Git build to terminate, then rechecks the locked
baseline before switching. The historical root build is never published.

## Remaining work

Published and locked deployment `6b03b87be261d7f909354675` at
2026-11-22 21:54:50 America/Chicago. All eight browser scenarios passed against
served candidate and canonical assets; canonical JavaScript matches source. Fresh
canonical simulation passed at 0.004668124 SUI. Both release jobs passed 153 tests.
Final inventory: 671 paths, 55 functions, five schedules. Preparation run
45108444152; publication run 45108631810. See publication.json.

The initial preparation correctly stopped when another mobile story release
changed the baseline; no candidate was created from that stale baseline. The
replacement captured the newer locked site. GitHub retains complete inventory
artifacts; local download was blocked by the Cloud proxy, so independent backend
comparison used Netlify records and the release job verified every static hash.
The user then connects desktop Slush, refreshes the registration review, signs the
single transaction and returns the receipt. Independently verify that receipt and
record the actual messaging channel before reviewing any peer/security changes.
