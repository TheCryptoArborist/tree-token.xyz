# Isolated BNB-only Tree Force '89 authentication — server foundation

This stage adds server source but **no live endpoint, hosted migration, production
function or game access**. It is intentionally outside Netlify's configured
production functions directory. Existing Sui authentication, arcade services,
payments, 50 function package identities and five schedules remain unchanged.

## Endpoint design

Future path: POST /api/arcade-bnb-test on https://tree-token.xyz only.
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

Implement, test and apply a separate migration for durable atomic challenge,
session and rate-limiting RPCs; prove execute privileges are service-role only.
Configure BNB_TEST_SUPABASE_URL, BNB_TEST_SUPABASE_SECRET_KEY and BNB_TEST_RPC_URL
as Functions-scoped server environment variables, never in static public files.
An isolated approved Netlify function package must be added without rebuilding
or changing the existing complete 50 backend records or five schedules. Use a
fresh locked production baseline (not the historical root manifest). Browser
reviews at 320/390/1440 pixels and actual EVM wallet flow are still required.

No active production backing registry is approved. Positive BNB-only gameplay,
real scoring, paid USDT continues and public sales are separate stages.

Guidance consulted November 20, 2026: live MystenLabs/skills README and
accessing-data/SKILL.md, frontend-apps/SKILL.md, move-security/SKILL.md;
Supabase documentation on function permissions/RLS and November changelog;
Netlify functions guidance. JSON-RPC on Sui is deprecated; this stage uses no
new Sui reads and introduces no deprecated Sui calls.
