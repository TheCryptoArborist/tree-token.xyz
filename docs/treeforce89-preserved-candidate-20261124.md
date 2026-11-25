# Task 2 complete: preserved r15 review candidate

Prepared November 24, 2026 (America/Chicago). This is a complete **digest-based candidate**, with the reviewed upload bytes staged locally. It has not been hosted or published. It is not a directory suitable for a standalone static-site upload.

## Inventory

| Item | Candidate |
| --- | ---: |
| Baseline static paths | 693 |
| Unchanged existing paths | 692 |
| Replaced existing paths | 1 |
| Added versioned game paths | 43 |
| Total candidate paths | 736 |
| Preserved complete backend/provider records | 61 |
| Preserved schedules | 5 |

The only replaced path is `/play/treeforce89/index.html`. All new paths are versioned modules/CSS below `/play/treeforce89/`. No shared Arcade asset, redirect, backend, schedule, wallet/payment source, price, access rule or tournament feature is changed. All baseline paths are retained. Earlier generated review modules are retained in the 44-file payload to match the approved overlay lineage.

Baseline: `6b063e9462762ae02c0fd5db`. A fresh hosted capture and independent read-back on [audit run 45529494565, attempt 2](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45529494565/attempts/2) matched task one's complete inventory, backend records, schedules, runtime and protected configuration. Its 31 guards passed. Masked secret bytes and deploy-specific overrides remain API limitations, as recorded by task one.

The latest inspected multichain head is `d0022bd12cdbdd35778cd892c18c1ccace0ed8bf`. Its new browser-restoration/native-payment work is still source-only and gated; the branch reports no live activation. Changed-path intersection with this Tree Force branch remains empty. No merge was performed, and future shared payment integration still needs its own semantic reconciliation.

## Stored bytes versus delivered HTML

Strict comparison found that Netlify adds one known Arboretum snippet on delivery. The captured served page has six copies; the actual stored original contains five. Removing only the last exact known insertion reproduces the inventory SHA1 `9e3e62b941dda078910a846e36353588ea7cfd21`. The candidate changes module/CSS references in those verified stored bytes and preserves all five historical stored copies. It does not save a sixth copy and cause a seventh on delivery. The existing shared snippet setting is unchanged.

The inventory also represents the existing mixed-case stylesheet URL as `/play/treeforce89/assets/index-bw7nf3rr.css`. Its exact captured bytes match that inventory SHA1. Case-folded lookup is used only to verify this existing path; unexpected overlay collisions are rejected case-insensitively. No stylesheet is renamed or replaced.

With the existing delivery insertion applied, the candidate entry is byte-identical to the approved r15 review entry. Every JavaScript and CSS payload is byte-identical to the reviewed overlay. These are packaging corrections, not new game changes.

## Verification

- Seven new assembly tests passed: full preservation, exact one-snippet normalization, stored CSS lookup, path collisions, extra/missing/changed/out-of-scope payloads, unknown HTML mutations and incomplete backend rejection.
- All 44 staged payload hashes were checked after writing; candidate digest-map and preserved backend/configuration objects match the baseline exactly except the approved static changes.
- Ten synthetic wallet/session checks passed at 390px against the actual staged entry: mount/lazy-module isolation, fresh run, interruption/expiry recovery, save retry, wallet change/leaderboard and receipt sharing. No page errors. The guide screenshot was inspected.
- Prior r15 combined verification (13 jobs and 31 recovered-source checks) remains applicable: game module bytes are unchanged. It was not needlessly rebuilt or rerun in full.

These browser checks intercept authentication/services. They do not establish real Slush, production saves, real payments or physical-phone acceptance.

## Review artifacts

- [Candidate manifest](treeforce89-preserved-candidate-20261124/candidate.json)
- [Preservation checks](treeforce89-preserved-candidate-20261124/preservation-checks.json)
- [Assembly tests](treeforce89-preserved-candidate-20261124/assembly-tests.txt)
- [Browser checks](treeforce89-preserved-candidate-20261124/treeforce89-browser-checks-390.json)
- [Actual candidate guide](treeforce89-preserved-candidate-20261124/treeforce89-candidate-guide-390.png)

Local package: `/workspace/treeforce-preserved-candidate-r15-20261124/`; archive: `/workspace/treeforce-preserved-candidate-r15-20261124.tar.gz`. The archive digest is retained alongside the report. Candidate canonical SHA256: `5ecdc1d0c5edd204ac15a3ea87a63e88554a3fb4963aa68476551628410b8df4`.

The package holds the complete digest map and backend/configuration records plus only the changed upload bytes. A future preservation-aware preview step must reuse all unchanged baseline digests and backend records. Do not use ordinary directory deployment against `payload/` or the package root. No publishing tool is included in this task.

## Next task

Create the hosted review preview, verify its complete preserved inventory and exact served files, then provide a working phone link. Recheck production/configuration and multichain changes first because other chats remain active. Owner phone review and separate explicit production approval remain outstanding. No website/backend rebuild, production publication or payment occurred in task two.

Reproduction uses `scripts/treeforce-local/prepare-preserved-candidate.mjs` with the task-one baseline, approved r15 review JSON, captured original game bytes, validated overlay directory and a fresh output directory. The original overlay and source hashes are checked before writing.
