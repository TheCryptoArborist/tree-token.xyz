# Tree Arcade wallet switch fix

## What was found

The active `/play/` controller hid its wallet-change button while a player was
signed in. Its Sign out action cleared the Daily login but did not disconnect
the selected wallet. Both controls could become unavailable during a slow
progress request. The wallet bridge always selected the first compatible
account returned by a provider, so reconnecting a wallet that shared several
accounts could select the same unwanted address again.

## Published behavior

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

The player path is **Daily → Switch wallet → wallet provider → account
→ approve the sign-in message**. An account not shared by the provider must be
authorized in the wallet and reconnected. Switching itself does not request a
blockchain transaction.

## Scope

Only four existing published frontend assets changed: the active Daily
controller, its wallet bridge, the monthly panel controller, and the account
picker styling. The bundled wallet vendor prefix and dependency lock remained
unchanged. Publication retained 655 static paths, preserving 651 unrelated
hashes, all 52 complete backend/provider records, five schedules, runtime
settings and protected configuration. See `arcade-wallet-switch-release.md`
for the exact procedure.

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

The fix is live at https://tree-token.xyz/play/ on locked deployment
`6b027652b3eb61d8107261d0`. It was published on November 21, 2026 at
23:02:23.776 America/Chicago (`2026-11-22T05:02:23.776Z`) and the publication
report passed at `2026-11-22T05:02:28.550Z`. The fresh baseline
`6b0274526be03dc8db2280df` included the concurrent Root Rage update.

Local regression tests exercise synthetic wallets and mocked requests,
including two accounts in one provider, sign-out during pending work, canceled
sign-in, cross-tab event ordering, monthly identity changes and recovery
reconciliation. The final source also passed Stats, Arcade organization and
visual, monthly, snapshot, tab-polish and cutoff checks in GitHub Actions.

The final served candidate passed the wallet-switch browser checks at 320, 390
and 1280 pixels in run `44987253606`. Its account-picker and signed-in screenshots
were visually reviewed. Every API request was intercepted and the wallet
provider used two synthetic accounts with no keys or real signatures. These
tests did not perform a real wallet, payment or chain action. Installed Slush
acceptance and physical-device testing are not claimed.

The independent canonical audit confirmed the published deployment is ready
and locked, all 52 complete backend/provider records, schedules and captured
runtime settings equal the baseline, and the four changed assets return HTTP
200 with exact planned hashes. The publication workflow checked the complete
static inventory and protected configuration; the independent audit did not
repeat those two broader comparisons.

## Release evidence

| Record | Value |
| --- | --- |
| Source commit | `5c85fad4a8248a8098783916c78e3a5b033640a3` |
| Source tree | `2e546ec83f16412d76a973f577a1d4903292185d` |
| Merged main commit, PR #281 | `9a6403a159e0fdf74b12a479e5dea4661d177721` |
| Publication control commit | `abd9e0f3a35522bc79627b029d51ceb963608f69` |
| Prepare workflow | [44987253606](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44987253606) |
| Prepare artifact | `14740192235` |
| Prepare artifact SHA256 | `aed17e38e8dda67943835bbc2eb55eac92540592fd4aa80ad38e2abc0466dae5` |
| Publication workflow | [44987535226](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44987535226) |
| Publication job | `137101391951` |
| Publication artifact | `14740522896` |
| Publication artifact SHA256 | `3013b1fa6367f89dee8926754315f7defcd1bd7238512cadefe3e77721321adf` |

The complete [publication report](arcade-wallet-switch-release-20261121.json)
and [candidate browser report](arcade-wallet-switch-browser-20261121.json) are
copied without modification from the workflow evidence. The separate
[canonical audit](arcade-wallet-switch-canonical-20261121.json) records the
independent post-publication checks. The newest `production/README.md` entry
identifies the current baseline for future releases.

## Guidance consulted

The current MystenLabs skills README was checked live. Relevant files read:

- `frontend-apps/SKILL.md`
- `frontend-apps/non-react.md`
- `frontend-apps/limitations.md`

The current disconnect and account-selection documentation informed the
behavior, with the existing Wallet Standard integration retained:

- https://sdk.mystenlabs.com/dapp-kit/actions/disconnect-wallet
- https://sdk.mystenlabs.com/dapp-kit/actions/switch-account

