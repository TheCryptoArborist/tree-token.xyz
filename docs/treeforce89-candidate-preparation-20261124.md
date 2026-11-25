# Tree Force ’89 combined candidate preparation

Prepared November 24, 2026 (America/Chicago). Approved visual source: `b5aa5d9`, including r14 wingbeats/banking and r15 localized death effects. This milestone changes packaging and verification only. No gameplay code, dependencies, wallet/payment implementation, backend or production state changed.

## Verified baseline and coordination

Fresh read-only canonical capture found all **23 captured game assets byte-identical** to the original November 23 baseline. The capture covers the statically discovered game dependency closure, not the entire site or every dynamically loaded asset. A second capture after concurrent production publication also matched all 23.

Netlify initially reported ready/locked deploy `6b0638b775657333ab13fdd5`. During preparation another Canopy Defense publication moved production to `6b063a1f450354f992fb35ec`, also ready/locked, with **61 complete backend/provider records and five schedules**. Both observations are saved. These are metadata records, not newly downloaded backend packages. Earlier 359/45 and 667/54 inventory figures are historical and cannot be used for this release.

Read-only inspection fetched current main `f55644c2` and multichain PR #280 head `0deda412f82e20c3e4a86242665c0af148917589`. There are no overlapping changed paths between this Tree Force branch and that multichain branch, relative to their main merge bases. PR #280's repeated-continue/shared-delivery source still explicitly denies live restoration and requires native-runtime/renderer integration. No multichain source was merged or modified. Zero path overlap is not proof of semantic compatibility with a future shared payment cutover. The other PR has its own pending validation; its latest generation-custody workflow was not green at inspection, and this task does not certify it.

## Combined verification

All **13 combined jobs passed against r15**, with 24 focused unit checks plus the separate 8-check identity mixer job, browser audio lifecycle/routing, 30 enemy-feedback checks, boss clearance, combat geometry, round transitions, controls/synthetic continue recovery, multi-touch and wallet/session mocks at 320/390/1280px. Paid checkout and wallet evidence are simulated, with external requests blocked. They are not real wallet or payment acceptance.

The existing 31 recovered-source achievement/chapter/gameplay/paid-client/database checks also passed from `/workspace/treeforce-source`. They remain source-level evidence, not proof of deployed backend package parity. One initial invocation used the wrong working directory and found no tests; the recorded successful run used the documented source directory.

The runner now accepts the target revision and local origin from environment variables, and includes animation/impact unit coverage. Test entry guards accept r15; controls and multi-touch now honor the selected origin so a combined r15 run cannot silently exercise the older r13 server.

## Prepared artifacts

- `/tmp/treeforce-release-overlay-r15-20261124`: **44 hash-checked game overlay files** and an explicit nondeployable overlay plan. Only the existing game entry HTML is intended to be replaced, by precisely checked module/CSS relinking; other payloads are versioned game modules/CSS. Existing-path collisions still require the complete live inventory. No original assets or backend records are deleted. Earlier generated revisions are retained, matching the reviewed overlay lineage.
- `/tmp/treeforce89-phone-r15-20261124`: updated private device kit. Its revision is derived from the reviewed entry HTML rather than hardcoded r13. A 390px Chromium smoke check passed checklist → r15 title canvas with no page errors. This is not a physical phone test. It can run with `node start.mjs 4193` on a trusted local computer; the workspace's localhost/private IP is not a public phone URL.
- [Evidence](treeforce89-candidate-20261124/): suite outcomes, gameplay checks, browser reports, phone-kit still, source reconciliation, fresh game hashes, complete observed function/schedule metadata and overlay plan.

The local overlay packager refuses stale output, mismatched live-game hashes, unexpected entry changes and paths outside `/play/treeforce89/`. Verified happy-path packaging, existing-output rejection and simulated baseline-drift rejection before output. No complete website build or backend rebuild ran.

## Remaining release boundary

**The combined local review build is verified; a complete production candidate is not yet assembled.** The Netlify connector exposes deployment metadata but no complete static-file inventory operation. The workspace has neither Netlify CLI authentication nor `NETLIFY_AUTH_TOKEN`; the unauthenticated files endpoint returns 401. No credential value was requested or printed. Complete protected configuration has not been captured either.

Next: capture a fresh full inventory through the authorized Netlify release connection, preserve every current static path/backend/provider record/schedule/runtime/protected setting, resolve overlay collisions, and create the authenticated review candidate. Coordinate with the other active publications and recheck live ID immediately before any separately authorized production switch. The concurrent deployment observed here makes the old snapshot unsuitable for publication.

The owner still needs phone checks for visibility, dense-scene performance, sound, touch controls and pause/return. Actual Slush return/switching, score saves and native receipt sharing require the authenticated candidate; no real payment is required by this review task. No paid reviewer is needed. Production publication requires separate explicit approval after a concrete complete candidate is available.

## Reproduce

```sh
TREEFORCE_URL=http://127.0.0.1:4192 TREEFORCE_REVISION=r15 node tests/treeforce-local/integrated-review.cjs /workspace/treeforce-candidate-r15-20261124
node scripts/treeforce-local/prepare-release-overlay.mjs release/treeforce-impact-effects /workspace/treeforce-candidate-baseline-20261124 /tmp/new-treeforce-overlay
node scripts/treeforce-local/prepare-device-kit.mjs release/treeforce-impact-effects /tmp/new-treeforce-phone-kit
```

Both preparation commands require fresh output directories. The local r15 server serves the already generated review build. The overlay and phone kit must not be uploaded as a complete production site.
