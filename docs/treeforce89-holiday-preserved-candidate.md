# Fresh holiday preservation candidate

Prepared locally against published deploy `6b06574ec5470d0f6ad7ea82`. Production remained on that ID at the final read. No website deployment, payment, backend build or publication occurred.

## Fresh inventory

Read-only GitHub audit [45542453033](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45542453033) passed all 31 drift guards, capture and independent read-back. Audit-only commit `a94ca6ea987fd782801b50180018119f828f6e13` was pushed on the isolated audit branch with `[skip netlify]`; the holiday implementation was not pushed. This uses GitHub Actions, not a Netlify site build.

Snapshot: 737 static paths, all 61 full function/provider records, five schedules, runtime and API-visible configuration. Secret bytes masked by the API and deploy-specific overrides remain outside verification. Sanitized evidence and fingerprint are in `treeforce89-holiday-inventory/`.

## Candidate

`release/treeforce-holiday-preserved/candidate.json` contains the full preserved digest map and complete original backend/configuration snapshot. All 737 current paths retain their hashes. Forty-three reviewed modules are reused byte-for-byte. Seven r16 modules plus `/play/treeforce89/review/holiday/index.html` are added, giving 745 paths. No existing path is replaced, including the main game and earlier review page. The proposed holiday route is **not live**.

The 23 original game assets still match the recorded source baseline and current stored production hashes. The review entry was derived from the current stored canonical review page with exact delivery-snippet normalization, keeping its existing scripts and changing only the module link and title. All candidate payloads and the plan have hashes. The packaged preview-clock override remains removed.

The local browser fixture needed two already-published assets absent from the old local capture: `retro-achievements.css` and `assets/powerups/dex-reward-token.jpeg`. Both were fetched from the pinned deploy and checked against its stored hashes; neither is new production payload. The nested review smoke checks the actual r16 entry, NFTree gate, three lives, unchanged 20,000 TREE copy, noindex and missing-asset/page errors. It does not connect a wallet or pay.

## Concurrent integration

PR #280 advanced to `5a0efcd400e6bf4942462648b3e4f1889b9077c7`: native host assembly and canonical checkout transport. Its `netlify-gateway/host.md` explicitly states source-only, no deployment, actual native bundle integration pending, and real checkout UI not exercised together. No shared host, route, SDK or wallet code was copied into the holiday candidate. Preserve the previous full-mount theme-continuity caveat until that actual integration is chosen. The current captured backend records have not changed from the earlier canonical review baseline.

## Next step

The candidate is ready for a separately authorized additive canonical-domain review publication, after one final current-ID/configuration/build-queue check. It is not authorized to replace the main game. Reuse this package and publish once for owner phone review rather than creating repeated Netlify previews. Physical-phone holiday readability/performance remains for the owner.
