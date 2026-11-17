# Original NFTree integration review — BNB first

Status: read-only preparation. The disposable Sui–BNB round trip is complete. No original NFT, collection authority, production contract, backend or live page was changed by this review.

## What was verified

The canonical NFT type is `0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT`. Its abilities are KEY and STORE, so a separate Move package can accept, hold and return an existing NFT without modifying the collection. The current package lookup resolves version 5 at `0x79459345a7abde29c4763c97c65f8f48b9e9878dc077ea7ab57c0ad7d585c736`; type origin remains the original package. The resolved package and bytecode must be pinned and rechecked before constructing collection calls.

MintConfig admin is already the designated Sui dev wallet `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`. That wallet holds the collection MintCap and matching version-5 UpgradeCap. Funding a separate vault with a directly owned NFT needs neither capability. No admin rotation, minting, burning or original-package upgrade is proposed.

The three configured sales pools contain 1,071 + 863 + 900 = 2,834 existing original NFTs in this observation. A complete on-chain Pool scan also found a fourth pool, `0xfa7b71037b2a8a6bbe36b6cfbccca629f698c767aeb9dad603a0c655adf4de2a`, containing 727. Total observed pool inventory is **3,561**, plus **1,421** separately queryable NFTs (1,197 address-owned and 224 object-owned): **4,982** unique current IDs and serials. All four pool IDs were read; the existing website’s three-pool configuration was not changed.

A complete 29-page current NFT scan did not account for these 18 serials: 2503, 2504, 2513, 2523, 4800–4806, 4991–4996, 5000. This is an inventory reconciliation gap, not evidence that assets were lost. Full 5,000-inventory approval stays blocked pending historical mint/burn/wrapping reconciliation. The proposed one-NFT candidate is independently verified and does not depend on assuming the missing serials are available.

Sampled earliest/latest burn calls confirm historical NFT destruction, including serials that now have different current object IDs. Those samples do not explain the 18 absent serials and are not a full burn-history audit. Serial numbers and artwork names are therefore not immutable identity: production admission must pin actual object IDs, and any future replacement ID needs explicit inventory review. `admin_transfer_from_pool` checks MintConfig.admin against the signer and transfers a selected existing NFT to a nonzero address. It returns no NFT value, so it cannot simply feed a returned NFT into the next PTB command. A future pool-funding path must either use a separately confirmed withdrawal to the dev wallet or explicitly implement and test Receiving<NFT> for transfer-to-object. Do not transfer to a vault address without a tested receive path.

A simpler proposed first funding candidate is **Common NFTree #2720**, `0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba`, already directly owned by the dev wallet. Selection is a review proposal only; it has not been moved or reserved. Ownership and object reference must be refreshed before simulation/signing.

The inspected mint implementation remains capability-controlled and does not itself enforce a hard 5,000 counter. Therefore, type matching and an integer pass cap alone do not establish membership in the original 5,000. Production custody must accept only IDs from the reviewed original inventory, using an immutable allowlist or independently verified Merkle membership. The saved SHA-256 inventory fingerprint is an audit reference, **not** a Merkle root or deposit authorization. Do not mint replacement NFTrees to fund foreign passes.

## Recommended production boundary

Use new production contracts and new LayerZero routes. Preserve the completed disposable pilot as evidence; its single-NFT, one-lifecycle contracts cannot be treated as a multi-NFT public-sale deployment. Existing pilot peers, protocol bytecode and routes are not upgraded or repurposed.

Start with a one-NFT allowlist/cap using the proposed dev-owned Common NFT. A Sui registry binds `(original NFT ID, reservation generation)` to exactly one destination chain, adapter and foreign token ID. Foreign passes are transferable suite access rights backed by that NFT, not additional original NFTrees. Opening Base or another chain consumes the same global backing inventory; there is no independent 5,000-pass allocation per chain.

Required lifecycle:

1. The owner deposits an approved original NFT into typed custody. Custody and registry allocation happen atomically. Announce only an actual, uniquely allocated backing record.
2. After authenticated reserve delivery, BNB allows one purchase for **25 USDT** to `0xc440f06bbc7e58b0d055815f915447e4ae0e3720`. Verify the existing BNB USDT address, 18 decimals and exact transferred amount. No public checkout is enabled in this review.
3. The current pass owner can play, transfer/resell, or start redemption. Redemption locks the pass, stops access and resale, and fixes the Sui recipient in the authenticated request.
4. Only the configured LayerZero path may release the exact backing NFT to that recipient. Identical retries are idempotent; changed recipient/request/route/generation must fail.
5. The release acknowledgement retires/burns the locked pass. Reallocation or another generation requires verified completion of the prior lifecycle. A late old message cannot affect a later allocation.

Across all chains, one original NFT may back at most one live or pending foreign entitlement. Pending redemption remains allocated; no timeout may unlock the pass or reassign the NFT while an authenticated release could still arrive. A pause may stop new allocations/sales but must not become an arbitrary admin withdrawal route or strand valid redemption completion. Lost/delayed messages use authenticated retries and explicit reconciliation. Refund, cancellation, upgrade governance and recovery require separate tests before public sales.

## Tree Force ’89 and suite access

The current canonical game bundle uses `/play/treeforce89/api/tree-challenge`, `tree-session`, `tree-run`, `tree-logout` and `treeforce89-leaderboard`. Its sign-in message explicitly says `sui:mainnet`; it has no EVM account request or BNB USDT checkout. The existing Sui+EVM wallet-link handler still requires current Sui NFT ownership, so it is not sufficient for a BNB-only buyer.

Add an isolated BNB authentication path with origin/domain, chain 56, wallet, purpose, single-use nonce and expiry bound into the signed challenge. Server-side authorization must check the approved production pass contract, current owner, active/playable state and verified backing registry. An RPC error is an unavailable check, never free access. A retired disposable pilot pass must never grant suite access.

Keep session identity chain-qualified. Recheck ownership/playability when creating a run and before paid actions, invalidate prior-owner access after transfer/redemption, and define a bounded in-run revalidation policy. Keep source/destination confirmations distinct. A browser localStorage flag, pasted hash or payment receipt alone cannot grant access. A BNB-only player must not need a Sui wallet to buy or play; choosing a Sui recipient is needed only for redemption.

First isolated integration: Tree Force ’89 at a dedicated test path with new checkout/access APIs. Preserve existing Sui sign-in, NFT gates, TREE payments, leaderboard and score/wave behavior. In-game BNB payments use USDT; the agreed nominal one-dollar action price and replay-resistant receipt binding need a separate implementation review. Suite rights and each game's access integration are separate milestones; tournament eligibility remains unchanged until explicitly integrated.

## Acceptance before signing or live activation

- For the first trial, admission is restricted to the exact verified candidate ID and a global capacity of one. Full-collection admission additionally requires reconciling the 18 absent serials and approving the complete original-ID catalog. Duplicate IDs/serials, unknown pools, changed package/admin, partial pagination and wrong ownership fail closed.
- New typed custody and registry compile and pass real Move tests with the exact deployed collection type; cross-chain contracts pass purchase, transfer, release, acknowledgement and recovery tests.
- Test duplicate allocation across chains, stale generations, wrong peer/recipient, replay, malformed payloads, underpayment, changed decimals/contract, unauthorized admin and transfer-after-session behavior.
- Simulate publication and the single candidate deposit against refreshed mainnet state. Present exact assets, object IDs, capability effects and fees before the user signs in their wallet.
- User signs deployment and at most one original-NFT funding transaction only after reviewing the concrete simulation. Public sales and larger inventory stay closed during that trial.
- Any website release captures current production inventory and preserves all existing static files, 49 backend packages, five schedules and runtime/environment records. This review does not deploy website files.

## Evidence and guidance

`onchain-readiness.json` records current package identity, abilities, public signatures, admin/capabilities and the proposed candidate. `collection-v5.dis` records the actual on-chain disassembly. `inventory.json` records the paginated holder objects plus configured pool inventory; `inventory-audit.json` records independent uniqueness and membership checks. Pagination observations are not claimed to be an atomic multi-request snapshot; material movement during collection requires reconciliation and fresh reads before any funding.

Current MystenLabs/skills README, `object-model/SKILL.md`, `object-model/transfers.md`, `kiosk/SKILL.md`, `kiosk/core.md`, `move-security/SKILL.md`, `move-security/access-control.md`, `move-security/best-practices.md`, `accessing-data/SKILL.md` and `accessing-data/graphql.md` were read live for this review. Kiosk-locked/listed NFTs require separate handling and are excluded from the first directly owned candidate path.
