# Approved single completion handoff

User approval: one `send(4)` from MetaMask + Ledger admin 8789, maximum
0.006 BNB (0.0059 message fee plus 0.0001 gas). Canonical URL after publication:
https://tree-token.xyz/play/bnb-completion/. No live send by Codex. No USDT,
deposit, mint, security change, sales or gameplay activation is included.

The static-only page reuses the existing fixed GET-only acknowledgement receipt
service before signing. It validates the exact source digest, GUID, payload,
phase 2/generation 1/ack_sent state and checkpoint freshness. Live preflight also
independently rechecks NFTree #2720 identity and ownership in dev wallet 45c4.
Current Mysten README and applicable accessing-data/GraphQL references were read;
existing pinned GraphQL integration is reused without dependency changes.

BNB checks pin code hashes, all security configuration, pass/adapter bindings,
Retired/paused/nonplayable generation 1, zero owner balance, exact redemption and
recipient and applied acknowledgement payload hash. Outbound nonce must be 1,
wallet latest/pending nonce 4752. Exact quote/simulation must produce the reviewed
kind-4 payload, GUID, sequence 2 and options. Fixed 600000 gas limit remains
within approved gas/total monetary caps; a higher estimate stops signing.

The working MetaMask connection/account chooser, read-only RPC fallback,
cross-tab lock, durable intent before wallet request, hash recovery and progress
export/import are preserved in the new page. Uncertain submissions block retries.
Source receipt checks validate canonical block/intent, packet, fee allocation,
message, exact gas/total caps, and continued Retired/paused/nonplayable state.
After sending, receipt checks no longer depend on phase-2 Sui state: completion
may already have delivered. Source confirmation explicitly leaves destination
unchecked. Return the receipt for independent Sui Completed event, matching
request/generation, empty phase 3, and original ownership verification.

## Reproduce

Node 24, pinned root and isolated contracts/bnb-generation dependencies:

```sh
node tools/bnb-completion/build.mjs
node --test tools/bnb-completion/*.test.mjs tests/bnb-completion-release.test.mjs tests/sti-preview-build.test.mjs
node tools/bnb-completion/browser-test.mjs
node tools/bnb-completion/browser-sequence.mjs
node --use-env-proxy contracts/bnb-generation/scripts/review-completion-handoff.mjs /tmp/completion-handoff.json
```

`fork.json` exercises the actual browser preflight/send/receipt path on a fresh
local mainnet fork, without balance/storage overrides. Remote transport is reads
only; no live wallet is used. The page's one exact request and receipt flow plus
eight connection/failure scenarios are browser tested. `live-preflight.json`
records actual read-only current Sui/NFT/BNB readiness. Local fork simulated
costs are not live expenditure. Tests intentionally reject replay after nonce use.

## Production preservation

Prepare/publish workflow uses shared `tree-production-preservation-release`
concurrency and waits for all Git builds before the lock switch. Preserve the
complete current baseline, all static hashes/backend records/runtime/settings
and five schedules. Add only two new static paths and upload no backend.
Never publish the historical root snapshot. Stop and recapture on baseline change.

Remaining: user signs once, verify actual BNB
source receipt and Sui completion. No next generation or public activation is
implicitly authorized.

Pre-release verification: **234 regression/preservation/preview tests passed**,
plus eight browser connection/failure scenarios and the full single-send mock
flow. Fresh maximum at the fixed 600000 gas limit: **0.004607084124304116 BNB**.

Published and locked at 12:05:12 America/Chicago on November 23, 2026. All nine
browser scenarios passed on the candidate and canonical site. Exact IDs and
artifact digests are in `release.json`; the approved one-send signature remains
pending. The GitHub-hosted publication downloaded and revalidated the complete
candidate artifact. Local artifact downloads encountered a proxy 403; independent
provider metadata, served bytes and browser verification passed.
