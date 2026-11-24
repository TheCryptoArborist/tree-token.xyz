# Isolated run-review endpoint candidate — not deployed

This packages the durable ticket coordinator as a single modern Node 24 function,
`arcade-bnb-run-review`, outside every current published functions directory.
The candidate route is `https://tree-token.xyz/api/arcade-bnb-test/run-review`:
it stays beneath the existing identity cookie path. No wallet preview is added.
It never grants gameplay or calls any payment, score or tournament handler.

## Configuration and admission

The default is disabled (503), without reading secrets or calling a chain.
`BNB_RUN_REVIEW_ENABLED=true` additionally requires
`BNB_RUN_REVIEW_GENERATION=1`; any other generation is rejected. Generation 1
is already retired and therefore cannot obtain an accepted backing review.
A future generation requires another source/configuration review, not just a
client-supplied field. The existing same-project server database binding is reused;
an explicit BNB override must supply both URL and secret. Secrets are never bundled.
The runtime additionally requires the intended Netlify site ID and platform IP.

The package verifier requires the exact platform rate rule: sliding window,
20 requests per 60 seconds aggregated by domain and IP. This must be preserved
when publishing the function; a bare handler without that platform metadata is
not an approved deployment. The database independently serializes and limits
successful issuance to five per minute per session. No new schedule is added.
Existing canonical-origin, cookie, size and body checks remain in the HTTP factory.

## Reproduce and evidence

Install the unchanged root lock and isolated contract dependencies:

```
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --test tests/multichain-bnb-run-runtime.test.mjs tests/multichain-bnb-run-http.test.mjs tests/multichain-bnb-run-authorization.test.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-bnb-run-postgres.mjs
node scripts/package-bnb-run-review.mjs --outdir /tmp/bnb-run-review-new
```

Use a fresh output directory. Node 24 and `unzip` are required. The package includes source, dependency-lock and
traced-file hashes, the exact route, rate rule, runtime and build metadata.
`package-review.json` records the local candidate and unapplied migration hash.
CI produces a ZIP plus complete manifest as `bnb-run-review-candidate` (30-day
artifact retention); committed sources and lock allow regeneration after expiry.
No workflow deploys this artifact.

An extracted-ZIP test exposed missing nested `ethers` dependencies in the initial
ZISI-only candidate. The corrected package first bundles across both pinned
dependency roots, then uses ZISI for the platform wrapper and metadata. Packaging
now extracts the ZIP outside the repository and imports/invokes its handler in a
fresh Node process, with network calls forbidden, before writing the manifest.
The initial candidate hash is superseded; use only the current review manifest.

Local validation: 40 HTTP/coordinator/runtime tests and 15 disposable PostgreSQL
checks passed. The latter now invokes real exported HTTP handlers with Web
Requests and real SQL identity/store calls through independent PostgreSQL
connections. Concurrent consumes return exactly one 200 and one 403. Revoked
sessions and backing loss deny requests, and client identity overrides fail.
Positive chain proofs in this harness are synthetic; it is not a hosted HTTP,
PostgREST or mainnet integration success. Existing identity definitions and grants
are checked unchanged. Every response remains non-playable.

## Remaining reviewed release work

No hosted migration, function publication, environment toggle, public sale or game
activation occurred. Before a release, choose a bounded retention/cleanup policy
for expired review records (there is intentionally no new cleanup job), validate
hosted RPC permissions and admission metadata, and prepare a preservation release
from a fresh capture of the complete current production inventory. Preserve all
newer Tree Army work, existing functions/runtime/provider settings and schedules;
never reuse an old baseline or publish the historical root build. A disabled
publication and a later read-only enablement need an explicit release scope.
Gameplay/session-to-score integration remains a separate reviewed milestone.
