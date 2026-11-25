# Native checkout entry candidate

November 25, 2026 (America/Chicago). Offline source candidate only.

The BNB branch and current remote main do not contain the native Treeforce source
tree. The inspected source is on feature/treeforce89-play-integration at
4cd2119a3fefc3b6078befd01ad4f63fb74a695a. Its ContinuationReview.tsx is byte-identical
to the previously audited bf453722 native payment entry. Concurrent release and
game-development branches were inspected read-only; none were reset or edited.
This source observation does not establish current published frontend parity.

`prepare-native-bnb-entry.mjs` generates a fresh candidate directory containing
that real native checkout entry plus the five BNB browser modules it imports.
The existing checkout implementation is retained byte-for-byte except its function
name and the additional import. The default exported wrapper invokes the native
component for all existing callers. Only an explicit host-supplied `bnbReview`
option selects the separate BNB review component. Its effect mounts the assembled
controls and destroys them on unmount/options change; closing delegates to the
existing caller. The BNB branch never invokes native offer/payment/restoration
callbacks. No existing caller is switched to it in this milestone.

```sh
git fetch --no-tags origin 4cd2119a3fefc3b6078befd01ad4f63fb74a695a
node scripts/multichain/prepare-native-bnb-entry.mjs /tmp/tree-bnb-entry-candidate
node --test tests/multichain-native-bnb-entry.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-native-bnb-mount-browser.mjs
```

The output directory must not already exist. The generator reads the pinned
commit, not a live deployment, and emits provenance.json with source and candidate
hashes. It never applies files to a checkout or deploys them. `patchNativeEntry`
requires the exact source hash and rejects altered input. Before integrating into
a current game checkout, compare its actual file against the pinned hash; if it
changed, rebase and review the patch rather than overwrite that work. The candidate
is deliberately incomplete as a standalone build and is marked deployable:false.

Validation passed: five source/compiled-entry tests and six assembled Chromium
regression checks. Tests prove native default prop forwarding, explicit opt-in,
effect cleanup, unchanged original payment implementation, changed-source refusal,
and no output-directory overwrite. TSX compiles with the pinned esbuild dependency.
Browser evidence still uses wallet/server fixtures; no actual extension tested.
Results: `bnb-native-entry-tests.json`.

Remaining: integrate the opt-in prop with the current game's selected-provider
and session lifecycle, verify full current source-to-release parity, and test real
wallet extensions under the canonical origin after a separately reviewed release.
Pending-payment coordination, expired-session recovery, trusted checkpoint source,
schema/drain review and production preservation remain gates before payments.
Nothing was published or enabled; Sui payments, games, scores and tournament
behavior are unchanged. Individual NFT artwork and one-to-one custody requirements
remain in force.
