# Tree Force ’89: remaining release tasks

Work one task at a time. The operation is the owner plus this assistant: no hired reviewer, outside team or paid service is required. The owner will perform the short phone review when a usable link is available.

## Current position

The planned gameplay/audio/presentation improvements are implemented on PR #306. The latest pushed game-code commit is `150749f`; its 13 local verification jobs passed. Subsequent r14 animation and r15 impact polish are local review changes awaiting the next batched integration milestone. Its GitHub production-snapshot job and Netlify deploy-preview status subsequently passed. The generic Netlify preview does not include the corrected game and must not be presented as the phone-review build.

We are at validation and release preparation, not the start of another feature cycle. An exact release date or percentage would be misleading before the visual comparison, phone observations and full preservation candidate are complete. No production publication or real payment is authorized.

| Order | Task | Completion condition | Status |
| --- | --- | --- | --- |
| 1 | Corrected private phone preview | Owner-authenticated HTTP link opens the exact corrected game from a phone | Game running on port 4189; HTTP portal configuration pending |
| 2 | Graphics comparison with supplied Deluxe Galaga | Compare enemy motion/poses, silhouettes, projectiles/effects, background contrast, HUD and transitions at playing size; address only demonstrated gaps in a bounded visual patch | Comparison, r14 enemy animation and r15 impact effects complete locally; phone readability review remains |
| 3 | Complete preserved release candidate | Capture current full site/backend/schedule inventory; integrate only reviewed Tree Force changes; verify preserved bytes/configuration and authenticated candidate behavior | Combined r15 checks and local overlay complete; fresh full-site inventory/configuration capture still required; no production switch |
| 4 | Short owner phone review | Practice: controls, sound, visibility and pause/return. Authenticated candidate: Slush expiry/return, wallet switching, saves and existing receipt sharing. Record outcomes and fix only reproduced defects | Queued; no real-payment requirement |
| 5 | Final approval and release | Present exact candidate, test results and known limitations; publish only after separate explicit owner approval, then verify production and inventory | Not authorized yet |

## Task 1 prepared

The corrected private practice kit at `/tmp/treeforce89-phone-review-20261124-final` matches all latest generated overlay hashes. It runs with `node start.mjs 4189`, listens on `0.0.0.0:4189`, and serves its checklist at `/`. This reuses the existing game; no site rebuild was performed. A focused Chromium smoke check covers checklist → title → gameplay and mobile toolbar presence.

The environment currently exposes SSH only. For an authenticated phone-accessible URL, the owner must open **Edit Environment → HTTP Previews**, add **4189**, and choose **Apply to this chat**. After that change, refresh environment status, restart the server if necessary, verify the app, and provide the exact returned HTTP URL. Do not invent a URL or give the cloud machine's localhost/private IP as a phone-accessible link.

This private preview is unranked practice. It supports visual/audio/touch assessment, but it does not authenticate Slush, save scores, perform payments or validate native saved-receipt sharing. Those checks belong to the authenticated candidate in tasks 3–4. Production NFTree access remains unchanged.

## Graphics assessment

The supplied archive is Edgar Vigdal's **Deluxe Galaga v2.6 (Amiga, 1995)**, not the original Namco arcade ROM. The existing extracted-asset analysis and observed emulator captures remain the benchmark; its documented full animation inventory was not all observed in play.

The retained reference combat capture shows small bright enemies and shots against a largely black starfield. The reviewed Tree Force capture has a richer forest setting and distinctive Arborwing, with improved contrast, wing poses and path-facing motion. Richer detail alone does not establish equivalent arcade readability. The forest still has more competing detail, and two wing poses do not demonstrate the same range of observed banking/body animation. Visual parity is therefore **not yet established**. The completed [comparison and corrected capture](treeforce89-graphics-comparison-20261124.md) identifies internal enemy animation as the next bounded polish task; impact identity follows separately.

Task 2 compares readable motion and feedback, not merely pixel count. Preserve Tree Hero/Arborwing and the forest identity; use original artwork and existing mechanics. Do not add a shop, new weapon rules, extra levels or broad redesign just to match the reference's feature inventory. Original evidence: `/workspace/galaga-analysis/README.md` and `screenshots/`; current evidence: `docs/treeforce89-integrated-20261123/` and the corrected candidate.

## Efficiency rules

- Reuse the captured baseline, installed dependencies and generated assets; do not rebuild the whole website per task.
- Change only the relevant Tree Force helper/overlay or review artifact. Run focused checks first; rerun the combined game suite when cross-cutting behavior changes or at the final candidate milestone.
- Perform a complete site/backend preservation comparison when assembling the release candidate, and recheck drift immediately before any authorized release. Unchanged backend functions should be preserved, not rebuilt.
- Existing GitHub/Netlify PR automation can run repository-wide builds on each push. Batch pushes at meaningful milestones instead of pushing planning notes or every small edit. Do not weaken required checks to hide failures.
- Stop once a task's completion condition is met. New work requires a demonstrated defect or a specifically chosen visual gap.

This planning update is kept local until the next substantive PR milestone so it does not trigger another whole-site CI/preview build by itself.

## Coordination with separate multichain work

Continue presentation and controls independently. Before task 3 integrates anything, inspect the Sui/BNB Arcade PR/branch and reconcile shared wallet, payment, identity and receipt paths. Do not overwrite that work or certify its behavior based on the current Sui-only mocks.

## Completed enemy-animation polish

The [r14 animation candidate](treeforce89-enemy-animation-20261124.md) adds six wing poses and curve-based banking while preserving all 81 sampled movement/body measurements. Eight unit tests, three browser widths and all 30 enemy-feedback checks passed. The review includes an actual before/after motion clip. The subsequent [r15 impact-effects pass](treeforce89-impact-effects-20261124.md) is complete locally. Three focused unit tests, emitted-game parity for three enemy families, all 30 enemy-feedback checks and particle pause/cleanup checks passed. Phone and multichain integration checks are still open.

## Combined r15 preparation

The [candidate preparation report](treeforce89-candidate-preparation-20261124.md) records 13 passing combined jobs, 31 source checks, an updated r15 phone kit, 44 verified overlay files, and current multichain coordination. All 23 captured live-game assets remain unchanged. Production moved during this task; full current static inventory and protected configuration are still required before a complete release candidate can be assembled. The local kit is now r15; the older port-4189 kit described above remains historical until explicitly replaced.
