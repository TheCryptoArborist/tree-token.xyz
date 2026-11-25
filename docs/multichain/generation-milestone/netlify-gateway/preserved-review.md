# Isolated r19 preservation candidate

November 25, 2026 (America/Chicago). Offline generation only; no publication.

While this work was running, Tree Force moved from r18 to the published r19 pilot
cabinet release. The previous baseline guard refused output immediately. The new
recorded release is 64060196606bd8636c498c1cd6dc5c6c318d75a8, documented deploy
6b0750990d056f6dd28623fd. Its leaderboard, medals and desktop presentation are
retained. `preserved-review-baseline.json` records 25 observed static paths,
including a dynamically loaded stylesheet found during the browser check. This
is still not a full site/runtime/media inventory or current deploy lock proof.

`prepare-preserved-bnb-review.mjs` reads those exact canonical bytes, verifies every
hash twice, and creates a fresh output directory only after capture succeeds.
Captured evidence stays separate from candidate output. Existing live paths are
never overwritten. The candidate uses `/play/treeforce89/review/bnb-preserved/`
as its proposed isolated route; this URL is **not published**.

The candidate preserves the current game modules instead of rebuilding the older
TSX. The r19 entry receives one imported checkout wrapper and one uniquely matched
function rename/wrapper. Tests reverse this edit and recover every original entry
byte. The entry's exports, gameplay code and original payment component remain
intact. Relative game modules are copied byte-for-byte under the isolated assets
prefix so they continue referring to that candidate entry, while absolute shared
scripts/styles retain their original URLs. HTML changes only its entry-script URL.
The captured root HTML, CSS, holiday scripts and shared files remain immutable
comparison inputs, not replacement source or a deployable root snapshot.

`preserved-bnb-checkout.mjs` defaults to the native component without reading
payment storage. Its compiled wrapper hardcodes enabled:false; no query or local
storage flag can enable it. Even when explicitly enabled in a later reviewed
candidate, pending Sui payments select native recovery. The isolated React review
component uses existing wallet/session adapters and cleans up on close/session
changes. It has no transaction send or gameplay-restoration control.

## Evidence

- Twelve offline tests passed: entry byte preservation, duplicate anchor/drift
  refusal, syntax, default/pending-native selection, no partial output, plus audit
  checks.
- Three captured-candidate browser checks passed: original/copy hashes and matching
  native wallet gates at 390px and 1000px, with no BNB activation or browser errors.
- The read-only leaderboard request was answered by a local empty fixture. Image
  and font requests outside the focused snapshot were stubbed. This is not a full
  gameplay, artwork, leaderboard-data or actual extension comparison.
- Real Slush/MetaMask/Ledger interactions, paid restoration and live APIs were not
  exercised. No chain, game or backend mutation occurred.

`preserved-review-tests.json` retains generation provenance and browser results.
The generated workspace candidate is disposable; Git retains the generator,
pinned release inputs, manifest and tests. Future canonical drift intentionally
blocks regeneration until reviewed and repinned. Do not regenerate from a stale
snapshot and treat it as current release permission.

## Reproduce

```sh
git fetch --no-tags origin 64060196606bd8636c498c1cd6dc5c6c318d75a8
NODE_USE_ENV_PROXY=1 node scripts/multichain/prepare-preserved-bnb-review.mjs /tmp/new-bnb-preserved-candidate
node --test tests/multichain-preserved-bnb-review.test.mjs tests/multichain-native-frontend-release.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-preserved-bnb-browser.mjs /tmp/new-bnb-preserved-candidate
```

Use the existing pinned esbuild/Playwright setup. CI runs the offline tests;
live capture and candidate browser comparison are separate explicit commands.

## Authenticated regression follow-up

See [session regression](preserved-session-regression.md) for seven passing local
browser checks, including pending native recovery and the current paused-run
expiry behavior. This extends the wallet-gate checks without claiming full game
or real-wallet coverage.

## Review lifecycle follow-up

See [preserved-runtime review lifecycle](preserved-review-lifecycle.md) for nine
local browser checks covering complete review and interrupted signing. Enablement
exists only in intercepted test responses; the candidate remains disabled.

## Remaining gates

Prove current game behavior and the opt-in review lifecycle in the preserved
runtime with a representative authenticated native session, then actual wallet
extensions on a separately reviewed canonical publication. Capture a full fresh
production inventory and lock before any later release. Backend/database migration,
trusted checkpoint evidence, legacy-writer drain, cross-payment coordination and
expired-session recovery remain required before payment activation. The old TSX
candidate still has no live rebuild parity; this preservation candidate avoids
using that rebuild. Both remain non-deployable pending broader review. Unique
artwork, individual original custody and one global allocation per NFT are unchanged.
