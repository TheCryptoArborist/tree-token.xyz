# Hosted Arborwing firing correction

The owner approved correction `a7c1dca` and requested the next step: update the existing canonical graphics review, preserving the main game. Review: https://tree-token.xyz/play/treeforce89/review/arborwing/ .

Fresh read-only audit [46057383579](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/46057383579) verified baseline `6b0799296da7108e51b1778b`, 828 static paths, 62 full backend records and five schedules. The r22 candidate changes the review HTML and adds three cycle-linked game modules plus the mount helper; artwork and all other files are reused. Expected result: 832 static paths, 827 prior paths byte-identical, one review entry changed. The main-game entry is unchanged.

38 preservation/source guards passed. Source comparison proves the only engine behavior changes are the reviewed glider mount coordinates and foreground projectile drawing depth. Wallet/API code is identical after module-name normalization. The earlier 50-case firing test verified counts, speed, damage, piercing and hitbox sizes; initial projectile paths intentionally change with the launch points.

Packaged browser checks at 390×844 and 1440×900 passed: actual mount method resolves all five new glider anchors, NFTree/wallet gate remains, expected canvas buffers, thirteen badges and no page errors/overflow. Browser automation blocks writes and makes no payment/signature. The release workflow repeats these checks against the exact candidate before publication and the canonical URL afterward, preserving complete backend/runtime and protected configuration.

This is a review update, not a main-game release. Owner assessment of firing appearance and device smoothness remains necessary.

## Published and independently verified

Wing correction deploy `6b09db5ff59cecb223b2e431` was published and locked by [46057630195](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/46057630195). Candidate browser checks and complete post-publication inventory/content checks passed. Its final canonical browser step failed while waiting for network idle, leaving the original attempt's `state.json` at its pre-publication `published:false` marker; that marker is stale, not a rollback or current status.

Read-only follow-up exposed a `networkidle` navigation timeout. The checker now waits for DOM content, the wallet gate and all game textures. A subsequent strict deployment-ID check stopped when the separate Canopy Defense routing review became current. No rollback or extra Netlify deployment was performed by this task.

Final read-only [verification 46058436723](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/46058436723) passed against current ready/locked deploy `6b09dc4244e51c6a022fdcdb` at 2026-11-27T19:41:52Z. All five wing payload hashes, main-game entry, 62 backend records, five schedules, runtime and protected configuration matched. The subsequent Canopy release changed only `/_redirects` relative to our 832-path result. Both 390px and 1440px canonical browser checks passed with the corrected mounts and no page errors. Evidence: `verified/state.json` and `verified/canonical-browser.json`. The 827-preserved/one-changed/four-added counts describe the wing patch relative to its original baseline; the subsequent redirect change is listed separately.

The same review URL now serves the corrected r22 firing origins. One Netlify deployment was created for this correction; follow-up runs were read-only. Physical-device feel and the owner's newly reported hero-proportion concern remain separate review matters; see `treeforce89-hero-proportion-followup.md`.
