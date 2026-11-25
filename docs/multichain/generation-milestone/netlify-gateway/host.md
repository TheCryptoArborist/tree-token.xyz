# Native host assembly and checkout transport

November 24, 2026. Source-only milestone. Prior composition CI passed:
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45541652287
(commit c66cbcea). No deployment, migration, payment or wallet call occurred.

`createNativeContinueHost` constructs the session adapter, default typed payment
loader/settler, delivery service, release authorization, native receipt recorder,
recovery service and native offer wrapper around one supplied pool. Runtime and
cutover proofs must match the caller's exact runtime digest and database identity.
The caller must establish those expected identities from independent reviewed
provenance, not from the same untrusted request or proof. Existing services and
original native request handling are injected; default mode remains legacy.

The host uses the verified native service's `offer` method only, never `redeem`.
It does not instantiate an SDK client, fetch secrets, register a Netlify route or
rebuild the native function. The actual native bundle integration remains a
separate preservation/package review. No native files were edited. Concurrent
Treeforce review branch remains at 1d6f4798 in this check.

## Browser connection

`createNativeContinueTransport` exposes offer/record/recover/prepare/activate for
the canonical `/play/treeforce89/api/shared-continue-*` routes. Supply the existing
session getter with sessionToken, nativeRunId, epoch (string) and expiresAt;
include shared accountId/runId when mapped. Pass its prepare/activate methods to
the existing paid-continue controller. Offer/record/recover are explicit checkout
UI actions; the transport does not automatically chain them or request a wallet
signature. The existing reviewed signer/transaction builder remains responsible
for explicit payment approval. Keep a known transaction digest for reconciliation;
a lost HTTP response must never be interpreted as permission to pay again.

Every call sends once, omits cookies, rejects redirects and uses a private bearer
header. Session identity/expiry is checked before the request and after both the
response and JSON parsing. Credentials are not stored by the transport. Errors
require review; no automatic retry, repayment or scene restoration occurs.
Recovery may deliberately change the server-side native run: the UI must adopt
the verified recovery result before calling the restoration controller.

## Evidence and limits

`host-tests.json`: 66 unit checks, 37 Netlify-role database/browser checks, and 34
original-role database checks passed. Receipt recording and fresh-login recovery
now traverse the actual host factory and disposable database. Host tests reject
wrong runtime/database drain proofs before database access and confirm default
legacy behavior. Transport tests cover all five canonical routes, changed or
expired sessions, oversized input, errors and no retries.

The actual Phaser test now uses the new browser transport into the composition,
strict HTTP boundary and real database consumption for Sui/BNB typed fixtures.
It restores once and blocks duplicate clicks/refresh replay. Its delivery fixtures
still inject payment evidence and settlement; this is not a full financial E2E
or actual published-host test. Native offer service, BNB wallet ingestion, native
packaged runtime and real user checkout UI have not been exercised together.
The initial transport epoch assumption failed against the native string epoch;
it was corrected without changing the native session contract.

Run existing database/browser commands from composition.md and include
`tests/multichain-native-host.test.mjs` in the unit suite. CI includes these tests.
No SDK or transaction-reader implementation changed in this milestone.

## Remaining release gates

1. Bind the host factory to the exact native bundle and the checkout UI to the
   existing signers; test the real offer service and both-chain receipt ingestion.
2. Implement the operational drain/fence across all old deployments. A fresh
   attestation is not proof that old in-flight writers stopped; see composition.md.
3. Review the hosted schema migration/rollback and complete current-site inventory
   before a separately authorized preservation release. Never deploy the historical
   root build. Keep shared purchasing/restoration inactive until these gates pass.
