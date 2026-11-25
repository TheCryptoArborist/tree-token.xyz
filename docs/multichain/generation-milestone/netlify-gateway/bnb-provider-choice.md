# Explicit BNB wallet selection candidate

November 25, 2026 (America/Chicago). Source-only; no live route changed.

The offline native gateway candidate now accepts `bnbReviewEnabled=false` as an
opt-in provider-picker flag. Existing callers leave it false. When explicitly
set, an open checkout with no pending Sui payment displays EIP-6963 wallet choices.
Selecting an announced wallet requests accounts from that exact provider, checks
its authorized account and chain 56, then passes it into the existing review
assembly. Sui checkout remains default until successful selection. Pending Sui
payments always use their original recovery path. Closing checkout removes the
picker and clears its selection. No app root enables this flag in this milestone.

The picker never reads window.ethereum or trusts isMetaMask. Announced names are
untrusted text, icons/HTML are not loaded, UUID collisions cannot replace the
first provider, duplicate provider objects are ignored, and the list is bounded.
No connection request is made during discovery. Only a click requests accounts;
wrong-network users are told to select BNB Smart Chain manually. There is no
network-add/switch, signature, token approval or transaction-send method here.
An account/network/disconnect event clears selection; reselection is explicit.
Cancellation/provider errors display generic text without leaking provider details.
Teardown removes listeners even while a connection request remains unanswered.

Wallet availability requires EIP-6963 announcements; no silent legacy injection
fallback is included. Extension labels are not authentication. Actual wallet
message signatures and the server's native-session checks remain authoritative.
The picker permits returning to the existing Sui checkout when selection clears;
BNB review still has no payment button, so this is not cross-payment coordination
for an activated payment flow.

## Validation

```sh
node --test tests/multichain-native-bnb-entry.test.mjs tests/multichain-bnb-native-host-options.test.mjs tests/multichain-bnb-review-wallets.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-bnb-provider-picker-browser.mjs
```

Use the existing pinned browser test setup. Passed 20 unit/compiled-source tests
and six new Chromium checks with injected EIP-6963/EIP-1193 fixtures. Coverage
includes label injection/deduplication, no automatic connection, cancellation,
wrong chain, explicit success, account-change invalidation and pending-request
teardown. No actual extension or chain call was exercised. Evidence:
`bnb-provider-choice-tests.json`. CI includes the new browser checks.

The generator emits both hash-checked native TSX candidates and seven browser
modules into a fresh directory. It never applies over a checkout or publishes.
Remaining gates: current native source-to-live parity, separately reviewed canonical
review publication and Slush/MetaMask/Ledger tests, production checkpoint evidence,
cross-payment coordination, expired-session BNB recovery, migration/drain and
production inventory preservation. No NFT movement, payment or gameplay activation
is authorized by this candidate. Individual artwork and one-to-one custody remain
unchanged requirements.
