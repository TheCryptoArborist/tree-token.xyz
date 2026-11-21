# Isolated BNB-only Tree Force '89 authentication — server foundation

The isolated server source and schema are merged through PR #268. Migration
`20261120193912_arcade_bnb_test_auth.sql` was applied to the existing project
`lehswszuekjqottolmsf` and verified before publication preparation. The two
private tables have RLS, and the five public RPCs allow execution only by the
server role (plus database owner). The transactional smoke test passed and was
rolled back. Existing Arcade procedure definitions and privileges were preserved.

The endpoint is not live until the separate publication workflow completes.
The handler remains outside Netlify's historical production functions directory
and is packaged alone. Publication must preserve all 50 existing function
package/provider/runtime records, five schedules and all current static files.

## Endpoint design

Path after verified publication: POST /api/arcade-bnb-test on
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
is `6b00892b6acd6fc92a18fd20`, with 649 existing static files. The release adds
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
