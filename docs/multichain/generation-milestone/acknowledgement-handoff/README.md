# Approved first acknowledgement signing handoff

The user approved **one Sui acknowledgement**, maximum **0.2 SUI total**:
0.15 message fee + 0.05 gas. The NFT stays in dev wallet 45c4. No USDT, deposit,
security changes, public sale or gameplay activation. BNB completion remains a
later reviewed step. No live acknowledgement has been submitted by Codex.

Canonical route: `https://tree-token.xyz/play/generation-acknowledgement/`.
Publication is pending until a release record is added. Use desktop Slush account
45c4. Never use preview domains for wallet signing.

## Safeguards and verification boundaries

The fixed GET-only service checks current Sui original ownership, exact released
vault state, security/configuration, and current BNB Locked/paused/nonplayable state
using the existing canonical purchase/return verifier. It obtains a fresh native
quote, checks sufficient address balance, builds the exact kind-3 transaction,
and runs checked simulation plus post-state verification. It rereads both chains
before returning the review. Ack_sent true, changed phase or state blocks a repeat
first-send. The current verified estimate is 0.099892457 SUI total.

The browser independently checks the exact transaction bytes/commands/references,
source simulation, complete fee/effect reconciliation, original ownership, limits
and chain/expiry. Only canonical origin/path can sign. Existing desktop Slush
account-permission recovery and server-relative monotonic review clock are reused.
It rejects changed wallet bytes, requires the approved account throughout signing,
verifies the signature, and saves the digest before execution. Cross-tab locking
and persisted digest prevent an uncertain submission from being sent twice.

Check receipt verifies exact source execution and acknowledgement state. It does
**not** claim the BNB burn has occurred and does not depend on the BNB pass still
being Locked after submission. Return the receipt for independent destination
verification. Do not resend if indexing is delayed. The original NFT is never an
input and its mutation is rejected. Source receipts reject all unexpected writes.

## Setup and evidence

Use Node 24, `npm ci --ignore-scripts` at root and
`npm ci --ignore-scripts --prefix contracts/bnb-generation` for isolated EVM tools.

```sh
node tools/generation-acknowledgement/build.mjs
node --test tools/generation-acknowledgement/*.test.mjs contracts/nftree-generation/scripts/acknowledgement-review.test.mjs tests/generation-acknowledgement-release.test.mjs
node --use-env-proxy tools/generation-acknowledgement/browser-test.mjs
```

The build also creates the committed Node ESM bundle
`vendor/generation-acknowledgement/bnb-verifier.mjs` from the existing isolated
BNB dependency lock. The new service imports that bundle so Netlify's root install
needs no SDK/dependency migration. CI rebuilds both bundles and checks exact bytes.
Only the new service is packaged; all existing production functions are reused.

`simulation.json` is a checked live review accepted by the actual browser verifier.
`browser-source.json` covers eight mock scenarios: connect result with stale wallet
getter, wrong account, wallet rejection, stale review, desktop clock skew, changed
signed bytes, persisted receipt, and off-origin signing rejection. No real wallet
or chain submission is used. Source receipt tests use simulated effects to verify
acceptance and reject wrong digest/NFT mutation, without claiming live execution.

Validation before candidate: **388 regression checks passed**, plus **11 release
preservation/preview checks** and all eight browser scenarios. The isolated new
function packaged successfully as Node 24 streaming, exact single API route.

## Production and remaining work

Fresh locked baseline `6b046c3ccb8dfd3eb651353c`: 684 static paths, 59 full backend
records and five schedules. Preserve every existing static hash, full provider
record, runtime/protected settings and schedules. Add exactly two page files and
one GET-only service (686 paths, 60 functions). Never deploy the historical root
build. Capture newer unrelated production if the baseline changes.

Next: audit exact-source candidate, publish/verify canonical page, obtain the
user's one Slush signature/receipt, verify actual BNB burn, then separately review
BNB completion. GitHub feature branch and PR #280 are the durable record.

Initial preparation run 45219415615 stopped before candidate creation because
Tree Army projectile-origin release changed the baseline to
`6b046c3ccb8dfd3eb651353c`. The replacement preserves that newer release.
