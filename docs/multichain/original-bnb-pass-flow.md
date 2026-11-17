# Original NFTree trial: BNB suite-pass creation page

The isolated `/play/multichaintest/original/bnb/pass/` page creates only the
suite-pass contract for the confirmed original-NFT route. It mints no token,
takes no USDT, deposits no NFT and enables no purchases. The user's BNB wallet
ending 83ae signs creation separately; the assistant submits no transaction.

## Fixed creation intent

- BNB mainnet chain 56, intended creator/controller/initial buyer
  `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`.
- Confirmed adapter `0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab`, from receipt
  `0x2bea9fd423d794de83f04c18381dc345ebf008d0a845a425ccb5c919beeca0ca`.
- Actual Vault route `0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`.
- Original package peer `0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4`.
- Original backing NFTree #2720, retained in the Sui dev wallet for this step.
- Constructor: reviewed TreeSuitePass bytecode plus the confirmed adapter address.
- Native transaction value zero. The user pays BNB gas only.

The contract is designed for one transferable suite-pass token after an
authenticated original-NFT reserve. Initial state is Unconfirmed and purchases
are paused. The fixed price is 25 BNB USDT (18 decimals), paid directly to
`0xC440F06BBC7e58b0d055815f915447e4ae0E3720` when a future purchase is allowed.
Deployment does not buy or mint that token. Live Arcade access is not wired by
this page. Binding, LayerZero route verification, NFT deposit and purchase remain
separate steps with separate wallet approvals.

## Validation before each wallet handoff

Reuse the strict published Sui and BNB adapter validators without modifying their
source or bundles. Confirm actual source publication and slot receipts, current
empty/unbound shared Vault, original NFT ownership, dev caps and unchanged OApp/
upgrade settings; confirm the actual adapter receipt, creation input, runtime,
immutable peer/route/binder, unbound pass, initial redemption settings and endpoint
delegate. Independently verify BNB USDT code/18 decimals and EndpointV2 code/EID.
Independent source, adapter and currency reads run concurrently; all must pass
before deployment simulation and signing. No dependency failure requests a
signature. The existing verified public-RPC fallback/parser is reused unchanged.

Verify the current wallet/account/chain, equal latest/pending nonces, empty CREATE
address, exact creation simulation runtime, gas allowance and BNB balance. The
wallet nonce is read fresh, and a changed nonce/fee requires renewed review.
Quotes expire after two minutes. Web Locks and durable pending state guard the
handoff across tabs. Explicit wallet rejection clears pending state; ambiguous
errors, missing hashes and post-handoff storage failures preserve recovery state.
The wallet displays its final fee; the 0.01-BNB estimate ceiling is not a cap on
later wallet fee edits. Browser storage is not a cross-device deployment registry.

Receipt recovery uses the same lock, exact sender/input/value/chain/nonce/CREATE
address, no creation logs (no mint), exact runtime/immutables, and initial getters
for adapter/buyer/controller/route/currency/treasury/price/token/backing/state/
pause/redemption/recipient and zero buyer token balance. Dependencies are read
again. Mismatched receipts cannot clear the stored request. This pass has its own
state key, distinct from the already completed adapter creation.

The pinned compiler AST independently verifies immutable references
870=adapter, 872=initialBuyer, 874=controller and 876=route, then matches exact
creation/runtime code and reference offsets against the reviewed artifact.
Existing contract source, dependency locks and wallet helpers remain unchanged.

## Checks and additive release

The actual unsigned mainnet page preflight is recorded at
`original-trial/bnb-pass-page-preflight.json`. It simulates from the intended
public account; actual extension identity/signature still belongs to the user.
244 focused checks passed, including 15 new suite-pass checks. The 14 EVM contract
tests, pinned artifact/immutable checks and exact browser-bundle comparison run
in dedicated CI as well. No real signature or remote transaction is part of tests.

Capture current locked deploy `6afcb1e59274eb1f9d9a58c7`: 586 static paths,
49 complete backend packages and five schedules. Add exactly the new page's
index.html, app.js and core.js, preserving all 586 existing paths byte for byte,
complete provider/runtime/package identities, schedules and protected environment
fingerprints. Expected static total: 589. Wait for all queued Git builds, validate
the fresh candidate, then publish by locking that candidate. Never replace
production with the historical build or restore an older deployment.

Published binding inputs (`bindings.json`, `slot-bindings.json`,
`adapter-bindings.json`, plus review-only unsigned intents) are frozen snapshots.
Record later confirmations in new files rather than silently breaking exact
source/browser-bundle reproducibility.

## Live Sui guidance

The current MystenLabs/skills README and applicable `accessing-data/SKILL.md` and
`accessing-data/graphql.md` were read for the source receipt/current-state checks.
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md
The pinned SDK GraphQL interface and existing wallet integration are reused.
