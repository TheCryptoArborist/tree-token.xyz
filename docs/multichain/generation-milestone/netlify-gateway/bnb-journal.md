# BNB recorded-payment import and journal

November 24, 2026. Source/tests only. Prior CI 45546688812 passed for 10ca3c84.
The clean feature worktree and concurrent Treeforce branches were preserved.
No deployment, wallet call, transfer, migration or game activation occurred.

The canonical shared gateway now offers `shared-continue-bnb-record` behind the
same bearer/origin/runtime/cutover guards. It accepts only runId, checkoutId and
txHash. The host fixes the source to bnb-usdt and imports an ALREADY VERIFIED
ledger receipt through the actual shared delivery transaction. The supplied hash
must match that immutable receipt before insertion. No browser-provided receipt,
amount or payer is trusted. Eight concurrent retries resolve to one payment ID.
Default compositions without the BNB adapter deny the action.

This action does not verify an RPC receipt or open a checkout. The older
createSuiBnbContinue boundary still uses its v1 protocol/session adapter and
records chain evidence into review. Bridging checkout opening, signature binding
and chain verification to the native v2 identity remains a launch gate. Existing
ledger verification must occur before importing; this endpoint must never be
presented as proof of payment merely from a hash.

`createBnbPaymentJournal` is a separate recovery-only browser adapter. It records
a pending marker before the host's wallet flow, imports a known verified hash,
recovers a paid run, and archives only matching BNB completion. It validates
source, payer, checkout, transaction/payment key, payment ID and native/shared run
references. An uncertain response, wrong source, changed session or failed
storage write leaves the marker blocked. Known hashes cannot be overwritten.
Archive writes are verified before removal. The adapter has no signing or
payment function and does not grant restoration.

The host must supply durable cross-tab storage, Web Locks, the current native
session and canonical transport, and mount the journal in its explicit BNB
checkout UI. A pending marker is a recovery guard, not server authorization to
pay. Cross-chain/legacy pending checks and reservation policy must be coordinated
by that UI/server before a wallet request. No public UI mounting is included.
Fresh-login recovery works through the stored payment ID; importing an older
run after a fresh login with no saved payment ID still needs a reviewed lookup/
rebind flow. Do not request another payment as a workaround.

## Validation

bnb-journal-tests.json records 90 unit, seven existing Chromium control, 41
Netlify-role database/Phaser and 38 original-role database checks. The new journal
is exercised against the real authenticated host and database: import, repeat
import, paid-run recovery, denial before consumption, actual BNB settlement and
verified archive. The ledger receipt is synthetic verified chain evidence; no
wallet/RPC/mainnet claim is made. Unit tests cover mismatched transaction/payer/
source, uncertain response, altered completion, storage failure and session
change. Existing Chromium checks cover native recovery controls, not a mounted
BNB interface. Existing Phaser cases retain injected financial fixtures.

```
node --test tests/multichain-bnb-journal.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

CI runs these suites with existing locks. No SDK or schema changes were required.
Next: native v2 BNB checkout opening/link verification/chain receipt ingestion,
then mounted wallet UI and missing-ID recovery. Operational drain/fencing,
reviewed hosted migration and preservation publication remain separate gates.
Never replace the current site with the historical root build or reopen the trial.
