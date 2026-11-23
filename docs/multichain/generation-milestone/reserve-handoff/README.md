# Approved atomic deposit and reserve handoff

The user's “Proceed with the next step” following the explicit 0.35-SUI
proposal approves one deposit of original NFTree #2720 plus its reserve
announcement in the same Sui transaction. It does not authorize USDT spending,
unpausing purchases, redemption, sales or gameplay. Previous review-only notes
are historical; this document records the approved preparation scope.

The browser handoff is restricted to `https://tree-token.xyz/play/generation-reserve/`.
Published and locked deployment `6b03d785177d7651c28d69aa` is recorded in
`release.json`. No source transaction
has been submitted by Codex. The user must review and sign in desktop Slush using
the approved dev account ending 45c4.

## Reviewed transaction

Fresh mainnet simulation rechecks original NFT identity, owner and object
reference, the empty bound vault, security configuration, and the paused BNB
pass. Source fund and send are atomic. A failed source transaction rolls back the
deposit; a successful source send with delayed delivery leaves the NFT in custody.
There is no direct admin withdrawal. Later private purchase/redemption and their
fees require separate reviews, as described in `../delivery-review/README.md`.

The dev wallet holds an address balance. The signing transaction explicitly
withdraws exactly the quoted native message fee with `FundsWithdrawal` and
`coin::redeem_funds<SUI>`, and pays gas from address balance with an empty gas coin
list. It does not reuse synthetic gas objects selected by a simulator. Both
simulations run with checks enabled and gas selection disabled. Current evidence:

- Message fee: 102798531 MIST (0.102798531 SUI).
- Net gas estimate: 3992655 MIST (0.003992655 SUI).
- Estimated total: 106791186 MIST (0.106791186 SUI).
- Hard limits: 250000000 MIST message fee and 100000000 MIST gas.
- No USDT transfer or allowance is in this transaction.

`simulation.json` is unsigned evidence, never a reusable approval. Refresh the
review before signing. The browser reconstructs exact commands/references and
checks checked-simulation bytes, effects, payees, custody, account, chain and
expiry. It saves the digest before submission and uses a cross-tab signing lock.
A source receipt separately reports `destinationVerified`; pending BNB delivery
must never cause an automatic resend. The destination verifier requires either
Unconfirmed/generation 0/no recorded message, or Ready/generation 1/the exact
payload hash, with purchases paused and canPlay false in both cases.

## Reproduce

From repository root, Node 24 with pinned dependencies (`npm ci --ignore-scripts`):

```sh
node tools/generation-reserve/build.mjs
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-publication/core.test.mjs tools/generation-slot/*.test.mjs tools/generation-registration/*.test.mjs tools/generation-configuration/*.test.mjs tools/generation-binding/*.test.mjs tools/generation-reserve/*.test.mjs tests/generation-reserve-release.test.mjs tests/sti-preview-build.test.mjs
node tools/generation-reserve/browser-test.mjs
```

All 299 tests passed. Eight browser scenarios passed with mocked wallets and zero
chain submissions: account returned before getter updates, rejection, wrong
account, stale review, desktop clock skew, changed signed bytes, pending receipt,
and off-origin signing rejection. `browser-source.json` records those results.
These checks do not establish live cross-chain delivery.

## Release and remaining work

The preservation release starts from freshly observed locked deployment
`6b03d4e9938b4d8d124cfdaf`, including its newer Canopy Defense update. It adds only
two new static paths and one GET-only service. The release script captures and
compares every existing static hash, all 57 complete backend/provider records,
five schedules and protected/runtime settings. It waits for all Git builds before
publication. Never publish the historical root build.

Candidate and publication runs passed. Independent complete backend/schedule
comparison passed. Canonical JS bytes and fresh simulation review passed; all
eight browser scenarios passed against source, candidate and canonical assets.
Hosted CI also passed 52 Move and 16 EVM lifecycle tests. See `release.json` for
source/control commits, workflow runs and durable artifact digests.

Remaining: obtain the user's signed source receipt, then
independently confirm source custody and destination Ready state. Do not activate
purchases or gameplay. If delivery is delayed, diagnose the original GUID instead
of sending another reserve. Subsequent private purchase/redemption is separate.
