# Approved first return-message handoff

The user explicitly authorized the reviewed single `send(2)` transaction, capped
at **0.006 BNB total**: native message fee at most 0.0059 BNB and gas at most
0.0001 BNB. No further USDT payment, repeat purchase, acknowledgement, completion,
security change, upgrade, public sale or gameplay activation is included.

Canonical page: `https://tree-token.xyz/play/bnb-return/` (publication pending
until a release record is added). MetaMask + Ledger admin 8789 signs one request,
nonce 4751, to the new adapter. The page refreshes the exact live fee; the fixed
gas limit is 600000, checked against current estimation and the gas/total caps.
The padded review estimate was lower; the larger signing gas limit still fits the
same approved monetary caps. The wallet must not increase reviewed fee limits.

## Verification boundaries

The page first reconciles all five completed private-purchase/lock receipts and
current code/security/Locked state using the existing verifier. It requires the
exact request, 45c4 recipient, source route, original #2720, generation 1 and
receive options. The outbound channel nonce must be zero before signing. Any
existing message or unresolved request blocks another send until receipt recovery.
A changed wallet nonce also stops the sequence. No automatic retries are offered.

The current quote must have zero LZ-token fee. Checked call simulation must return
the exact first GUID/nonce and quote. The browser persists the intent before the
wallet request, verifies canonical source receipts, exact packet/message events,
executor/three-required-verifier fees, and gas/total cost. It rejects altered
calldata, recipients, kinds, payment amounts, GUIDs, options, removed/extra events,
fee-limit increases and missing saved progress. Cross-tab locking, hash recovery,
progress export/restore and read-only RPC fallback reuse the working BNB flow.

The existing GET-only custody endpoint is used **before signing only**. After a
successful source send, the NFT may already have left custody; Check receipts and
Recover hash therefore verify BNB source state/events without requiring it still
to be held. The resulting receipt explicitly says Sui delivery is not checked.
It never infers destination ownership from the source receipt. Return that receipt
to Codex for independent Sui Released/ownership/phase-2 verification. The pass
remains Locked/nonplayable while later acknowledgement/completion await review.

## Evidence and reproduction

The exact browser preflight/send/receipt code passed a no-balance/storage-override
mainnet fork. The remote transport permits reads only; sendTransaction goes only
to local Ganache. Historical canonical block hashes for the five already completed
transactions are read from the remote chain, avoiding Ganache's reconstructed
historical block hashes; the newly simulated receipt is checked against its local
block. `fork.json` records both stages and every read, unsigned request and receipt.

`live-preflight.json` records fresh source custody and actual BNB first-send quote,
nonce/security/Locked-state checks. Browser tests cover eight failure/connection
scenarios plus a complete single-send mock flow, explicitly checking that no
post-send custody query is made. No real wallet or chain submission is used.

From root, with pinned root and isolated BNB dependencies installed, Node 24:

```sh
node tools/bnb-return/build.mjs
node --test tools/bnb-return/*.test.mjs contracts/bnb-generation/test/return-fees.test.mjs tests/bnb-return-release.test.mjs tests/sti-preview-build.test.mjs
node tools/bnb-return/browser-test.mjs
node tools/bnb-return/browser-sequence.mjs
node --use-env-proxy contracts/bnb-generation/scripts/review-return-handoff.mjs /tmp/return-handoff.json
```

The live/local-fork initial preflight intentionally fails once nonce 4751 or the
first outbound message has been consumed. Use saved receipts, never reset progress
and resend. Source fees from the simulation are evidence, not live expenditure.

## Preservation and remaining work

Baseline is newly observed locked `6b045ada195938dd6638275a`, with 59 complete
backend records and five schedules. This release is **static only**: exactly two
new paths, no backend uploads/rebuilds. Every existing static hash, complete
provider/runtime record, schedule and protected setting is compared before and
after publication. Preserve newer unrelated releases and never publish the
historical root build.

Remaining: audit candidate, publish/verify the canonical page, obtain the user's
source signature/receipt, then independently verify Sui delivery. Later Sui burn
acknowledgement and BNB generation completion require fresh reviews. No live
return message has been sent by Codex, and website gameplay remains disabled.

Validation before candidate: all 365 regression/preservation checks passed, plus
eight browser failure/connection scenarios and the complete one-send mock flow.
Fresh live quote is 0.004577084124304116 BNB; at the fixed 600000 gas limit and
current gas price, maximum combined cost is 0.004607084124304116 BNB.
