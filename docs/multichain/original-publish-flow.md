# Original-NFT trial publication flow

Canonical isolated page: `/play/multichaintest/original/`. This step publishes
only the reviewed two-module package from the Sui dev wallet ending 45c4.
The original collection, its capabilities and NFTree #2720 are not inputs.
The package starts with an empty Registry and no funded Vault. BNB deployment,
deposit, reserve announcement and sales are not available on this page.

For this bounded one-NFT trial, retain the new compatible UpgradeCap in the
existing dedicated dev wallet. Do not burn it or impose an irreversible policy
without a separate decision. The page and checkbox disclose that its holder can
change package behavior. The trial is not immutable and is not ready for public
sales. Before real funding, recheck cap custody and finish the route verification
below. Current source exposes no admin withdrawal, but compatible upgrade
authority remains a material trust assumption.

The browser core independently pins module hashes, exact publication commands,
dependencies and dev capability recipient. It verifies the genesis chain identity
and current dev ownership/type of #2720, then runs fresh unsigned mainnet
simulation through the pinned Sui 2.26.1 GraphQL SDK. Only publication-created
objects, transient init objects, dev-owned SUI gas objects and sender address-gas
accounting are permitted. Exact balance effects allow only the dev's SUI gas
cost. No original NFT, stablecoin or original collection capability may change.

The wallet receives an unbuilt Transaction with no app-selected gas objects,
budget or price. Reflight runs before handoff. Wallet/network/account epoch,
review state and 2-minute quote freshness are checked; a changed gas estimate
requires another review. Estimated net gas above 0.2 SUI blocks handoff. Wallet
final gas budget may differ and must be reviewed in Slush.

The new page reuses the already tested Slush extension vendor bundle byte for
byte. It does not enable the hosted Slush sign-in option, change lobby sign-in or
migrate website dependencies. There is a visible connect/choose-wallet flow and
extension help. Pending state is persisted before wallet handoff, protected by
Web Locks and storage events. Explicit wallet rejection or confirmed failed
execution clears pending; unknown responses stay blocked. Receipt lookup stays
available while pending and shares the same cross-tab lock. It verifies exact
on-chain publication effects before saving actual IDs. An unrelated receipt
cannot clear the guard. A missing digest requires checking wallet activity;
there is no unsafe reset-pending button.

14 new flow tests cover exact intent, simulation, wrong wallet/network, stale
quotes, changed estimate/account, concurrency, ambiguous returns, storage failure,
rejections and receipt recovery. 201 focused regressions passed, including the
byte-exact production snapshot and the separate preview build. The full new
browser preflight passed on mainnet at 63,750,000 MIST (0.06375 SUI), unsigned;
IDs in `original-publish-browser-preflight.json` are simulation-only.
CI rebuilds the browser core from locked dependencies and compares its exact
bytes. The reviewed Move and BNB production contract artifacts are unchanged.

## After the user signs publication

1. Verify the actual Sui receipt, module bytes, package original identity and
   Registry/OApp/AdminCap/UpgradeCap ownership. Record actual published IDs.
2. Create the one canonical-type slot from the Registry with the bound admin
   capability. Verify the shared Vault ID and empty phase. Creating a slot does
   not deposit the original NFT.
3. Deploy the BNB adapter from the designated BNB buyer using the actual Sui
   package CallCap identity as peer and actual Vault ID as route. Deploy/bind the
   matching pass; verify runtime templates/immutables, chain 56, USDT, 25-unit
   price, treasury and controller. Keep purchases paused.
4. Build fresh generic receive metadata for `vault::lz_receive<ORIGINAL_NFT_TYPE>`.
   It needs the actual Vault and OApp objects and the endpoint's typed Call ID.
   The old disposable metadata has no type argument and targets `bridge`, so it
   cannot be copied. Recompute/verify metadata round trip and worker dispatch.
5. Register/configure the new route on Sui and BNB. Verify actual endpoint, peers,
   send/receive libraries, executor, message size, gas options, required three-DVN
   set and both confirmation policies. The original package peer and shared OApp
   object are different identities. Existing pilot configuration does not prove
   configuration of a new adapter or package.
6. Refresh #2720 owner/version/digest and simulate the exact deposit. Check the
   generic wrapper owner, one backing ID, phase and route before requesting its
   separate signature. Do not fund based on a nonzero peer alone.
7. Simulate/send one reserve, verify real DVN delivery before unpausing the trial
   sale; then test exact 25-USDT treasury payment, transfer/access and redemption.

No real source publication can be performed by the assistant: the user's Slush
approval provides the signature. No original NFT may be funded during this first
publication. Collection-wide admission remains blocked by the 18 unreconciled
serials; the exact dev-owned #2720 object is the only backing candidate.

Live MystenLabs/skills README checked on 2026-11-17. Relevant files read:
`sui-publish/SKILL.md`, `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`,
`frontend-apps/transactions.md`, `ptbs/SKILL.md`, `ptbs/building.md`,
`ptbs/commands.md`, `accessing-data/SKILL.md`, `accessing-data/graphql.md`,
`move-security/SKILL.md`, and `move-security/best-practices.md`. API guidance was
checked against pinned SDK source; the new flow preserves existing wallet code.
