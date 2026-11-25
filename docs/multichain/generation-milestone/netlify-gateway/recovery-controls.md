# Pending stores and recovery controls

November 24, 2026. Source and tests only. Prior CI 45543042640 passed for ae1106fd.
Concurrent holiday review 8f1b3254 and inventory audit b4182b2d were fetched and
preserved. No native UI/game source, live function, database or wallet changed.

`createBrowserSharedNativeCheckout` now explicitly uses localStorage for the
shared journal, sessionStorage for legacy pending receipts and navigator.locks
for serialization. The core factory requires both stores; neither is silently
replaced by an empty store. A legacy marker in either location blocks a new shared
payment and shared reconciliation. Malformed/unreadable stores fail closed.
This resolves the cross-store wiring gap from bundled-checkout.md for the new
adapter. It does not make legacy sessionStorage from another tab observable or
fence an already-running old client: the deployment drain gate still applies.

`pending()` provides a non-sensitive UI state. `reconcile({digest})` supports
manual recovery after an unknown signing outcome. A digest is saved only after
server verification; failed input leaves the original marker intact. A verified
existing digest cannot be silently replaced. `recoverPending()` sends the stored
payment ID through authenticated recovery, requires a non-restoring response, and
retains the journal. Neither recovery method invokes signing or asks for payment.

`mountCheckoutRecoveryControls({root, checkout, onRecovered})` supplies a labeled
digest input, Verify existing payment and Recover paid run buttons, and an aria-live
status. It disables controls while busy, preserves the input after errors and
provides teardown. `onRecovered` is for the host's verified session/run handoff,
not scene restoration. The host must refresh/unmount controls when the session
changes; the checkout independently rechecks session identity around requests.
No public route or actual native UI mount was added in this source milestone.

The journal deliberately remains after verification/recovery. Completing or
archiving it requires a server-verified consumed-payment result bound to the
same wallet/payment/run. No discard, automatic retry or unverified clear action
is provided. A missing receipt after cancellation still requires review; do not
work around the marker by paying again. These remaining completion/cancellation
flows must be reviewed before public use.

## Validation

`recovery-tests.json`: 79 unit checks, six Chromium control checks, 38 Netlify-role
database/Phaser checks and 35 original-role database checks passed. Unit checks
cover distinct stores, manual digest correction, known-digest conflict, retained
journals and fail-closed reads. Real DOM checks cover disabled actions, errors,
verified recovery, accessible status and teardown with zero live requests.
The bundled native offer/payment test now invokes actual shared recovery through
the host and confirms the native continuation counter stays zero. Its signing,
chain and ownership observations remain mocked. Browser UI tests inject services;
Phaser financial settlement fixtures remain separate. This is not mainnet E2E.

```
node --test tests/multichain-shared-checkout.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-checkout-recovery-browser.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Use existing setup/locks from bundled-checkout.md. CI includes the new browser
check. Next: server-verified journal completion and cancellation recovery, then
mount in the preserved native checkout UI and finish BNB financial-flow tests.
Actual dispatcher packaging, operational fencing, hosted migration and production
publication still require their reviewed milestones. The root historical build
must never replace current production.
