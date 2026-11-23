# Approved private purchase and redemption-lock handoff

The user approved the reviewed five actions by replying “Proceed with the next
step” to the explicit 25-USDT + 0.0001-BNB proposal. This authorizes the private
purchase and lock only: exact approval, unpause, buy generation 1, re-pause, lock
to dev Sui 45c4. It does not authorize the return message, acknowledgement,
completion, public sales, upgrades, changes to security or gameplay activation.

Canonical page: `https://tree-token.xyz/play/bnb-purchase/` (publication pending
until recorded below). MetaMask + Ledger account ends 8789. The 25 USDT goes to
the unchanged treasury ending 3720; redemption does not refund it. The original
stays in custody until a separately reviewed return message is delivered.

## Fixed intent and recovery

`purchase-pinned.json` pins the five calls, nonce 4746 onward, exact contract and
currency runtime hashes, Sui source digest, redemption recipient/request, fixed
gas limits and total 100000000000000-wei gas ceiling. Existing allowance must be
zero; the sole approval is 25000000000000000000 units to the new pass. Each receipt
is matched to exact transaction content, canonical block, fee limits and events.
The purchase receipt must prove the exact treasury transfer and correct mint.
An approval consumed by the purchase leaves zero allowance. A preexisting changed
allowance or nonce causes a stop, not an extra transaction or automatic reset.

The browser independently reads all BNB intermediate states and the final locked
state, pinned code/security and reciprocal bindings. Paid fees plus maximum
remaining fees must stay inside the approved cap before every request. The
initial conservative maximum at 50,000,000 wei gas price is 0.0000255 BNB; fresh
quotes are required. A request is persisted before invoking MetaMask, and an
uncertain outcome prevents a repeated send until hash recovery. Progress export,
restore, cross-tab locking and read-only RPC fallback reuse the working BNB flow.

The GET-only `generation-purchase-custody` service checks the exact completed Sui
source transaction and current phase-1 custody/security. It deliberately leaves
BNB state checks to the browser because BNB changes during the five steps. It
accepts no transaction, signature, digest override or write input. It does not
reuse the reserve verifier's pending/Ready-only BNB predicate after purchase.
Sui queries reuse the pinned GraphQL SDK. Current Mysten README and accessing-data
skill/GraphQL reference were refreshed and read before this integration.

Pausing purchases does not invalidate an Active pass: canPlay is true after buy
until redemption lock, including the re-paused interval. The existing website
policy remains disabled throughout. If interrupted, reconcile the known receipt
and continue the approved sequence; do not repeat the purchase or assert that
pause alone makes it nonplayable. The final receipt is Locked, generation 1,
paused, no residual allowance, and canPlay false.

## Verification

A no-balance/storage-override mainnet fork executed the same browser `prepare`,
request checks and receipt reconciliation across all six observed states (initial
plus five actions). Local cost was 0.00001482515 BNB. `fork.json` stores read RPCs,
reviewed requests, intermediate states and local receipts. No wallet key or remote
submission was used. The remote transport permits reads only.

Focused tests reject changed sender/recipient/allowance/chain/nonce/fees, missing
or duplicate receipts, failed transactions, changed treasury transfer, unexpected
allowance, cumulative overspend and unresolved requests. Browser tests cover
connection, wrong account, rejection, uncertainty, reload, review expiry, RPC
fallback and off-origin rejection. A separate browser test completes all five
mock requests, checking their exact contents and final receipt.

From repository root, Node 24 with the pinned lock files:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node tools/bnb-purchase/build.mjs
node --test tools/bnb-purchase/*.test.mjs tests/bnb-purchase-release.test.mjs tests/sti-preview-build.test.mjs
node tools/bnb-purchase/browser-test.mjs
node tools/bnb-purchase/browser-sequence.mjs
node --use-env-proxy contracts/bnb-generation/scripts/review-purchase-handoff.mjs /tmp/purchase-handoff.json
```

Run the local fork only while the live state is still Ready and nonce 4746 is
unused. Historical fixtures remain useful after user execution, but current-state
preflight must reject completed steps when saved receipts are missing.

## Preservation and remaining work

Preparation pins newly observed locked baseline `6b03da694fbbb07f59b07001`,
58 complete backend records and five schedules. The release captures every
existing static hash and provider/runtime/protected setting, adding only two
new page files and one GET-only service. Never publish the historical root build.

Remaining: prepare/audit preserved candidate, publish and verify canonical bytes
and API, then user signs five separate MetaMask/Ledger requests. Independently
reconcile their final receipts before quoting the return message. No real private
purchase or redemption lock has been submitted by Codex.

Validation before candidate: 336 regression/preservation checks passed; eight
browser failure/connection scenarios and the full five-step mock flow passed.
