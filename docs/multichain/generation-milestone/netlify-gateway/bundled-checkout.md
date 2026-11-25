# Bundled native offer and separate shared checkout

November 24, 2026. Source/test milestone, no live changes. Prior CI 45542398111
passed for 5a0efcd4. Concurrent audit/treeforce-inventory-20261125 advanced to
a94ca6ea; it was fetched and preserved, not merged or published over.

The old Sui checkout expects immediate restoration from native redemption.
It cannot be silently redirected to a receipt-recording response. The new
`browser/shared-native-checkout.mjs` is a separate opt-in adapter using the pinned
native offer validator and transaction builder. It reviews an offer, saves a
recovery marker before signing, records the returned digest, and provides explicit
reconciliation. It never restores a game, automatically retries signing, or calls
the legacy redeem endpoint. Existing native checkout/UI files remain unchanged.

Supply the canonical transport, existing Transaction/signAndExecute adapters,
a current native session getter, durable storage and Web Locks. Use storage
shared across tabs for the new journal; check the existing legacy sessionStorage
pending key as well when wiring a real browser storage adapter. The injected test
storage holds both namespaces, whereas the production legacy client currently
uses sessionStorage. Do not assume localStorage alone can discover that legacy
marker. Production UI wiring must read both stores before enabling pay.

The journal is scoped to the original wallet and serializes concurrent payment
attempts. Unknown signing outcomes, storage trouble after submission and rejected
requests retain the marker for review. No automatic discard/clear flow exists.
A known digest can be reconciled without another signature; a missing digest
requires a separately reviewed recovery path. Successful recording retains the
marker until a future verified completion/archive flow is implemented. This is
intentionally not yet a public checkout UX.

## Bundled integration evidence

`load-native-continue-test-bundle.mjs` obtains five exact files with `git show`
from released source bf4537220bb9a9b096cfaab9598fa2cd13556db9, preserves their
relative imports in a disposable directory, and bundles the released native
paid service together with the current host factory. It does not mutate source,
rebuild the root site, create a deployable Netlify ZIP, or register a route.
The native server request dispatcher/config is not part of this test bundle.
Source hashes and the local bundle hash are recorded in bundled-checkout-tests.json;
temporary-path comments can change the bundle hash between machines.

The disposable database test now exercises the bundled real native offer service
through shared HTTP, the separate checkout adapter, the existing transaction
builder, the native receipt reader and shared payment recording. Two reviews
return one offer. A mocked signature/chain response records one payment; a second
pay attempt is blocked; reconciliation returns the same payment without signing.
The native continue counter remains unchanged and no restore grant is issued.
Metadata, ownership, checkpoint and transaction observations are deterministic
fixtures. This is not a mainnet financial E2E or hardware-wallet test.

Results: 73 unit checks; 38 Netlify-role database/browser checks; 35 original-role
database checks. The existing actual Phaser restoration cases still run with
typed injected payment/settlement fixtures, separately from this native checkout
case. BNB financial ingestion and the native UI remain separate integration gates.

```
git fetch --no-tags origin bf4537220bb9a9b096cfaab9598fa2cd13556db9
node --test tests/multichain-shared-checkout.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Use the existing vendor/continue-browser-test and vendor/bnb-continue-store locks.
CI fetches only the pinned release commit for the bundle test. Mysten's current
README, accessing-data skill and gRPC reference were refreshed; no SDK/API or
transaction-building change was introduced.

Remaining: connect both pending stores and existing wallet UI, implement reviewed
journal completion/manual recovery, wire the preserved Netlify dispatcher and
runtime configuration, and test BNB receipt ingestion through the same run.
Operational drain/fencing and separately reviewed migration/publication remain
mandatory. Do not activate this adapter or replace the historical root site.
