# BNB payment completion verification

November 24, 2026. Source/test milestone; no live changes. Previous CI 45545003234
passed for 4a08e851. The feature worktree started clean; remote updates were
fetched without changing concurrent Treeforce work.

The existing authenticated completion action now handles the `bnb-usdt` source.
It checks the runtime-scoped Sui account/run mapping, an unexpired session for
the payment's Sui wallet, matching started claim and activation, consumed BNB
checkout, exact receipt/payment key, original payment window, delivery record,
and advanced native run counter. Checkout and shared payment terms must match
BNB chain 56, configured USDT, 1 USDT in raw units, existing treasury and payer.
A fresh login from the same Sui wallet can inspect completion. The bound BNB
payer comes from the previously verified checkout, not browser identity input.

Successful responses identify source, checkoutId, txHash, receiptId, payer and
native/shared run references. They never authorize restoration or request another
payment. The query is read-only; it neither burns a receipt nor modifies a claim.
The Sui journal archiver now explicitly requires source=sui-native-tree, preventing
cross-chain response confusion. The BNB journal/client still needs its matching
archive integration; this source change does not silently reuse the Sui journal.

## What the tests prove

The database fixture inserts synthetic verified BNB checkout/receipt rows, then
uses the REAL shared payment loader, prepare/activation logic and BNB settlement
writer. Settlement marks the ledger consumed and advances the native counter
once. A repeated activation cannot restore or consume again. Completion is denied
before consumption and allowed afterward for the owner/fresh same-wallet login.
It rejects foreign wallets, altered amount/payer/network/token/treasury, wrong
native counter, a replaced transaction/payment key and an out-of-window receipt.
The deliberate tampering uses the test owner, not ordinary runtime privileges.
The timestamp restoration fixture preserves PostgreSQL microsecond precision;
round-tripping through JavaScript Date had truncated it and caused a false denial.

Evidence: bnb-completion-tests.json records 83 unit checks, seven Chromium recovery
control checks, 40 Netlify-role database/Phaser checks and 37 original-role checks.
The browser control tests remain injected UI fixtures. The new BNB test performs
actual database settlement, but its verified ledger evidence is synthetic; it
is not a wallet/RPC/mainnet financial test. Completion trusts the ledger's earlier
chain verification/finality checks and does not re-query chain state.

Use the commands in completion.md/recovery-controls.md with NATIVE_BUNDLE_CHECK=1
and CONTINUE_PHASER_CHECK=1. The original-role test now also loads the BNB ledger
schema so both permission models exercise actual settlement. The existing CI
workflow runs these cases; no new dependency or database migration was needed.

Remaining: connect BNB checkout receipt recording and browser journal completion
to this host in an end-to-end wallet flow; complete native UI mounting and
uncertain-cancellation handling; implement operational drain/fencing; review
hosted migration and a preservation release separately. No gameplay, sales,
wallet payment or old trial route was enabled. The historical root site build
must not replace current production.
