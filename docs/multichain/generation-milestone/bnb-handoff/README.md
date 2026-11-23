Current status: **all three transactions complete and independently verified**.
See [completed receipts](../bnb-deployed/README.md). Do not repeat deployment or binding.

# Completed BNB signing handoff

The user approved deploying the new adapter, deploying the new pass, and binding
that pass once, using MetaMask with Ledger account ending 8789. Aggregate fee
ceiling: **0.001 BNB**. Treasury is unchanged. This does not approve NFT deposits,
Sui peer binding, message-path configuration, sales, or gameplay activation.

Signing is restricted to `https://tree-token.xyz/play/bnb-generation/`. The page
uses the user's MetaMask provider; Cloud has no signing keys. It requests exactly
three pinned transactions and never automatically submits the next step. Fee
requests are bounded and receipts are checked against those requests. A user can
manually override wallet fees; do not raise the displayed limits in MetaMask.
Changed fees or transaction content stop further steps when the receipt is read.

The pinned sender nonce is 4739. Predicted adapter:
`0x74c20dEB476Dca58459956b1AcD65771197900C9`; predicted pass:
`0x418cC337FC19D8cf3b41a9C6E3138a60E34Eb9b5`. Both addresses and reciprocal binding are now verified on mainnet.
See `../bnb-deployed/README.md` for completed receipts. If the nonce has changed, stop and prepare a newly reviewed
sequence; do not change the nonce in the wallet. A saved unresolved request blocks
resubmission across reloads. Recover its verified transaction hash before proceeding.
Use one browser; export/import progress to resume elsewhere. Never clear progress
while a submission is unresolved.

`fork.json` records the actual browser core completing all three transactions on a
local fork of BNB block 135188532, with real Endpoint/USDT code, paused purchases,
Unconfirmed state, generation zero and no playable pass. It did not broadcast to
mainnet. Actual local-fork fees were 0.0001740542 BNB. These are historical test
results, not a current gas quote. `dependency-code.json` is the corresponding
read-only runtime fixture. The browser refreshes Sui's existing empty-slot receipt,
BNB bytecode, nonce, account, estimate and fees before signing each step.

## Reproduce

From repository root (Node 24):

```
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node tools/bnb-generation/build.mjs
node --test contracts/bnb-generation/test/*.test.mjs tests/bnb-generation-release.test.mjs
node contracts/bnb-generation/scripts/handoff-browser.mjs
```

The browser script needs Chromium and Playwright; override `CHROMIUM` and
`PLAYWRIGHT_MODULE` for other installations. `browser-tests.json` records five
passed scenarios with a mock provider: complete sequence, explicit rejection,
uncertain submission/reload/hash recovery, wrong account and off-origin blocking.
It does not attest to real MetaMask or Ledger acceptance. The local fork runner
`contracts/bnb-generation/scripts/handoff-fork.mjs` requires network reads; see its
arguments before running. No remote write RPC is allowed by that runner.

## Production preservation and remaining steps

The preserving publisher adds only `/play/bnb-generation/index.html` and `app.js`.
It captures and verifies all existing static paths, 54 complete backend records,
five schedules and protected configuration. It reuses the existing read-only
`generation-slot` endpoint, without rebuilding any backend. It waits for all
queued builds and locks the reviewed candidate. The root historical build must
never replace production.

Published and locked: `6b03a1ca204de42e6892dd3a`; see `publication.json`.
The user signs and returns the three-transaction receipt.
Independently verify those receipts and deployed state, record actual addresses
and fees, and then prepare the next separately reviewed milestone. No deposits,
sales, gameplay activation, or retired trial routes are part of this handoff.

## Historical first-step progress — superseded by completed receipts

Step 1 is complete: transaction
`0x016aa9570de26f1d25d3db2137fa1ef7dbac8e3a2efa1cab45c2e872deafee98`
deployed the reviewed adapter from the selected admin at nonce 4739. Independent
BNB reads verified successful status, exact creation bytes, expected address,
runtime and immutable getters, Endpoint delegate and zero pass binding. Gas fee:
**0.0000795131 BNB**. The pass was not deployed at verification time.
The exact receipt and transaction are in `../bnb-deployed/adapter-receipt.json`.

Next, use Check receipts then Refresh deployment review on the existing canonical
page to deploy the pass. If the browser lost the adapter hash, use Recover hash
with this transaction before continuing. Do not repeat adapter deployment.
Binding follows pass deployment; both remain within the previously approved
three-step sequence and aggregate fee cap.
