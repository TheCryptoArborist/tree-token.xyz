# BNB original-NFT backing check

## Scope and current boundary

This adds a real read-only inspector for the completed original NFTree #2720
trial to the isolated BNB test endpoint and page. It replaces the generic access
denial with a fresh explanation of the observed BNB pass and Sui custody state.
Every response still has `gameplayAuthorized: false`; the inspector also returns
`eligible: false` and `productionReady: false`, even for an Active/held fixture.

The production backing registry is not deployed or approved. The earlier
`verifyBnbGameEntitlement` foundation expects a hypothetical EVM registry. The
actual existing Registry is a Sui object and has no reusable generation field.
This inspector does not manufacture that missing interface or use the one-shot
trial as production authority. A new production custody/generation/pass route
is the next contract milestone before positive gameplay integration.

Source: `scripts/multichain/bnb-backing-reader.mjs`.
Integration: `scripts/multichain/bnb-test-auth-service.mjs` and the separately
packaged `netlify/bnb-test-functions/arcade-bnb-test.mjs`.
UI: `/play/multichaintest/game/bnb/`.

## What is checked

The reader pins the completed trial's package, Registry, typed Vault, OApp,
capabilities, peer field, original NFT, BNB pass, adapter and messaging endpoint.
These are separate identities; a Sui object ID is never treated as an EVM address.

On Sui, the unchanged locked SDK 2.26.1 uses `SuiGrpcClient`. The reader verifies
the mainnet chain identity and fresh checkpoint metadata; exact package bytes,
version and publication identity; capability/upgrade assumptions; object types
and ownership; Registry-to-Vault linkage; OApp and peer bindings; and decoded
custody lifecycle. It parses the exact deployed BCS layouts and requires a
canonical byte-for-byte re-encoding. Actual custody requires the exact NFT value
inside the typed Vault. A missing direct NFT lookup does not prove custody.

All source objects are read again, and their references, owners and bytes must
remain stable. The start/end checkpoints are recorded. This is a bounded,
stable-object observation, not an atomic cross-chain snapshot. The reader does
not depend on deprecated Sui JSON-RPC or use transaction/signing helpers.

On BNB, reads use one finalized block. The pass, adapter and endpoint runtime
hashes are checked at that block. Exact binding, NFT, route, peer, currency,
treasury, price, token ID and lifecycle fields must agree. An Active pass also
requires a fresh `ownerOf` read and matching `canPlay` result. A retired pass is
checked without treating the expected burned-token `ownerOf` revert as an outage.
The block is read again and its hash/timestamp must still match.

The final result distinguishes unfunded, reserve-pending, active-backed,
redemption-pending and retired trial states. The observed completed trial must
be retired/released for publication acceptance. Stale, malformed, inconsistent,
changed or unavailable observations fail closed. The total inspection budget is
20 seconds; source/block timestamps must be recent, and no success is cached as
an authorization decision.

## Session and user interface

The existing `entitlement` action at `/api/arcade-bnb-test` reads the durable
session before invoking the inspector. The session's wallet is supplied by the
server; the browser cannot provide a wallet, policy, registry or proof. After
the chain reads, the server checks the same session again for expiry, revocation
and wallet consistency. This retains the existing path-scoped HttpOnly cookie
and requires no new database functions, migration or environment variables.

A successful observation returns HTTP 403 with the existing
`production-backed-pass-not-enabled` reason and a `backingCheck` report. A failed
read returns a generic HTTP 503. Neither grants gameplay. The page labels the
scope **Original NFTree #2720 trial**, renders fixed plain-language explanations,
and never claims to scan all passes in the connected wallet. Logout, expired
sessions, wallet changes and new checks clear the old result. Late responses
cannot restore a result for a prior wallet/session.

## Validation and publication

- Reader tests cover actual deployed BCS formats, identity/code/binding drift,
  stale/future observations, changing source objects or finalized block,
  transfer/redemption states, unavailable reads, and bounded cancellation.
- Handler tests verify anonymous/forged requests never invoke chain reads and
  logout/expiry during a read discards its result.
- UI tests cover scoped copy, malformed/stale/wrong-wallet reports, logout,
  expiry and late responses. Browser checks use actual page files with a mocked
  wallet/API at 320, 390 and 1440 pixels.
- `node scripts/check-bnb-backing-live.mjs --read-only` inspects both real chains
  without signing or submitting any transaction.
- `--canonical` reuses the existing real-message-signature test with a fresh,
  unfunded synthetic identity. It checks the structured backing report and
  verifies logout/rejection of the stale cookie. Failure paths still revoke the
  synthetic session. Keys, signatures and raw session tokens are not retained.

The separate `publish-bnb-backing.yml` workflow uses the new replacement
publisher. Its initial baseline is `6b01240f1a94cf48c5b89830`: 651 static paths,
51 functions and five schedules. It may replace only the two existing BNB page
files and the isolated BNB function package. The other 649 hashes, all 50 other
complete backend records, schedules and protected configuration remain exact.

Fresh chain evidence is fingerprinted into the release plan, exact source and
candidate assets are reviewed, and all real queued Git builds must finish before
publication. Both `[publish bnb backing]` and `[skip netlify]` are required.
The prior completed additive publisher and its historical evidence are retained.
Do not reuse either completed publisher against a future live baseline.

## Guidance checked live on November 21, 2026

The current [MystenLabs skills README](https://github.com/MystenLabs/skills/blob/main/README.md)
and these applicable files were read before implementation:

- `accessing-data/SKILL.md`, `grpc.md`, `use-cases.md` and `graphql.md`.
- `sui-ts-sdk-backend/SKILL.md` and `bootstrap.md`.
- `object-model/SKILL.md`, `ownership.md` and `transfers.md`.
- `move-security/SKILL.md`, `access-control.md` and `best-practices.md`.

API shapes were checked against the installed SDK 2.26.1 and real responses.
Existing dependency locks and wallet integrations are unchanged. Netlify's
current Functions and Deploy guidance was used for the isolated package/release.
