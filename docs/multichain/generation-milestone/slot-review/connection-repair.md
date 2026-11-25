# Desktop Slush connection repair

User screenshot shows `Select your approved dev account in Slush.` after Connect.
That establishes that the click handler ran and the connection promise returned,
but the old wallet.accounts-only lookup found no approved account. It does not
establish which account the extension returned. The deployed handler ignored
`standard:connect`'s returned accounts and unconditionally reconnected even when
the approved account was already shared. A pending connection had no progress or
timeout, a separate reproduced UI defect.

The repair consumes returned accounts, reuses an existing shared approved account,
listens for subsequent account changes (including revocation), invalidates prior
review state on connection changes, reports shared addresses on mismatch, and
shows progress and a 15-second timeout for an unanswered extension request.
The page also reports JavaScript loading failure and shows `connection update 2`
when initialized. The transaction bytes, budget, receipt lock, signature checking,
server endpoint and chain guards are unchanged. No transaction is submitted by
this repair.

Tests cover already-authorized accounts, returned accounts before getter updates,
wrong shared account, pending/rejected connection, late account event and
revocation. Browser scenarios use a mocked Slush implementation; they cannot
establish which account the real extension shares on the user's device.

Release scope: replace only `/play/generation-slot/index.html` and `app.js`.
Fresh locked baseline is `6b037118d43fee18f79fb7a4`, which includes the newer
seasonal-grove release. Preserve its full inventory, all 54 backend records,
five schedules and protected configuration. No backend upload or rebuild.

Published and locked as `6b03741d72033c45517f32e3`; see connection-live.json.
133 tests and all five source/candidate/live browser cases passed. Actual user
wallet connection is pending confirmation; no slot creation was submitted.
