# STI purchase price-impact review

## Confirmed cause

On November 18, 2026 at approximately 10:37 a.m. America/Chicago, the live
TREE Stats panel reproduced the reported rejection for a 2 SUI quote:
3.50% price impact exceeded the panel's fixed 3% ceiling. The rejection
occurred before purchase simulation or wallet approval.

The native panel uses the verified Cetus STI/SUI pool through the pinned
`@cetusprotocol/sui-clmm-sdk@1.4.7`. Its calculation compares the quoted
STI output against the pool's spot rate and includes the 0.25% pool fee.
The token types, 9-decimal units, b2a direction and calculation were checked.
This repair changes quote review policy, not token pricing arithmetic.

Independent read-only Cetus router quotes and Sui GraphQL pool state at
2026-11-18T16:37:36Z returned:

| Input | Expected STI | Fee-inclusive impact, rounded up to basis points |
| --- | ---: | ---: |
| 0.1 SUI | 16,630.359647625 | 0.42% |
| 1 SUI | 163,827.250354404 | 1.91% |
| 2 SUI | 322,321.683251131 | 3.50% |

The observed pool was
`0xc9fb86078a0e88c31cee675386047edcb29b5a1f5ebe6358a968f1f816e9caa4`,
with `current_sqrt_price=45139874400909872`,
`liquidity=24230343470405` and `fee_rate=2500`.
At 16:39:14Z, unrestricted routing and routing restricted to that Cetus
pool produced the same 2 SUI output. These are dated observations and test
fixtures, not promised future prices.

Read-only sources: [Cetus find_routes](https://api-sui.cetus.zone/router_v3/find_routes),
[Sui GraphQL](https://graphql.mainnet.sui.io/graphql), and the
[live TREE panel](https://tree-token.xyz/dapp/#stats). The independent router
request used `from=0x2::sui::SUI`, the full STI type exported by the purchase
core, `amount=2000000000`, `by_amount_in=true`, and `v=1010705`.
The restricted comparison added `providers=CETUS` and `include_pools` with
the verified pool ID.

STI's public feed identifies `https://sti.boombots.fun` as its site. That
site's current purchase route could not be inspected in this environment.
The user's successful purchase there does not establish that it used the
same pool or the same price-impact policy. TREE continues to disclose that
its purchase is pool-only and does not compare basket minting.

## Resulting behavior

- Quotes at or below 3% use the existing review flow.
- Quotes above 3%, through 5%, display the full quote and a clear warning.
  Review stays disabled until the user accepts the displayed impact for
  that exact quote. The bounded 5% ceiling accommodates the reported
  3.50% quote while preserving a hard stop for larger price impacts.
- Quotes above 5% remain blocked. No automatic amount splitting, re-quoting
  for approval, slippage increase, routing change or transaction retry occurs.
- Acceptance resets on a new quote, amount edit, wallet change, panel close,
  or expiry. Revoking acceptance discards a prepared purchase.
- Review checks the wallet balance and simulates the exact transaction.
  A separate click then requests wallet approval with fresh user activation.
- The 1% slippage limit, minimum STI output, 30-second quote lifetime,
  pinned assets/pool/entry point, 0.1 SUI gas reserve and balance-change
  checks remain unchanged.

The quote-identity guard is enforced when building a purchase, after
simulation and again immediately before wallet handoff. Acceptance is
in-memory only and cannot carry to a copied or refreshed quote.

## Sources and release boundary

The four current frontend overlays are under
`production/sti-purchase-static/`. The HTML starts from the exact currently
published Stats HTML in `production/stats-market-static/index.html`.
Historical manifest-pinned root files and all backend sources remain unchanged.

| Public path | Source |
| --- | --- |
| `/dapp/index.html` | `production/sti-purchase-static/index.html` |
| `/dapp/sti-widget.js` | `production/sti-purchase-static/sti-widget.js` |
| `/dapp/sti-purchase-core.js` | `production/sti-purchase-static/sti-purchase-core.js` |
| `/dapp/sti-purchase.css` | `production/sti-purchase-static/sti-purchase.css` |

The dedicated publisher freshly captures locked deployment
`6afd423531560084e7dd48e8`: 614 static paths, 49 complete backend packages
and five schedules. It changes exactly three existing paths, adds the scoped
stylesheet, preserves 611 existing paths byte-for-byte and retains all backend,
runtime, schedule and protected environment configuration. It refuses a changed
baseline and never rebuilds or uploads a backend function.

A feature-branch commit containing `[skip netlify] [preview sti purchase]`
builds and verifies an isolated candidate. Main-branch publication additionally
requires `[publish sti purchase]`, exact source and candidate identity,
four-width browser evidence and a fresh production/concurrency check. The
new candidate is published and locked together; no older deploy is restored.

## Validation

Core and actual-widget-handler tests cover 3.00%, 3.01%, 3.50%, 5.00% and
5.01%; consent isolation and revocation; wallet/amount/expiry changes;
simulation failure; minimum output; pending transactions and fresh final
wallet gestures. Existing historical production inventory/build tests still
verify the archived snapshot byte-for-byte.

`scripts/check-sti-purchase-page.mjs` tests 320, 390, 768 and 1363 CSS pixels
using labeled synthetic quotes and a test wallet that always rejects. Its
network boundary sends only first-party static GET/HEAD requests and mocks
every API and SDK operation. Candidate and canonical reports are bound to
their exact origin, source commit and candidate ID. These checks do not claim
that a real wallet signed or that an actual purchase was submitted.

Current Mysten Labs guidance was checked live: `README.md`,
`frontend-apps/SKILL.md`, `frontend-apps/transactions.md`,
`sui-sdks/SKILL.md`, `sui-sdks/typescript.md`, and
`sui-sdks/llm-docs.md`. Existing pinned SDKs and wallet integration are retained.
