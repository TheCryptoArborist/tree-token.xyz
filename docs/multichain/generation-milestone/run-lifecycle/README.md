# Isolated run lifecycle and score admission — source only

This milestone adds a **shadow run** coordinator and a locally tested transactional
schema. It creates no gameplay capability, HTTP endpoint, live table, leaderboard
entry or tournament qualification. Every result carries `gameplayAuthorized:false`.
A shadow score is only a review record. The default completion verifier rejects
all scores; the actual Tree Force game verifier remains a release prerequisite.

## Published interface inspection

Read-only inspection on November 24, 2026 fetched the canonical
`/play/treeforce89/` HTML and its `/play/treeforce89/assets/index-share-r4.js` bundle.
The bundle SHA-256 was
`738c68535a66f68544a9ca30ba0ab6894bca312872568f89910a40954bd741bf`.
No game APIs were called and no game source or package was changed.

| Existing browser interface | Observed behavior | BNB boundary |
| --- | --- | --- |
| `tree-challenge`, `tree-session` below `/play/treeforce89/api/` | Sui wallet sign-in returns bearer token and `grove-…` run ID | Keep intact; BNB identity remains its separate scoped cookie/session |
| `tree-run` | Sends prior run ID with bearer token; requires new token/ID and bounded expiry | Do not accept these credentials as a BNB review ticket |
| `tree-logout` | Revokes the bearer session | BNB rechecks its own stored revocation on every operation |
| `/api/treeforce89-leaderboard` | POSTs username and client run summary; UI listens for `treeforce-run-ended` | Client summary is untrusted; do not forward shadow scores here |
| `tree-continue-offer`, `tree-continue` | Uses run snapshot, offer ID and confirmed TREE payment digest | Existing Sui payment behavior untouched; no BNB paid actions added |

These are observed client contracts, not an audit of the live game server's score
validation. Its authoritative simulator/replay or server event evidence has not
been supplied by this repository. Entitlement alone cannot establish score
integrity. A separate reviewed verifier must reconstruct or validate completion
against authoritative game rules and bind evidence to this exact server run. A
browser signature or plausible score cap is insufficient.

## Implementation

- `scripts/multichain/bnb-run-lifecycle.mjs`: separate identity/backing coordinator,
  RPC store adapter, start, renew, finish and diagnostic recovery.
- `schema.sql`: proposed schema applied only in disposable PostgreSQL. It is
  deliberately outside `supabase/migrations`, so ordinary migration deployment
  cannot apply this experimental schema. Generate a reviewed migration later.
- `tests/multichain-bnb-run-lifecycle.test.mjs`: negative policy/verifier cases.
- `scripts/multichain/check-bnb-lifecycle-postgres.mjs`: independent connections,
  concurrency and actual coordinator-to-database integration.

Start hashes the review ticket into a run ID; the ID is not a credential. Identity
is always validated separately. One transaction locks the session, ticket and run
in that order, consumes the ticket and inserts the run. Existing review `consume`
is never called first. A failure rolls both changes back. A lost response can be
retried with the same ticket: it returns the same still-live run without extending
its lease. A ticket consumed by the old review-only consumer cannot allocate a run.

Runs bind session hash, wallet, chain 56, approved generation and fixed rules
`bnb-shadow-v1`. They expire after at most five minutes or session expiry,
whichever comes first. The fifteen-second lease must be renewed before it expires;
proposed clients should request renewal every five seconds. Every renewal and
completion requires a new reader assessment. Server proof must reach the DB
within five seconds; the DB clock is checked after locks. Session revocation
serializes with the same session lock as the existing identity implementation.

Revision comparisons serialize renew/finish. One finalization wins; evidence hashes
are unique across runs. The trusted verifier supplies the score, not client JSON.
It must return the matching run/rules and a canonical evidence hash. The default
returns null. Positive tests inject an explicitly synthetic verifier and backing
proof; they do not establish real game integrity or active mainnet backing.

Loss of entitlement or a backing-reader error terminally closes the run when
storage is reachable. An overlapping positive read cannot reopen a closed run.
If storage is unavailable, the operation fails and the lease expires; no success
is returned. A missed lease cannot be renewed retrospectively. A slow verifier
must still finish within the existing lease. All future authoritative actions
must go through this boundary; browser animation cannot be forcibly stopped.
Cross-chain reads are not atomic and cannot detect a transfer occurring after the
last observation. The lease bounds admission staleness; finalization reads again.
No claim of continuous on-chain ownership is made.

`inspect` recovers status/score after an uncertain completion response without a
second write. It is bound to a valid session and marked diagnostic only; it neither
renews a lease nor attests current backing. Expired/revoked sessions cannot recover
through this API. Administrative recovery remains read-only and separately scoped.

## Storage and operations

The proposed table is private, RLS-enabled, with no public policies. Its RPC is
SECURITY INVOKER with an empty search path and service-only execute permission.
No runtime DELETE grant exists. Existing auth/review functions and grants are
fingerprinted before/after local schema application and stay identical. No new
SDK or production dependency was installed.

Shadow rows reference review tickets with administrator-only deletion cascading
from the parent. This preserves the existing count-first, at-most-1000-row cleanup
of tickets expired more than seven days ago, without blocking it on child rows.
Shadow audit retention thus follows the parent ticket, not seven days after the
run ends. No scheduled cleanup is installed. This coupling requires review before
migration; the current live cleanup procedure remains unchanged.

Supabase's current changelog and database-functions guidance were read. The branch
merge permission change does not affect disposable local SQL. Catalog and role
checks verify privileges/RLS directly; no hosted schema or advisors were changed.
The CLI package installation failed during postinstall; no migration was generated
or applied. This does not block local source/schema validation.

## Reproduce and results

Node 24 and PostgreSQL 17, using pinned repository dependencies:

```sh
node --test tests/multichain-bnb-run-lifecycle.test.mjs tests/multichain-bnb-run-authorization.test.mjs tests/multichain-bnb-run-http.test.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-bnb-lifecycle-postgres.mjs
```

For unpacked PostgreSQL, also set `BNB_PG_SHARE` to its `share/postgresql/17`
directory. The checker starts/destroys a disposable localhost cluster and accepts
no remote database credentials. `postgres-validation.json` records its results.
Local validation passed **67 JavaScript tests** across lifecycle, authorization
and HTTP suites, and **18 PostgreSQL checks**. The existing generation-custody
workflow includes both new suites.

## Remaining integration and private acceptance

1. Review this source/schema, then implement a real Tree Force verifier against
   authoritative game state/replay. Test modified/reordered/missing events, forged
   scores, wrong rules/seed/run and duplicate evidence. Keep default denial until
   it exists. Do not substitute the browser's run summary.
2. Build an isolated HTTP handler with the existing origin/cookie/size/rate-limit
   guards, fixed approved policy, private audit retention and an activation gate.
   Do not expose the service-role RPC or accept verifier output from a client.
3. Generate/review the migration and schema advisors, and prepare exact backend
   packaging against a fresh complete live inventory. No migration or publication
   is authorized by this source change.
4. Run a private shadow acceptance first: fixture-positive starts/renewals and
   verified evidence, ambiguous-response recovery, logout and ownership-loss races,
   then denial for actual retired generation 1. Assert no leaderboard/tournament
   writes and no gameplay grants.
5. Before another paid pass trial, resolve the [artwork requirement](./artwork.md).
   Only after source and verifier review consider a separately approved generation-2
   live lifecycle with fresh NFT identity/ownership and exact fees. Gameplay
   activation remains a separate reviewed step; no new payment is requested now.
