# Arcade session restoration and TREE FORCE participation

## Problem and reproduced causes

The reported journey was Daily Growth sign-in → TREE FORCE ’89 → Back to Arcade, followed by a signed-out lobby and no daily quest credit. Investigation found two independent failures.

The Daily Growth quest link opened TREE FORCE in a new tab with `noopener`, while the lobby bearer is intentionally kept in tab-specific `sessionStorage`. The game's existing Back to Arcade link then opened a lobby in that new tab without the original authorization. The original lobby could still be signed in. Same-tab cabinet navigation already preserved the stored session.

Two additional restoration gaps affected reloads: a wallet provider registered after the initial restore attempt was not retried, and a restored session that was subsequently renewed could lose its provider ID. Returning to an existing lobby also displayed a refresh prompt without fetching saved progress.

Separately, the deployed participation handler required `TREEFORCE89_DEV_DATABASE_URL`, but the current deploy had no such binding and no persistent site or shared Functions variable supplied it. Three real `treeforce-play` requests returned HTTP 503 shortly after the preceding release. The original participation release supplied this connection as a deployment-specific override; later preservation releases omitted that override. Preserving function package bytes and anonymous status responses did not establish that this authenticated dependency was available.

These causes are distinct. TREE FORCE reports its first wave with its own existing game-session credential; a Daily Growth lobby sign-out alone does not prevent a valid game report. The missing database binding prevented that independent report from being authenticated and saved.

## Frontend changes

- TREE FORCE's daily-task link now navigates in the same tab. External Garden game links retain their existing new-tab behavior.
- A late registration of the exact saved wallet provider triggers one guarded silent restoration. Expiry, sign-out, disconnect, account changes, and obsolete asynchronous responses cannot restore invalidated authorization.
- Restored and explicitly renewed sessions keep their actual provider ID. A legacy saved session without an ID can recover only when its saved provider name uniquely matches an available provider and the account matches exactly.
- Returning from a launched eligible game refreshes server-verified progress. Focus, visibility, and persisted-page return events consume one launch marker before synchronization, preventing duplicate requests and automatic retry loops.
- Cabinet launches participate in the same return refresh behavior. A fresh lobby document retrieves progress through the existing initialization path.

Only `scripts/arcade-daily-growth.js` changes in the public deployment. The wallet adapter and bundle, HTML, CSS, game runtime, dependencies, and function packages remain byte-identical to the current baseline. Bearers remain in `sessionStorage`; no authorization is copied into `localStorage`.

## Runtime repair

The guarded release restores the one missing connection as a persistent **site secret**, scoped to **Functions** in the **Production** context, using the existing isolated TREE FORCE database branch. It validates the database identity and TLS transport parameters before using the connection. The unrelated default database is explicitly rejected.

The connection value stays in process memory and Netlify's secret store. Repository evidence records only identities and fingerprints. The release preserves all 49 pre-existing site Functions environment entries and the shared and legacy environment fingerprints. It does not add a paid-continues flag, change database records or schema, rebuild any function, or alter game-session semantics.

The source commit must exist before configuration changes. A fresh, locked production baseline is required before configuring, creating a candidate, and publishing. The release retains all 284 static paths, 283 unchanged static files, all 41 complete function records, five schedules, generated configuration, and the later Canopy checkout redirect. Only the newly recorded, verified candidate can be published.

## Evidence and validation boundaries

The existing controller suite passes **48 cases** (42 top-level cases and six nested cases). The native-browser runner reproduced the old failures against commit `caed1e3f96a3496537515fc46d9cb1bd7fd9e9eb` and passed **five regression groups** against the fixed controller. It uses the real wallet bundle, browser-native storage, real navigation, and locally fulfilled synthetic wallet/API fixtures. No real wallet signature, transaction, check-in, or participation write occurs in those tests.

The five groups cover normal quest navigation and return, same-tab cabinet/history navigation, late provider discovery, session renewal followed by reload, and one-shot return refresh plus account invalidation. Both browser runs have zero runtime errors. Actual browser Back loaded a fresh document in this routed test environment; persisted `pageshow` coverage is explicitly a simulated lifecycle event.

The fixed controller SHA256 is `48f9881a7827742a1a88a46cb6ea05fc95e57379aaa7314a628243fdb6bb7b98`. Selected screenshots were visually reviewed. The fixture screenshots contain synthetic wallet and attendance data and are not evidence of a particular user's saved run.

A production read-only aggregate found nine stored TREE FORCE events, with none missing their associated attendance or daily quest records, and no new events in the preceding six hours. It did not identify the reporting user's wallet or establish whether a particular failed run can be recovered. Existing saved events remain durable; a request that failed before recording cannot be treated as earned participation.

Hosted verification requires the real participation endpoint to return HTTP 401 `invalid-game-session` for a valid-form, nonexistent synthetic game token. The handler's inspected control flow performs a database lookup and rejects the nonexistent session before ownership checks or any progress write. This distinguishes a functioning database connection from the observed HTTP 503 failure without fabricating attendance. It does not prove successful end-to-end reporting with a real user's wallet.

Reports live under `docs/review/arcade-session-return/`. Runtime diagnosis, release guards, and the verification summary record the final release stage and exact evidence. Candidate and canonical browser checks use only anonymous GET/HEAD requests and compare hosted source bytes, visible artwork, collapsed layout, and cabinet visibility at desktop and phone widths.
