# Tree Arcade wallet switch fix

## What was found

The active `/play/` controller hid its wallet-change button while a player was
signed in. Its Sign out action cleared the Daily login but did not disconnect
the selected wallet. Both controls could become unavailable during a slow
progress request. The wallet bridge always selected the first compatible
account returned by a provider, so reconnecting a wallet that shared several
accounts could select the same unwanted address again.

## Prepared behavior

- **Switch wallet** stays visible while signed in and remains usable during
  progress refresh. **Sign out** clears the local login and wallet selection.
- Reconnection opens the wallet picker. If the provider shares multiple
  accounts, the player chooses an address before any sign-in message is
  requested. Full addresses appear in the account picker.
- Old sign-in, reconnect and progress responses cannot repopulate a signed-out
  session. A queued event from another tab cannot delete a newer login.
- Monthly attendance and quest information clears when the active identity
  changes. Data returned for a previous identity is discarded.
- Saved recovery checkouts and payment digests stay associated with their
  original wallet. Another wallet must let that checkout be verified or cleared
  before starting a replacement checkout.

The intended player path is **Daily → Switch wallet → wallet provider → account
→ approve the sign-in message**. An account not shared by the provider must be
authorized in the wallet and reconnected. Switching itself does not request a
blockchain transaction.

## Scope

Only four existing published frontend assets change: the active Daily
controller, its wallet bridge, the monthly panel controller, and the account
picker styling. The bundled wallet vendor prefix and dependency lock stay
unchanged. The release procedure captures the current site and requires all
other static files, backend/provider records, schedules, and configuration to
remain identical. See `arcade-wallet-switch-release.md` for the exact procedure.

## Preview preservation

The general feature preview verifies the original captured Arcade runtime
before applying reviewed replacements. The original Daily controller and wallet
bridge are retained byte-for-byte under
`production/arcade-organization-static/captured-runtime/`. The runtime manifest
changes only their source locations; their captured hashes, byte counts,
baseline ID and November 18 inventory references remain unchanged. These bytes
were recovered from source commit `462ff86a7b120f3c89bc9a24eccc46fbac8a491f` and
checked against that captured inventory.

`scripts/build-feature-preview.mjs` explicitly overlays the current controller
and bridge from their existing `runtime/` paths and pins their reviewed SHA1
hashes. It also pins the canonical monthly controller's reviewed SHA1. The preview
regression test verifies both the original captured hashes and the replacement
hashes, exact output inventory, and the read-only preview guard. Neither the
historical inventory nor any production package is rewritten by this preview
integration.

## Verification and publication status

Local regression tests exercise synthetic wallets and mocked requests,
including two accounts in one provider, sign-out during pending work, canceled
sign-in, cross-tab event ordering, monthly identity changes and recovery
reconciliation. They use no real wallet keys or chain transactions.

The first candidate passed the served-browser checks at 320, 390 and 1280 pixels
in GitHub Actions run `44986623909`. Its account-picker and signed-in screenshots
were visually reviewed. This used synthetic wallets with all API operations
intercepted; it is separate from acceptance with an installed user wallet.
Local Chromium launch is unavailable in this execution environment.

That first candidate is not eligible for publication after the preview build
correction above, because the complete source tree has changed. A new candidate
must pass preservation and browser checks against the final source before
publication. The observed publication outcome and exact release evidence belong
in the newest `production/README.md` entry after successful deployment.

## Guidance consulted

The current MystenLabs skills README was checked live. Relevant files read:

- `frontend-apps/SKILL.md`
- `frontend-apps/non-react.md`
- `frontend-apps/limitations.md`

The current disconnect and account-selection documentation informed the
behavior, with the existing Wallet Standard integration retained:

- https://sdk.mystenlabs.com/dapp-kit/actions/disconnect-wallet
- https://sdk.mystenlabs.com/dapp-kit/actions/switch-account

