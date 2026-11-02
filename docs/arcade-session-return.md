# Arcade session restoration and TREE FORCE participation

## Published release

Deploy `6ae806bda0c2f59d35109a6e` was published and locked on **2026-11-02 at 03:45:42.146 UTC**, replacing `6ae7f8a9183c770b8f0eb50c`. The canonical lobby is https://tree-token.xyz/play/. Candidate and canonical browser checks both passed, and both hosted participation probes returned HTTP 401 `invalid-game-session` through the real database authentication path.

The application source is `81b463838a2ed3c5c388be14c1935a80c221c73d`. Exact archive recovery is recorded in `00e9d0e0f7968751559c6f9458d5bdd1b3384afa`, the asynchronous retry procedure in `ef2fe8edd269600379c4160750553262ada8f5c3`, and the final reviewed publication procedure in `27b42110ecbe95e8b3e20444b5a283f8077a96af`. See the [release receipt](../production/arcade-session-return-release.json) and [verification summary](arcade-session-return-verification.json).

## Reproduced causes and frontend repair

The reported journey was Daily Growth sign-in → TREE FORCE ’89 → Back to Arcade, followed by a signed-out lobby and no quest credit. Two independent failures were found.

The daily-task link opened TREE FORCE in a new tab with `noopener`, while the lobby bearer intentionally lives in tab-specific `sessionStorage`. The game's Back to Arcade link then loaded a lobby in the new tab without the original authorization. The original lobby could remain signed in. Separate restoration gaps affected a provider that registered late and a renewed session whose provider ID had been lost. Returning to an existing lobby also displayed a refresh prompt without fetching saved progress.

The controller now:

- Opens the TREE FORCE daily-task link in the same tab. External Garden links retain their existing new-tab behavior.
- Performs one guarded silent restore when the exact saved provider registers late. Sign-out, expiry, disconnect, account changes, and obsolete responses cannot revive invalidated authorization.
- Retains the actual provider ID through restoration and explicit renewal. A legacy name-only session is eligible only when the provider name is unique and its account matches.
- Refreshes verified progress when returning from a launched eligible game or cabinet. Focus, visibility, and persisted-page events consume one launch marker before synchronization, preventing duplicate requests and retry loops.

Only `/scripts/arcade-daily-growth.js` changed in the public static inventory. The HTML, CSS, wallet adapter and bundle, game runtime, and root dependency lock retain their prior bytes. Bearers remain in `sessionStorage`; authorization is not copied to `localStorage`.

## Durable participation binding

The deployed participation handler lacked `TREEFORCE89_DEV_DATABASE_URL`. Three real TREE FORCE participation requests returned HTTP 503. Its original release had supplied the connection as a deployment-specific override; later preservation releases omitted that override. Package hashes and site/shared environment fingerprints did not detect this missing dependency. Earlier claims of complete environment preservation were therefore incomplete.

This release created the missing connection as a persistent **site secret**, scoped to **Functions** in the **Production** context. It uses the existing isolated TREE FORCE database branch, with database identity and TLS checks. There are now **50 site Functions environment entries**, including all **49 pre-existing entries unchanged**. No schema or production game-participation records were changed by this repair.

The [runtime configuration proof](../production/arcade-session-return-runtime-configuration.json) contains safe metadata and fingerprints, never the connection value. Future releases must preserve these current 50 entries and the production-scoped binding. The obsolete 49-entry baseline is historical evidence, not the current environment definition.

TREE FORCE reports its first wave through its existing game-session credential. Lobby authorization and game reporting are separate: the lost lobby session caused the signed-out display, while the missing database binding independently prevented valid participation reports from being authenticated and saved.

## Exact package recovery and provider metadata

All **41 deployed function ZIPs**, totaling **27,976,379 bytes**, retain their baseline SHA256 digests and byte counts. Thirty-eight archives were already available. Three additional exact archives were recovered: an existing `arcade-growth` archive was retained, and the missing `treeforce89-dev` and `canopy-access` archives were mechanically reconstructed in isolated checkouts using their original released source and locked dependencies. Both reconstructed ZIPs matched the previously deployed artifacts exactly. The local reconstruction is documented in [package recovery evidence](arcade-session-return-package-recovery.json); describing this release as having no local rebuild would be inaccurate.

Reattaching the unchanged packages with the corrected environment produced **162 provider-metadata differences**: `a` changed in 39 records, and `c`, `id`, and `oid` changed in all 41. The [committed provider review](arcade-session-return-provider-review.json) approves those exact before/after values. Every other field, its presence, and record order remain identical. All package hashes, runtimes, invocation modes, memory/region settings, routes, build metadata, observability settings, and five schedules are preserved. Complete provider records are deliberately not described as identical.

The first candidate, `6ae7fe815070789ddb725fa3`, remained unpublished after all requested uploads and the normal 20-minute processing interval. Its evidence was preserved. The successful replacement used the same 284-path manifest with only `async:false` changed to `async:true`, matching current CLI policy above 100 files. That justified the retry; it does not establish the cause of the earlier stall. The old candidate is excluded from publication.

The published inventory contains all 284 static paths, with 283 unchanged. Generated Netlify configuration and the later Canopy checkout redirect remain exact. The new publication is locked; the old deployment became unlocked normally and was not relocked.

## Verification and limits

- **48 controller cases** passed: 42 top-level cases and six nested cases.
- **Five native-browser regression groups** passed after reproducing the original failures against the pre-fix source. They use the actual wallet bundle, browser-native session storage, navigation, and locally fulfilled synthetic wallet/API fixtures. Actual browser Back loaded a new document; persisted `pageshow` coverage is explicitly simulated.
- **Five candidate and five canonical hosted-browser groups** passed at 1440×900, 390×844, and 320×740. Each run observed 20 anonymous GET requests with HTTP 200 responses, verified all four critical source files, retained all eight cabinet destinations, and reported no browser errors or horizontal overflow. The first cabinet remained visible in each initial viewport.
- The candidate probe at 03:45:23.793366 UTC and canonical probe at 03:45:44.780150 UTC returned HTTP 401 `invalid-game-session`. Their valid-form nonexistent credentials reached the pinned database connection and session SELECT, then failed before ownership checks or participation writes.

These checks did not connect a real user wallet, request a real signature, execute a successful end-to-end user game report, or write production check-in/participation credit. The reporting user's prior wallet and run were not identified or recovered, and no retroactive credit was fabricated. An earlier read-only aggregate found nine stored TREE FORCE events with their associated attendance/quest records intact; it did not identify the reported failed run. Existing saved records remain durable, while a failed request is not proof that participation was saved.

The existing Canopy authentication store is deployment-scoped; its short-lived sessions can require sign-in again after publication even though its package and protected settings are unchanged.
