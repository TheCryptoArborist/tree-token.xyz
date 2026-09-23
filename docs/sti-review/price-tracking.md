# STI badge visuals and price tracking

The native Stats badge restores STI's icon/name and the segmented basket allocation bar, with TREE highlighted by its full coin type. The icon is a locally served, reviewed SVG containing only shapes and a gradient, copied from `https://sti.boombots.fun/icon.svg`. The widget does not load STI executable code, an iframe, telemetry, external images or a navigation link.

## Price definitions

Inspection of STI's published application (`https://sti.boombots.fun/assets/app-432a7a025f.js`, September 23, 2026) confirmed that its “STI price” is the Cetus pool spot price and its “Backing per STI” is the basket NAV per token. The badge presents both in SUI, clearly labeled; neither is an executable trade quote.

- **STI price:** the existing pinned STI/SUI Cetus pool, read through the official Sui Mainnet GraphQL endpoint `https://graphql.mainnet.sui.io/graphql`. A fixed read-only query requests chain identity, latest indexed checkpoint time and pool contents. Validate the Mainnet identifier, object address, exact pool type and coin ordering, fee, unpaused state, positive liquidity and bounded integers. Both tokens have nine decimals; price in MIST per STI is `floor(sqrtPriceX64² × 10^9 / 2^128)`. No wallet address or credentials are sent, and no wallet SDK is loaded by this display read.
- **Backing per STI:** `perSti` from the existing `https://sti-keeper-production.up.railway.app/badge` feed, in MIST per STI. Require positive bounded integer strings and exact agreement with `floor(navMist × 10^9 / supply)`. This is STI's reported basket valuation, not independent verification of every constituent price.
- **Basket:** all reported allocation shares, with bounded length, valid distinct coin types, shares between zero and one, and a sum within 0.0001 of one. TREE's existing membership checks are retained. Display labels are bounded plain text; no upstream markup, CSS, code or image URLs are used.

Both sources refresh once a minute while Stats is visible, with a 12-second timeout, omitted credentials/referrer and rejected redirects. Each has its own source/update time. Data older than five minutes is cleared, including after a background tab resumes. Source failures are isolated: a missing price does not remove TREE membership, and a failed badge feed does not block independent live pool quotes. NAV or allocation failures clear only those displays. The price display does not change purchase transaction construction, minimum output, impact limits, quote expiry, simulation, or wallet approval.

Source reference for the read API: https://docs.sui.io/develop/accessing-data/graphql/query-with-graphql. The public service can rate-limit; failures show unavailable values rather than stale prices.

## Verification commands

`node --test tests/sti-stats-core.test.mjs` covers units/direction, wrong chain/pool/type, paused/empty pools, malformed or out-of-range values, stale timestamps, NAV consistency, incomplete allocations and spoofed TREE symbols. Fixtures capture public responses from September 23; browser fixture timestamps are explicitly refreshed for deterministic tests.

`tests/sti-stats-browser.mjs` adds desktop, mobile and small-mobile checks for local branding, proportional segments, correct price/NAV text, stale-value clearing and independent invalid-data states. The existing `tests/sti-native-browser.mjs` additionally checks live prices and NAV alongside live quotes and an unsigned simulation with wallet rejection. Wallet header/bootstrap suites remain required.

Preview output is 193 static files: the 189-file baseline, four existing frontend overlays, three local STI modules and one local STI icon. Production manifests, published bytes, backend identities and schedules are unchanged.
