# Required canonical wallet origin — user correction

All user-facing wallet signing links must be under **https://www.tree-token.xyz/play/**. Do not direct the user to a Netlify preview hostname for wallet actions. The intended new path is `https://www.tree-token.xyz/play/generation-publication/`, but it is **not yet deployed**. Exact origin and path checks now disable connection, signing and submission on the preview and every other location. Do not bypass Slush warnings or assume a canonical URL by itself clears them.

The older preview instructions below describe implementation history only. They no longer authorize signing there. A canonical release must freshly capture the entire current live inventory and preserve all existing static files, backend packages, schedules and configuration. Never publish dist-preview or the root historical build as production.

---

# Desktop Slush publication handoff

Preview-only page `/generation-publication/`; built by `npm run build:preview`.
Uses the pinned SDK and Wallet Standard v2 from the existing lock. No wallet or
production runtime migration. User approved only empty Sui publication; see
`docs/multichain/generation-milestone/publication-approval.json`.

Connect desktop Slush with the approved dev address, refresh the review, then
choose **Sign and publish in Slush**. Check the maximum 0.1 SUI budget and retained
capabilities in the review. Reject any different action. If Slush changes bytes,
the page stops without submission. The signer remains in the user's browser;
Cloud and the preview backend never receive private keys or signatures.

The GET-only preview function generates a fresh fixed publication simulation or
checks a supplied transaction digest. It has no arbitrary transaction input,
submission method, production credentials or mutable state. Backend validation
uses the existing tested complete-byte verifier. Browser independently checks
pinned commands, sender/gas policy, chain, exact simulation bytes and freshness;
then cryptographically verifies Slush's signature for the dev address. Submission
goes directly from the browser to pinned Sui mainnet GraphQL.

Before submission, the expected digest is persisted to localStorage. A network
error or reload must leave publication locked until the receipt is reconciled.
Do not clear storage or publish on another device to work around a delayed result.
This browser-local lock is not global uniqueness across origins/devices. After
submission, return the digest to Codex for independent bytecode/capability checks
and recording actual deployed IDs. The receipt endpoint checks publication effects;
it does not yet independently fetch every published module or capability state.
No NFT deposit, slot creation, route activation, BNB action, sale or game action
is supplied. Repeated publication is not a retry mechanism.

Validation: 52 existing tooling tests plus 10 new handoff tests passed; preview
build and archived production-byte checks passed. Fixed read-only handler returned
HTTP 200 from a fresh mainnet simulation (69,723,600 MIST); POST returns 405.
Browser automation with a mock Wallet Standard Slush tests connection, review,
user rejection without submission and persisted reload lock. A real Slush wallet
signature and successful on-chain publication are not yet verified.

Run core tests:
`node --test tools/generation-publication/core.test.mjs`

The pinned bytecode integrity check now hashes its canonical compact JSON directly
rather than reading a relative filesystem path, allowing serverless bundling.
The bytecode hash is unchanged; the existing 52 tests and compiler comparison
still apply. Current Mysten skills revision is
`a384d9a158c4639f075ad3f6644d925108ddfc78`; wallet/transaction guidance was checked
against the installed Wallet Standard types and SDK 2.26.1.

The browser bundle is committed and reproducibly rebuilt by `node tools/generation-publication/build.mjs`; CI rejects bundle drift. The historical preview copier remains dependency-free for its existing CI jobs.
