# STI wallet loading and recovery

## Scope and evidence

Peter reported that Ctrl+Shift+R restored wallet selection after the STI panel
failed. This supports a browser initialization or stale-state hypothesis, but
does not establish the exact cause of the original error. Current live HTML,
wallet JavaScript and STI JavaScript responses were observed with
`Cache-Control: public,max-age=0,must-revalidate` on November 18, 2026.

The confirmed defect is narrower: the STI connection handler immediately
returned an instruction to refresh if the shared wallet manager had not loaded.
It did not wait for the existing `tree:wallet-manager-ready` event. An unsuccessful
widget dependency import could also leave Get STI without an initialized handler.

## User-facing behavior

- Get STI opens the panel with a loading message while its module loads.
- An early Connect wallet click waits up to eight seconds for the existing shared
  wallet manager and then opens its normal picker.
- If wallet loading fails, Retry wallet connection remains available and a
  visible Reload wallet tools button provides recovery without a keyboard shortcut.
- Late successful loading clears the fallback; there is no second wallet import.
- A deliberate reload preserves the current URL and may retain only the entered
  SUI amount and open-panel intent for ten minutes. The draft is consumed once;
  a new quote and fresh price-impact acceptance are required.
- The reload control is blocked during purchase review, wallet approval and
  pending transaction confirmation. It never submits or retries a purchase.

The shared wallet connector, signing implementation, pinned SDK versions,
purchase arithmetic, impact limits, slippage, gas reserve and backend remain
unchanged. The updated HTML identifies the wallet and STI assets with explicit
release versions. The new independent recovery loader imports the widget once.

## Release boundary

The reviewed release baseline was locked deployment `6afddc74d6c8647c67efdbad`, with
615 static paths, 49 complete backend package records and five schedules.
The source release record is `production/sti-purchase-release-20261118.json`.

The preservation publisher captures that baseline afresh, replaces exactly
`/dapp/index.html` and `/dapp/sti-widget.js`, and adds
`/dapp/sti-wallet-recovery.js`. It requires all 613 other paths and every backend,
provider, runtime, schedule and protected configuration record to match.
The resulting candidate contains 616 static paths. Core and stylesheet bytes
are explicitly pinned to the baseline. A changed production baseline stops
publication rather than overwriting concurrent work.

The authoring sources are in `production/sti-purchase-static/`. The existing
`publish-sti-purchase.yml` workflow runs the focused tests, constructs a newly
captured candidate, checks its delivered bytes and browser behavior, and only
then permits publication of that candidate with the production lock retained.

## Verification and guidance

Focused tests exercise actual widget and recovery handlers with deterministic
wallet/network boundaries. Browser checks cover 320, 390, 768 and 1363 CSS pixels,
including late wallet registration, failed wallet module delivery, failed widget
dependency delivery, delayed widget completion, retry, one-time amount recovery,
and the signing/confirmation reload guard. Network fixtures do not execute a
real transaction. The preexisting quote-consent and preservation gates remain.

The MystenLabs/skills README was checked live for this request. Applicable files:

- `frontend-apps/SKILL.md`
- `frontend-apps/non-react.md`
- `frontend-apps/limitations.md`
- `frontend-apps/transactions.md`

The narrow repair follows their guidance on shared connection state, loading
states and explicit wallet actions, verified against the existing integration.
It does not require an SDK migration. The exact original browser failure remains
unverified; these checks demonstrate recovery from the reproduced loading gaps.

## Published release and final verification

Deploy `6afde69b28000c929ce7a0a4` was published and locked at
`2026-11-18T17:57:21.131Z` (11:57 a.m. America/Chicago), from
`0a354794c782d4f6c83e17b49e13b7e2577df929` through PR220.

All 82 focused tests passed. Candidate and canonical browser checks passed all
12 scenarios at 320, 390, 768 and 1363 CSS pixels. The preservation inventory
contains 616 static paths: two existing paths changed, one was added and 613
remained unchanged, with 49 complete backend records and five schedules retained.
Complete provider/runtime records and protected configuration also matched.

Publication run `44363664888` timed out after publication while checking
canonical delivery. It must not be recorded as an end-to-end pass. Running the
unchanged `verifyDelivery` locally subsequently passed at
`2026-11-18T18:00:16.959Z`. Read-only audit workflow `44365536121`, introduced by
PR221, passed at `2026-11-18T18:05:39.622Z`, with zero remote mutations. The audit
pins the published deployment, source and candidate report, checks all delivery
and preservation evidence, and verifies the publication and lock again after
the canonical browser checks. Four dedicated audit guard tests also passed.

Final report: `production/sti-wallet-recovery-release-20261118.json`.
Report SHA-256: `c5317ebcf3d418b39578c5ad9e4c9037cfff517ab51676e9c396363653d142d0`.
The input proof remains `production/sti-wallet-recovery-candidate-20261118.json`;
its original verification phase must not be mistaken for publication completion.

A separate manual canonical check opened the wallet picker through normal
navigation, without selecting or connecting a wallet or initiating a transaction.
Screenshot: `docs/sti-wallet-recovery-live-20261118.jpg`.

The original browser-session failure remains unproven. These checks demonstrate
recovery from reproduced loading failures. The live MystenLabs/skills README and
the frontend files listed above informed the repair, with guidance checked
against the existing integration. No SDK migration or shared-wallet rewrite was
performed.
