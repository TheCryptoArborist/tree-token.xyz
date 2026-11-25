# Focused live frontend compatibility check

November 25, 2026 (America/Chicago). Read-only public GETs; no deployment.

**The current BNB TSX candidate is not established as a safe replacement for the
live game.** Its source comes from the native integration branch at 4cd2119a.
The published main entry loads index-review-r18.js. That release was prepared
through a hash-pinned captured-bundle transformation lineage, including later
controls, audio, mobile and holiday changes. Rebuilding the older TSX has not
been shown to reproduce this frontend. The candidate generator now records
frontendReleaseParity:false and an explicit publicationBlocker alongside its
existing deployable:false. No existing live path may be replaced with it.

The focused checker compared 22 HTML/style/module paths against the recorded r18
manifest from b052f377494d238679525c91c47276c0c588fa33. Nineteen matched; three did
not. The entry was stable across the start/end reads. Evidence is in
`frontend-release-observation.json` with observed SHA-1/SHA-256/size per path.

| Path | Finding |
| --- | --- |
| /play/treeforce89/index.html | Loads the expected r18 entry, but has six repeated Arboretum-link inline scripts versus five in the recorded HTML. No cleanup attempted. |
| /play/treeforce89/assets/index-Bw7NF3rR.css | Hash differs from recorded manifest; change not attributed by this focused check. Preserve current bytes. |
| /scripts/treeforce-season-r18.mjs | Current wording adds Christmas emojis before both messages. Preserve the newer wording. |

The r18 entry JavaScript matches the committed release payload. Matching other
static files does not prove TSX source parity, wallet behavior, or live backend
compatibility. The three differences are **release drift**, not asserted defects;
concurrent publications exist and must be preserved.

## Reproduce

```sh
git fetch --no-tags origin b052f377494d238679525c91c47276c0c588fa33
NODE_USE_ENV_PROXY=1 node scripts/multichain/check-native-frontend-release.mjs /tmp/frontend-release.json
node --test tests/multichain-native-frontend-release.test.mjs tests/multichain-native-bnb-entry.test.mjs
```

The network checker exits 1 when files drift; this observed failure is intentional
and the report still saves. Node's proxy option was needed in this cloud runtime;
the first direct Node read returned ECONNREFUSED, while proxy-enabled reads and
curl succeeded. No credentials are needed. Ten offline tests passed for reference
resolution (including literal backtick imports), changed/missing hashes, unstable
entry detection, failed reads and native candidate preservation. CI runs offline
tests only, not live-site checks.

Scope: HTML references and literal local module references under the game and
scripts paths. This is not a complete runtime asset graph, a fresh full Netlify
inventory, or current deploy-identity verification. The recorded r18 deploy ID is
historical context, not a claim about which deploy is currently active.

## Required next work

Reconcile the current frontend lineage before publication: inventory the full
current game dependencies, retain its newer asset bytes, and prove a reproducible
candidate that adds only the reviewed BNB flow. Either recover current source
parity or prepare a separately reviewed preservation overlay; do not blindly
rebuild the older TSX or the historical root site. Capture a fresh full production
inventory/runtime lock immediately before any later authorized release. Actual
wallet testing, trusted production checkpoints, migration/drain, pending-payment
coordination and expired-session recovery remain additional gates. Payments,
gameplay, NFT custody and the unique-artwork requirements are unchanged.
