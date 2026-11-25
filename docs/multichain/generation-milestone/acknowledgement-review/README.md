# First burn acknowledgement review — November 23, 2026

Prepared, simulated and tested; **not approved for live submission and not sent**.
The proposed next action is one new Sui vault `send(3)` from dev wallet 45c4.
The original NFTree #2720 remains in that wallet and is not a transaction input.
Its authenticated BNB delivery acknowledges redemption and burns the locked pass.
BNB kind-4 completion is a separate later review.

## Proposed authorization

One acknowledgement only, maximum **0.2 SUI total**: **0.15 SUI message fee**
and **0.05 SUI gas budget**. Current quote is **0.094851295 SUI**, simulated net
gas **0.005041162 SUI**, estimated net total **0.099892457 SUI**. Gross simulated
gas before storage rebate is **0.0166604 SUI**. Quote plus full gas budget is
**0.144851295 SUI** at this quote. Refresh state, quote and simulation before any
signature; exact paid fee is the fresh quote, not the maximum. No USDT, NFT deposit,
security change, public sale or gameplay activation is included.

This is a new Sui fee after the separately approved BNB return send; explicit
approval of this concrete spend remains pending. A later signing page must use
`https://tree-token.xyz/play/` and desktop Slush, never a preview hostname. No
website or deployment changes are included in this review.

## Verified scope and evidence

The current Sui vault is phase 2/generation 1 with no NFT and ack_sent false.
Current identity/ownership checks confirm original #2720 in dev wallet 45c4.
Current code/configuration and original ownership are reread after simulation.
The existing BNB source receipt/security verifier independently confirms the
new pass is still Locked/nonplayable with purchases paused and outbound nonce 1.
`bnb-receive-simulation.json` stores its fresh proof and read-only RPC reads.

The transaction reuses the already-tested protocol template, changes only the
kind to 3, and withdraws the exact native fee from the sender's address balance.
Pinned command/input checks reject a changed kind even if both supplied review
shapes are altered together. The checked simulation verifies:

- New outbound nonce **2**, generation **1**, exact original, vault, request and
  dev recipient. GUID `0x08156a875c94a547e7bdb2cb5e5720e26d97795abf35a82499cfc7b116b78341`.
- Exact wire-v3 acknowledgement packet and unchanged receive options/security.
- Executor and all three required verifier payees, positive fees summing exactly
  to the quote, and complete native balance changes.
- Only the expected vault/OApp/channel/path mutations; the vault changes only
  ack_sent to true. No original NFT or admin-capability effect.

A read-only BNB `eth_call` models the exact authenticated endpoint invocation;
its receiver gas estimate is **98,370**, below configured **200,000**. An ordinary
admin caller is rejected. This is not a live endpoint delivery or burn, nor proof
of future verifier/executor completion. Actual source receipt, BNB packet delivery,
RedemptionFinalized/Transfer-to-zero events, Retired state and nonexistent token ownership
must be independently verified after the user signs.

All **42 checks passed**: 14 acknowledgement verifier/builder cases, 12 existing
reserve verifier regressions, and 16 BNB lifecycle tests. BNB tests cover exact
locked-generation/request/recipient burn, duplicate acknowledgement safety,
stale messages, unauthorized calls, transfers and nonplayability. Two additional
checked Sui negative simulations reject reserve kind 1 in the released state
(vault payload abort 5) and underpayment (messaging_channel split_fee abort 2).

## Reproduce in Codex Cloud

Use the existing isolated feature worktree and pinned dependencies (Node 24):

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --use-env-proxy contracts/nftree-generation/scripts/prepare-acknowledgement-review.mjs /tmp/ack-review
node --use-env-proxy contracts/bnb-generation/scripts/review-acknowledgement-receive.mjs /tmp/ack-bnb.json
node --use-env-proxy contracts/nftree-generation/scripts/acknowledgement-negative.mjs /tmp/ack-negative.json
node --test contracts/nftree-generation/scripts/acknowledgement-review.test.mjs contracts/nftree-generation/scripts/reserve-review.test.mjs
(cd contracts/bnb-generation && node --test test/pass.test.mjs)
```

Network-enabled Node requires `--use-env-proxy` in this workspace. No keypair,
wallet signing, transaction execution or remote write is used. The BNB test suite
uses local contracts. MystenLabs/skills README and ptbs/SKILL.md, building.md,
commands.md and fundamentals.md were fetched/read before implementation, with
API details checked against the pinned SDK. Existing fixed gas ceilings/address
balance payment preserve this project's review workflow; no SDK migration.

## Remaining work

Obtain the new fee authorization, then prepare and test the canonical signing
handoff with a newly captured complete production baseline. After one signature,
verify source send and actual BNB burn separately. Do not resend based on delayed
indexing. Review BNB completion afterward to close generation 1 on Sui. Keep the
old trial retired and purchases/gameplay disabled.

Hosted CI run **45217948440** passed on source `5cd2114`, including unsigned
guards, 16 EVM and 52 Move lifecycle tests, and both release builds.
