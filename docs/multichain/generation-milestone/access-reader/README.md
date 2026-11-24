# Generation backing reader — source only

`contracts/bnb-generation/scripts/generation-access.mjs` implements a separate
read-only assessment of the deployed generation contracts. It does not modify
published BNB authentication, the old trial inspector, game handlers or payments.
No website or chain deployment is included.

The caller supplies a trusted BNB read provider, Sui GraphQL client, wallet and
explicit reviewed generation. These dependencies/policy must come from server
configuration, never browser input. The module does not authenticate the wallet
or authorize a session. `backingEligible` describes only the observed backing;
**`gameplayAuthorized` is always false**, including positive fixtures.

## Evidence checked

- BNB chain 56, fresh block header, pinned deployed pass/adapter/currency and
  messaging runtime hashes, exact security/delegate/library/executor settings.
- Pass/adapter reciprocal bindings, original ID, route, Sui package, controller,
  initial buyer, treasury and currency. Generation is also the ERC-721 token ID.
- Active pass, current owner matching wallet, canPlay and zero redemption/recipient.
  `ownerOf` is queried only for Active state; burned tokens are denied without
  depending on RPC-specific revert decoding. Purchase pause does not revoke an
  already-active pass; contract canPlay and source pause are checked separately.
- Actual typed Sui Registry and Vault, shared ownership, singleton slot, original
  ID/type, source capability, peer, generation and held embedded NFTree #2720.
  Require phase 1, announced, not paused, no acknowledgement or redemption.
- Reviewed Sui libraries/security/registration/metadata and OApp/channel binding.
  UpgradeCap must still refer to reviewed package version 1 and dev owner/policy.
  A change in these governance/configuration expectations requires review.

BNB calls pin a block per snapshot and recheck its hash. Two BNB snapshots bracket
the Sui query; state, owner, generation and redemption must remain unchanged.
Both chains must be within 60 seconds of server time (maximum 30 seconds future
skew); the whole assessment must finish within 30 seconds. Malformed, partial,
stale or unavailable reads fail closed. No automatic retry or transaction occurs.

**Cross-chain snapshots are not atomic.** Transfers/reorgs/mutations can occur
immediately after a read. This result must never be cached as a game capability:
the later server integration must authenticate the session, recheck at every
run/action boundary and define in-flight run/score revocation rules. Data-provider
trust remains an operational dependency; injected clients are not cryptographic
proof against a malicious RPC. No claim of live positive game acceptance is made.

## Tests and live check

Node 24, pinned root and isolated `contracts/bnb-generation` dependencies:

```sh
node --test contracts/bnb-generation/test/generation-access.test.mjs tests/multichain-bnb-game-access.test.mjs
node --use-env-proxy contracts/bnb-generation/scripts/check-generation-access.mjs /tmp/generation-access-live.json
```

All **46 focused tests passed** (36 new reader tests plus 10 access foundation
regressions). Positive tests explicitly synthesize Active generation 2 and held
custody; no deposit/purchase or generation-2 approval exists. Negative cases include
current retired state, wrong identities/bindings/types, upgrade/admin/security
changes, stale checkpoints, held-NFT mismatch, redemption, transfer during the
read, reorgs, changed runtimes, slow reads, missing policy and RPC failure.

`live-denial.json` records successful read-only BNB/Sui responses and the actual
closed generation-1 denial: Retired, empty phase 3, no game permission. This is
not an outage-based denial. The fixed checker rejects a read failure and any
unexpected positive result. Its fixture intentionally uses a fixed recorded
clock for repeatable tests. Hosted contract workflow includes the new tests.

Current Mysten skills README was fetched; accessing-data/SKILL.md and graphql.md
were read. Existing pinned GraphQL and contract interfaces are reused without
SDK or wallet migrations. Main advanced to `297e82d`; unrelated changes were
fetched and preserved, with no reset or production release.

## Remaining milestone

Review this source, then add isolated server-bound sessions/run authorization
and end-to-end tests. Keep authentication distinct from backing assessment and
retain explicit private activation gates. Paid USDT actions, in-flight score
policy, a new deposit/purchase for live positive acceptance, public sales and
tournaments remain separate reviews. The current burned pass cannot play.
