# TREE FORCE scoped payment API — November 5, 2026

**Paid continues are enabled** on canonical https://tree-token.xyz/play/treeforce89/. Locked deploy `6aec99bf240f589972b4b367` was published at 15:02:05 UTC (9:02 AM CST), from source `bf4537220bb9a9b096cfaab9598fa2cd13556db9`. Post-publication workflow [42050899464](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/42050899464) passed.

## Scope and behavior

Only `treeforce89-dev` was rebuilt and uploaded. Its package identity changed intentionally; its Node 22 runtime, region, memory, invocation mode, bootstrap, routes and rate limit remain the same. The other **42 complete function records**, all **293 static files**, **five schedules**, deployment runtime settings and API-visible environment records match baseline `6aec00c92d9060d410e986e0` exactly. No migrations or environment changes were made.

The namespaced canonical handler selects an explicit server-side payment policy. Preview handlers retain their disabled-by-default environment policy. This avoids the previous site-wide flag operation that requested all 43 packages again. The paused candidate `6aec95af5a7ac5a4b35df7d3` was not published.

A directly held NFTree still grants entry. After three lives are lost, a separately approved 20,000 TREE payment can restore three lives in the same run, current wave and score. The canonical coin, six decimals, confirmed treasury, checkpointed on-chain verification and atomic one-use receipt accounting are unchanged. SUI gas is separate. The existing client still separates wallet payment, receipt verification/recovery and the explicit **Resume gameplay · 3 lives** action; no wallet/frontend/dependency-lock change was made.

## Authentication delays

The previous API had no PostgreSQL connection/query deadlines or ownership-query deadline. The canonical pool now uses a 5-second connection/lock timeout, 7-second server statement timeout and 8-second client query timeout, with keepalive and shorter idle connections. The pinned gRPC client has an 8-second per-call deadline; NFT ownership pagination shares a 10-second abort signal. A failed schema readiness promise can retry on a subsequent request. The handler logs only a known route label, status and elapsed time; idle database errors are logged without raw provider messages.

These are bounded failure/recovery changes. The earlier timeout's exact provider/network/database cause was not proven. Two complete candidate smoke runs and one complete canonical run passed after the update without the previous timeout; this does not guarantee every external provider request will always succeed.

## Validation

Candidate workflow [42050197557](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/42050197557) passed all **52 tests**, the archived 38-function executable source-parity check, PostgreSQL 16 payment/concurrency checks, real server statement-timeout rollback/recovery, canonical API build and exact candidate preservation. The uploader accepted only the new TREE FORCE digest; there were zero static uploads and one function upload.

Both candidate authentication checks and the canonical check used unfunded ephemeral personal-message keys. They verified real signatures, mainnet non-holder denial, single-use nonce replay rejection, forged proof rejection, same-origin restrictions, missing-session refusals, isolated schema readiness and enabled paid-continue status. They did not sign or submit a token transaction.

The canonical home was inspected after publication. **Owner acceptance passed on November 5, 2026:** the owner confirmed that the live 20,000 TREE paid continue worked and restored all three lives. This was a user-operated wallet test; the assistant did not sign or submit a payment. No transaction digest was supplied for independent receipt inspection. Score/wave preservation remains covered by automated checks and was not separately described in the owner report. For a delayed confirmation, use payment verification/recovery rather than paying again.

Complete release inventory: `production/treeforce89-scoped-api-manifest.json`. Published function/environment evidence: `treeforce89-scoped-api-published.json`. PostgreSQL results: `treeforce89-scoped-api-postgres.json`.

Current MystenLabs guidance checked live through GitHub: README.md, accessing-data/SKILL.md, accessing-data/grpc.md, frontend-apps/transactions.md. Installed Sui 2.37.0 and PostgreSQL/Netlify Database sources were inspected for timeout API compatibility. No SDK migration occurred.
