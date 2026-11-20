# Enable the original-backed one-pass purchase

New isolated page: `/play/multichaintest/original/bnb/enable/`.
This stage only calls `setPurchasesPaused(false)` on the already deployed
original-backed pass `0x1d3da001E586a7DEFD397B77FADB29eD6F039c13` from its
controller/buyer `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`, on BNB mainnet.
Value is zero; only BNB network gas is spent. It mints no token, charges no USDT,
changes no LayerZero configuration, moves no NFT, and enables no live Arcade gate.
The contract restricts the first purchase to this buyer. This is not a public sale.

The original NFTree #2720 is wrapped intact in Sui vault
`0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`.
Actual announcement `97udy89UfnUqZpTynesymkgSLrt3b61o5qZoMTgPUweK` succeeded
and BNB independently reports state Ready. `original-trial/enable-preflight.json`
records a successful unsigned preflight with public RPC observations. The
intended public account is used for simulation, not an installed wallet identity.
No real signature or transaction was submitted by the assistant.

## Fail-closed checks

Reuse unchanged original reserve receipt/state validators, with an in-memory
receipt store, to verify the actual announcement, all prior source receipts,
full original NFT contents/custody, source peer/options, nonce and authority.
Do not use historical empty/unbound-vault validators on the current vault.

At one pinned BNB block verify exact adapter/pass runtime and constructor
immutables, endpoint/USDT/library hashes, all 17 reviewed route/security reads,
Ready state, controller/initial buyer, fixed 25e18 USDT price and treasury, original
NFT/route/peer, no redemption, no minted buyer balance, pause flag and token
18 decimals. Only the old route fixture's Unconfirmed expectation is advanced to
Ready in this NEW stage; no existing helper, fixture or browser bundle changes.

Before signing, simulate the exact no-value unpause call, estimate gas (maximum
100,000), check positive gas price, 0.01-BNB buffered fee ceiling and balance,
equal current/pending nonces, account/chain identity, fresh two-minute quote and
consent/account epoch. Durable pending storage and Web Locks prevent duplicate
handoffs. Explicit rejection clears pending; ambiguous errors or missing hashes
retain recovery state. Wallet final fee edits are outside the simulation ceiling.

Receipt recovery matches exact chain, sender, target, nonce, calldata, zero value,
success, one `PurchasePauseChanged(false)` event and fresh poststate including
unpaused Ready reserve. Account or storage changes during recovery cannot clear
a pending request. Previously enabled purchases block repeat unpause simulation;
recover the existing receipt instead.

## Publication and validation

Do not use the old disposable `setup/bnb/buy/` page: it targets a different pass.
This new page does not include approval or buy calls. After actual enablement is
verified, prepare a distinct exact-25-USDT approval/purchase stage with its own
receipts and ownership/treasury/remaining-allowance checks.

`release-original-enable.mjs` is a separate, additive preservation release. It
captures the actual selected live locked baseline, refuses drift, adds exactly
index.html/app.js/core.js at the new path, and preserves every existing static
path, all 50 complete backend records, five schedules, runtime/configuration,
environment fingerprints and snippets. Existing frozen multichain stages and
other projects remain unchanged. New candidate verification precedes publication;
queued builds block switching. Publication locks only the new candidate, never
restores an older deployment. The current expected baseline must be refreshed if
another site release occurs before publication.

Focused negative tests cover request/receipt/recovery and recorded actual mainnet
reads; the complete multichain preservation suite is run. Browser CI checks 1440,
390 and 320 pixels, module loading, missing-extension feedback, visible connect
and manual recovery, no overflow and blocked signing when disconnected, even with
consent selected. These checks do not establish installed-extension prompt UX or
wallet reputation clearance. No seed phrase, key import or warning bypass.

Current MystenLabs guidance checked live: README.md, accessing-data/SKILL.md and
accessing-data/graphql.md. Existing pinned GraphQL integration is reused; no Sui
JSON-RPC or dependency migration. No new Sui transaction is prepared in this stage.
