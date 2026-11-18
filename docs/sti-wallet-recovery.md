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

The current baseline is locked deployment `6afddc74d6c8647c67efdbad`, with
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
