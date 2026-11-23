# Approved final Sui binding handoff

Step 6 of 6 is already approved with maximum gas **0.1 SUI**. The preceding Sui
configuration and all four BNB security calls have independently verified receipts.
The canonical signing page is https://tree-token.xyz/play/generation-binding/.
Desktop Slush account ending 45c4 signs. No NFT deposit, sale or gameplay activation.

The GET-only service checks current security settings, capability ownership,
original NFT identity/ownership, inactive BNB pass and the exact completed BNB
receipts plus fresh runtime/configuration reads. It simulates only the reviewed
vault binding with the new adapter, validates commands/events/effects and
simulation-scoped post-state, and checks state stability before issuing a review.
The browser independently checks exact bytes/commands, references, ownership,
chain, gas ceiling, simulation and expiration. Existing Slush getter-lag handling,
server-based review clock, cross-tab lock, signature verification and persisted
digest-before-submission are retained. Uncertain execution requires receipt
reconciliation; never repeat binding blindly.

The receipt verifier checks the exact executed transaction against its input
capability references, events, effects, live empty generation-zero bound vault,
peer, enforced options, channel nonce state, unchanged security and admin owners.
BNB remains paused and non-playable. A simulation is not an executed receipt.

Fresh simulation estimated **0.009266747 SUI**. 46 focused checks and 128 existing
Sui review regressions passed, plus eight source mock-wallet browser scenarios.
Tests cover modified transaction bytes, gas, sender, accounts, NFT identity,
BNB receipt/runtime/settings changes, expiry, pending recovery and preservation.
Browser tests submit no real chain transactions.

Node 24 setup: root `npm ci --ignore-scripts`. Reproduce:

```
node --test tools/generation-binding/*.test.mjs tests/generation-binding-release.test.mjs tests/sti-preview-build.test.mjs
node --test contracts/nftree-generation/scripts/*.test.mjs
node tools/generation-binding/build.mjs
node tools/generation-binding/browser-test.mjs
```

`prepareBindingHandoff()` in `contracts/nftree-generation/scripts/binding-handoff.mjs`
refreshes the read-only simulation. Node network calls use `--use-env-proxy` in
this Cloud workspace. The current Mysten README was fetched at
`a384d9a158c4639f075ad3f6644d925108ddfc78`; applicable PTB/data-access skills and
building/commands/GraphQL references were read. Pinned dependencies and explicit
user-approved gas caps are preserved; no wallet/SDK migration.

Release baseline: newly captured locked Root Rage release
`6b03c711ca6052a6cd8f7399`, 56 complete backend records and five schedules.
Preserve every current static hash, backend/provider record, runtime and protected
configuration. Add only two static paths and one isolated GET-only function.
Never publish the historical root build. Exact-source preview supplies new
provider metadata only; canonical publication uses the full captured inventory.

Remaining: candidate/canonical release checks, user signature, independent final
receipt verification. End-to-end messaging validation, deposits, sales and gameplay
are subsequent reviewed milestones. Refresh original identity/ownership before any
deposit. The retired trial remains retired.
