# Isolated BNB-only Tree Force '89 authentication and backing diagnostics

## Current release — November 21, 2026

Current locked production is `6b01bbf2b66675f3aebc4a74`, published at
09:43:38 America/Chicago from `e5e3b1255846eb33b408f2fece7750befba69ff7`
through PR #278 and
[workflow 44920394429](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44920394429).
The existing authentication flow now supports a session-bound, read-only
**Check trial backing** action for original NFTree #2720. The server reads both
chains and rechecks the session after the observation. The canonical test
confirmed the pass is retired and the original NFT released; gameplay remains
denied. The production custody/generation/pass system is still required.

All 174 focused tests, both 12-case source browser suites, 12 candidate browser
cases and canonical login/backing/logout acceptance passed. The synthetic test
session was revoked. All 649 unrelated static paths, 50 other complete backend
records, five schedules and protected configuration were preserved. Database
definition/grant fingerprints are unchanged; no migration was reapplied.

Current behavior, evidence and remaining contract milestone are documented in
[`bnb-backing-check.md`](./bnb-backing-check.md). The following sections retain
the initial sign-in release history and its timestamped evidence.

## Initial sign-in release — November 20, 2026

The isolated page and endpoint were initially published on November 20, 2026
at 22:55 America/Chicago, in deployment `6b01240f1a94cf48c5b89830`.
Published source: `75495d9577c56e6e44b4c8ef4a71420f9ee26a79`, through PR #276.

- Page: https://tree-token.xyz/play/multichaintest/game/bnb/
- Endpoint: https://tree-token.xyz/api/arcade-bnb-test
- Successful release: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44868193543

All 58 focused tests, 12 candidate browser scenarios, complete preservation
gates and the canonical real-signature acceptance test passed. The latter used
a fresh unfunded synthetic identity and verified exact challenge issuance,
signature acceptance, private cookie, nonce replay denial, durable session,
denied gameplay, logout and stale-cookie rejection. No chain transaction was
submitted. A post-test database audit found one consumed challenge and one
revoked session, with no active session remaining.

All 649 prior static hashes, 50 complete backend records, five schedules,
runtime settings and protected configuration evidence remain unchanged. Only
the two page files and one isolated handler were added: 651 paths and 51
functions total. The canonical page was visually inspected and its signed-out
status button returned the expected message. Mobile and desktop browser checks
used mocked wallets. Peter later supplied screenshots showing a successful
wallet sign-in and a subsequent no-session status, with gameplay disabled in
both. See the November 21 manual observations below for their exact scope.

Complete release evidence:
[`bnb-test-auth-page-release.json`](./bnb-test-auth-page-release.json).
Independent inventory/backend/database audits, browser evidence, canonical
acceptance and UI observations:
[`bnb-test-auth-publication-verification-20261120.json`](./bnb-test-auth-publication-verification-20261120.json).

The isolated server source and schema are merged through PR #268. Migration
`20261120193912_arcade_bnb_test_auth.sql` was applied to the existing project
`lehswszuekjqottolmsf` and verified before publication preparation. The two
private tables have RLS, and the five public RPCs allow execution only by the
server role (plus database owner). The transactional smoke test passed and was
rolled back. Existing Arcade procedure definitions and privileges were preserved.

The handler remains outside Netlify's historical production functions directory
and is packaged alone. Publication must preserve all 50 existing function
package/provider/runtime records, five schedules and all current static files.

## Resumption review — completed November 20, 2026

Peter confirmed credits were available. The independently authorized Tree Army
release then completed successfully in
[workflow 44867337174](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44867337174),
making `6b01217f8e1995306b794031` the current ready, locked deployment.
Before repinning the BNB publisher, the complete 649-path report was compared
with the preceding inventory: only `/play/tree-army/test/index.html` changed,
and its digest matches the reviewed Tree Army source. All 50 complete backend
records, five schedules and protected runtime fields remained identical.
The successful Tree Army workflow also verified build settings, environment
records and snippets before and after publication.

The BNB publisher now pins that successor, preserving the same counts and all
existing guards. Its database-readiness evidence includes a fresh read-only
audit at `2026-11-21T04:42:22.676Z`: both isolated tables remain empty, all five
RPC permissions remain restricted, and the 31 existing Arcade procedures retain
their baseline fingerprint. The successful BNB attempt created a fresh capture,
plan and candidate before publication and canonical acceptance.

## Earlier publication block — November 20, 2026

The publication implementation merged through PR #270; PR #271 pins the
publication checkout to its reviewed commit. The source, database and browser
checks passed. Workflow
[44865970994](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44865970994)
captured the current 649-file/50-function/five-schedule baseline and passed the
additive release plan, then Netlify rejected candidate creation with HTTP 403.
No candidate was created and no production lock was changed.

A subsequent independently authorized release for this same site exposed the
provider's reason:
`Account credit usage exceeded - new deploys are blocked until credits are added`.
See [provider diagnostic job](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44866213576/job/136730718681).
This identifies Netlify's reported account restriction; the actual credit
balance was not read and no billing setting was changed.

Independent checks immediately after the rejection confirmed that the deployment
was still `6b00892b6acd6fc92a18fd20`, ready and locked, with all 50 existing
functions and five schedules. Both isolated BNB database tables remained empty,
and all 31 preexisting public Arcade procedure definitions and privileges had
the same baseline fingerprint. The new BNB function was absent at that stage.
The subsequent successful publication and canonical test are recorded above;
later user-supplied manual observations are recorded below.

The create-deploy request also now omits the undocumented `commit_ref` body
field, matching Netlify's current schema and the proven preservation publishers.
Source identity remains pinned by the existing source/tree, plan, candidate,
browser and remote-main checks. This request cleanup does not resolve the
account-credit restriction. Its 20 focused preservation tests pass.

Complete plan, artifact hashes, source-browser results and post-block audit:
[`bnb-test-auth-publication-blocked-20261120.json`](./bnb-test-auth-publication-blocked-20261120.json).
That historical record remains evidence of the blocked attempt and must never
be reused as approval for a later publication. Do not reapply the migration or
rerun a stale workflow commit against a newer main branch. Gameplay remains denied.

## Endpoint design

Live path: POST /api/arcade-bnb-test on
https://tree-token.xyz only.
All requests require matching Origin, JSON, bounded bodies and no cross-site
Fetch-Metadata. No CORS, no payment and no transactions. Actions: challenge,
sign-in, status, logout and entitlement.

- challenge: creates the exact chain-56 EIP-4361-style message and persists its
  nonce/message hash in an isolated private database. Five-minute expiry.
- sign-in: loads that record by nonce; checks the signed wallet/message using
  viem's chain-56 public client, then atomically consumes the nonce and inserts
  a one-hour *BNB-test-only* session. Raw tokens are only in a Secure, HttpOnly,
  SameSite=Strict, host-only cookie scoped to the endpoint.
- status: reads current token-hash session with expiry/revocation; never grants
  existing Arcade authority.
- logout: revokes only this BNB-test session and clears only its cookie.
- entitlement: always denies gameplay until production original NFT registry,
  backed pass, and fresh ownership checks have been separately audited,
  implemented and deployed. Passing sign-in does not turn on playing.

Stored sessions are chain-qualified and distinct from Sui Arcade and the free
Arborist Trials pilot. Never accept a client-provided nonce record or claimed
ownership as proof. No localStorage tokens. Retired original pass #1 cannot play.

## Release gates

The applied migration supplies durable atomic challenge/session operations and
per-wallet issuance limits. The new endpoint also has an IP/domain rate limit of
60 requests per minute. Neither mechanism grants gameplay authority.

Runtime configuration reads the existing protected
`TREE_KNOWLEDGE_TRIAL_SUPABASE_URL` / `TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY`
pair inside Netlify and pins the URL to this exact Supabase project. This reuses
the database connection only; it never reads existing Arcade sessions or RPCs.
The secret is never extracted, copied to files, logged, or returned publicly.
No environment variable changes are required. Optional
`BNB_TEST_SUPABASE_URL` / `BNB_TEST_SUPABASE_SECRET_KEY` overrides must be a
complete pair for that same project; partial or mismatched overrides fail.

The default BNB endpoint is the official mainnet public endpoint
`https://bsc-dataseed.bnbchain.org`; `BNB_TEST_RPC_URL` may explicitly override
it with an HTTPS endpoint. The verifier checks chain ID 56 before accepting a
signature. No new Sui calls or SDK changes are part of this release.

`scripts/package-bnb-test-auth.mjs` packages only the new handler using the
existing locked dependencies. `scripts/release-bnb-test-auth.mjs` captures the
actual live inventory, creates and checks a complete candidate, preserves
existing backend records/configuration, waits for competing builds to finish,
and switches the lock only to that verified candidate. The one-time baseline
is `6b01217f8e1995306b794031`, with 649 existing static files. The release adds
two page files and one function, for expected totals of 651 files, 51 functions
and the same five schedules. Any baseline drift requires a reviewed update.

Browser checks at 320/390/1440 pixels exercise simulated wallet approval,
rejection, account/network changes and expired sessions. After publication,
`scripts/check-bnb-test-auth-live.mjs` verifies a real login signature, durable
session, replay denial, denied gameplay and logout using a fresh, unfunded
synthetic identity. It submits no chain transaction and never uses the user's
wallet. The synthetic challenge/session records remain as audit history; the
session must be revoked. Peter's actual Brave wallet approval is a separate
manual acceptance check.

The publication workflow requires both `[publish bnb auth]` and
`[skip netlify]` in the reviewed merge commit. Source-only checks and ordinary
pull requests cannot publish the site. Release reports record the exact source,
candidate, complete preserved inventory, browser checks and live API results.

No active production backing registry is approved. Positive BNB-only gameplay,
real scoring, paid USDT continues and public sales are separate stages.

## Manual Brave acceptance

On November 21, Peter supplied the successful sign-in/denial screen and then
the expected no-session screen after the requested logout/status sequence.
[`bnb-manual-sign-in-observations-20261121.json`](./bnb-manual-sign-in-observations-20261121.json)
records the evidence precisely. These images establish the displayed states;
they do not independently show the intermediate active-session status, browser
identity or server-side revocation of Peter's token. The separate synthetic
canonical test verifies its own session's backend logout/replay behavior.

The following remains the full manual test procedure for future releases:

Open the live page in Brave, select BNB Smart Chain, and choose **Connect BNB
wallet**. Choose **Sign a login message** and approve the isolated personal
message in the wallet. Confirm that **Check sign-in status** recognizes the
same wallet, then use **Sign out of this test** and confirm the session is gone.
No token approval, asset transfer, payment or Sui wallet is part of this test.
**Start BNB game** must remain disabled, including after successful sign-in.

## Next read-only backing milestone

The concrete two-chain trial inspector and isolated integration are documented
in [`bnb-backing-check.md`](./bnb-backing-check.md). It observes the actual Sui
Registry/Vault and BNB pass; it does not use the earlier hypothetical EVM
registry callback as proof or approve the retired trial for production play.

This one-time publisher's baseline has now been superseded by its own completed
release. Any future publication needs a fresh reviewed scope and current
inventory; do not blindly rerun it against the new 651-path/51-function site.

Publication guidance refreshed from the live MystenLabs/skills README. This
step adds EVM authentication hosting and makes no Sui technical change, so it
does not require a new Sui skill decision. Applied hosting references:
Netlify `netlify-deploy/SKILL.md`, `netlify-functions/SKILL.md` and
`netlify-config/SKILL.md`; Supabase `supabase/SKILL.md`, the current changelog
and API-key/function-permission documentation. BNB mainnet endpoint verified
against the official JSON-RPC endpoint documentation.

- https://github.com/MystenLabs/skills
- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/getting-started/api-keys
- https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
