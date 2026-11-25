# Native session and dApp Kit host binding candidate

November 25, 2026 (America/Chicago). Source candidate only, not deployed.

The offline entry generator now also patches the pinned NFTreeGateway.tsx and
includes `bnb-native-host-options.mjs`. The gateway accepts an optional explicitly
selected `bnbReviewProvider` prop. Without it, the original checkout is selected
and no extra pending-payment storage read occurs. With it, the gateway supplies
its live sessionRef, session epoch and dApp Kit instance. A pending native Sui
payment still selects the original recovery checkout. The existing game, auth,
scoring, tournament and payment functions are otherwise unchanged.

The host adapter maps native runId to transport nativeRunId and reads session
state on demand. It adapts the actual `$connection` and `$currentNetwork` stores,
subscribes to both and forwards only `kit.signPersonalMessage` with the selected
account. A small Wallet Standard-shaped facade lets the existing BNB adapter use
this path without reading private dApp Kit internals. Unsupported wallet signing
fails through dApp Kit; the facade does not establish universal wallet support.
The EIP-1193 provider remains explicitly supplied by the caller. No provider is
discovered from window.ethereum and no connection/network switch is initiated.

Session/ref updates and wallet-event epochs invalidate pending reviews; closing
checkout destroys both store subscriptions and the existing BNB provider listeners.
The generated source keeps the original Sui handlers and callbacks intact. The
candidate generator checks the hash of both native source files; it reads the
pinned source commit, never applies over a working checkout, and marks output
non-deployable. Recheck/rebase against the actual current game source before use.

## Reproduce

Use `prepare-native-bnb-entry.mjs NEW_OUTPUT_DIRECTORY` as documented in
`bnb-native-entry.md`; output now includes both native entry files and six browser
modules. No dependencies changed.

```sh
node --test tests/multichain-bnb-native-host-options.test.mjs tests/multichain-native-bnb-entry.test.mjs tests/multichain-bnb-review-wallets.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-native-bnb-mount-browser.mjs
```

Passed 20 unit/compiled-source tests and six assembled Chromium checks. Tests
cover live session mapping, store changes during signatures, stale selected-account
facades, partial-subscription cleanup, default-path preservation, pending-native
recovery selection and both TSX candidates compiling. Browser checks now use the
host adapter with dApp Kit-shaped store fixtures, real transport and mount modules.
They do not run the actual dApp Kit package or wallet extensions. Evidence:
`bnb-native-host-tests.json`.

## Remaining

The app root does not yet supply bnbReviewProvider. A reviewed provider-selection
entry and current source-to-live parity check are needed, followed by actual
Slush/MetaMask/Ledger testing on the canonical origin under a separately reviewed
release. The review path still cannot send payments. Cross-payment pending-state
coordination, expired-session BNB recovery, trusted production checkpoints,
schema migration and legacy-writer drain remain prerequisites to payment release.
All original NFT/artwork/custody requirements remain unchanged. No live site,
contract, NFT custody, payment or gameplay state changed in this milestone.
