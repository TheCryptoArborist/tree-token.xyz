# Authenticated restore transport — source only

The Fetch handler in `scripts/multichain/continue-restore-http.mjs` connects the
existing native bearer credential to the release-authorization boundary. It is
not registered as a route and does not issue credentials, accept payments or
change existing authentication. The host must supply the actual
`createRestoreAuthorization` instance backed by the native database adapter.

Only POST JSON requests on the two canonical HTTPS origins are accepted, with
an exact matching Origin header. Cross-site Fetch requests and query parameters
are denied. There is no CORS grant or cookie fallback. A native 64-hex bearer
credential is SHA-256 hashed server-side; its hash is passed to the existing
delivery transaction, which locks and verifies the authoritative native session,
run and payment ownership. Syntactically valid credentials alone do not authorize
a restore. Session revocation/expiry and ownership remain transaction checks.

Prepare accepts exactly runId/paymentId/clientKey. Activate accepts exactly
runId/clientKey/leaseId/checkpointHash/policyDigest/requestId. Browser-supplied
wallet, account, session hash, snapshot, release policy and extra fields are
rejected. The streamed body has a 2 KiB limit, independent of Content-Length.
Invalid JSON, invalid UTF-8, wrong types and malformed identifiers are rejected
before calling the service. Responses are no-store and errors never expose raw
credentials, SQL or internal exception messages.

A service failure produces a generic review-required denial, including when
consumption might already have committed. It does not retry, promise rollback,
or ask for another payment. Existing browser write-ahead markers continue to
block an uncertain activation from restoring twice. A production support and
recovery procedure is still required for consumed-but-unconfirmed cases.

## Validation

Run from the repository root:

```sh
node --test tests/multichain-restore-http.test.mjs tests/multichain-restore-authorization.test.mjs
CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Dependencies and unpacked PostgreSQL setup are documented in
[Phaser restoration](../phaser-restoration/README.md). Local results:
23 HTTP checks plus 11 authorization checks pass. The 34-check native SQL suite
includes both Sui/BNB fixture payments through an intercepted browser Fetch
request, the actual HTTP handler, release boundary, PostgreSQL consumption and
actual recovered Phaser game. Each case also rejects an unknown bearer against
the real disposable database before the valid restoration. Both restore three
lives, score 55 and wave 2 once; refresh remains blocked. See the evidence here.
All browser traffic is intercepted; no live wallet, payment or website request
is made. Payment proofs, runtime policy, ownership and assets remain fixtures.

## Compatibility and remaining tasks

Remote main inspected: `f55644c2afee39d4459bbdb5926f7544cf8b9900`.
The native source is still pinned to `9974d7f0b5c03b9621561d15a8040e8bf558e1db`.
The read-only inventory audit at `72239a3591ebc6df3581d12810ac6755de903c07`
records deploy `6b063e9462762ae02c0fd5db`, 693 static paths, 61 backend records and
five schedules, but explicitly does not prove native source parity. It is not
reused as a current release baseline. No production parity approval is implied.

Before live integration: prove current native backend/source/database parity;
implement the independently verified server release-policy reader; wire the
real gateway and native credential lifecycle into the transport; test wallet
switching, logout, real React teardown, Sui payments, scoring and tournaments;
review operational limits/rate limiting and consumed-but-unconfirmed recovery;
then obtain a fresh complete preservation inventory and reviewed release approval.
No Netlify handler, redirect, migration, environment flag or live feature is added.

MystenLabs/skills README, sui-ts-sdk-backend/SKILL.md,
accessing-data/SKILL.md and accessing-data/grpc.md were refreshed for this work.
No SDK or chain API change was needed; existing pinned dependencies are preserved.
