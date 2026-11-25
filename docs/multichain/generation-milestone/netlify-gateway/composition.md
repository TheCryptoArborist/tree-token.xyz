# Authenticated gateway composition — November 24, 2026

Source-only follow-on to the schema rehearsal. No live migration, deployment,
wallet request or gameplay change. Previous GitHub run 45540965653 passed for
commit a16aff30 (https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45540965653).

The composition now provides strict HTTP adapters for native Sui receipt record,
shared paid-run recovery and native Sui offers, alongside prepare/activate.
Bodies accept only action-specific fields, never browser-supplied wallet/account
identity. Native offer uses its existing raw bearer contract internally; record
and recovery receive only its SHA-256 hash. Offer snapshots use the pinned native
validator. All actions require canonical same-origin POST, a native bearer,
JSON and a streamed 2 KiB limit. Response projection strips credentials and
checkpoints from offer/record/recover and forces restoration/payment-request
flags false. Only activation may authorize restoration.

## Trusted host wiring still required

Construct `createNativeSharedOffer({pool, sessionAdapter, nativeOffer})` with
`nativeOffer: input => verifiedNativePaidService.offer(input)`. The wrapper binds
the native run to its shared identity before calling the existing service. The
native service then rechecks authentication, ownership and the interrupted run.
A failed offer can leave an inert mapping, but cannot create a payment or claim.
Never pass the native service's redeem method.

Pass that wrapper as `nativeOffer` to `createNativeContinueComposition`, with
`createNativeSuiPaymentRecorder`, `createNativePaidRunRecovery`, the release
restoration authorization, and the verified original native request handler.
Use the same verified database identity for every service. This module does not
instantiate a deployed service, supply credentials, register routes or change
the native package. The host integration/repackaging review is still pending.
BNB receipt ingestion remains its existing separate typed ledger path; the new
record endpoint accepts Sui digests, not arbitrary BNB payment evidence.

## Cutover is an operational prerequisite

Default mode is legacy; draining/unknown mode denies new payment calls. Shared
mode additionally requires `readCutover()` to provide a trusted attestation:
legacyWritersDrained=true, paymentsPaused=true, exact runtime/database identity
hashes, checkedAt no more than five seconds old and expiresAt within sixty
seconds of checkedAt. No default attestation exists. Browser input cannot supply
it. The host must compare these hashes to the selected runtime/database and
obtain real drain evidence; syntactic validation is not that evidence.

The overlap test deliberately holds a legacy request open, changes mode to
`draining`, observes new requests denied, and confirms the old request can still
finish. Do not treat a flag flip or fresh timestamp as proof of drain. Before
activation, block entry points across old deployments, wait for bounded pending
writers to finish, reconcile receipts and counters, and bind the attestation to
the verified runtime/database. The attestation check is a prerequisite, not a
distributed fence. No production drain controller is implemented here. Keep
payment UI paused until the coordinated host/client cutover is reviewed.

## Tests and reproducibility

`composed-tests.json` records 52 unit checks plus 37 disposable PostgreSQL checks
under the Netlify role model. The database test uses the composed authenticated
record endpoint for 12 concurrent receipt retries and recovery after fresh login.
The offer wrapper has real database mapping/retry/mismatch tests with an injected
native offer service; this does not prove the full deployed offer service.
The original role model also passes 34 checks without the browser option.

For Sui and BNB typed fixtures, actual Phaser restoration now crosses the composed
gateway and strict HTTP adapter into real PostgreSQL consumption. Each restores
once, denies a foreign credential and blocks refresh replay. Offer/record/recover
are unavailable fixture callbacks during those browser cases; they are tested
separately. BNB financial settlement remains covered by the ledger tests, not by
these injected browser fixtures. Art uses placeholder textures, not NFT artwork.

```
node --test tests/multichain-restore-authorization.test.mjs tests/multichain-restore-http.test.mjs tests/multichain-native-gateway.test.mjs tests/multichain-native-composition.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Existing setup/dependency instructions are in README.md. CI runs both database
role models. Mysten README, accessing-data skill and gRPC reference were refreshed;
hashes are in mysten-review.json. No SDK/API migration was made.

Next: wire and verify the exact native host composition and checkout client,
including real offer service, BNB receipt ingestion and operational drain/fencing.
Then review the hosted migration and preservation release separately. Existing
Treeforce development may continue on its branch; no native game files changed.
