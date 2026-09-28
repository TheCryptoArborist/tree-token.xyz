## Wallet review and saved setup

The preview includes optional EVM browser wallet discovery (EIP-6963 with a legacy injected-provider fallback), source network checks and explicit switching, and a Sui receiving-wallet control using @mysten/dapp-kit-core 1.6.34 and @mysten/sui 2.33.1. These dependencies are isolated under gateway/wallet-kit; the existing site SDK dependencies are unchanged. Wallet code is bundled locally into the preview and loaded only when the wallet-review section opens.

There are no transaction or message-signing controls. The source adapter allowlists account access, chain reads, balance reads and an explicitly requested network switch only. Account/network changes clear the source selection and all quote/gas review state. Solana wallet connection and mobile WalletConnect are not implemented; Solana quotes remain available.

The Base gas endpoint accepts only a valid EVM address and performs a fixed eth_getBalance read against mainnet.base.org. Unknown or failed reads never imply a funded account. Positive balances do not establish gas sufficiency; transaction-specific gas estimation remains pending. Public addresses are sent for balance checks only on user request.

Save/restore stores a validated, versioned set of route choices in this browser only. It excludes wallet addresses, quote payloads, balances and transaction stages. Restoring requires a new quote and wallet verification. This is not resumable transaction tracking.

Validation: 18 focused tests, including fixed-upstream gas requests, rejected signing methods, invalid saved choices and source identity/quote safety; exact production snapshot and preview builds. Current MystenLabs frontend-apps/SKILL.md, setup.md and non-react.md informed the wallet integration.

## Relay routes in the review preview

The preview supports BNB Chain (56) and Robinhood Chain (4663) with live, non-executable Relay quotes (`indicativeQuote: true`). The server validates origin identity, exact input amount, Base chain ID 8453, native Base USDC address/decimals, and positive bounded integer output amounts. Only sanitized display fields reach the browser. Relay transaction steps, signing data and the documentation example quote identity are never exposed as deposit instructions.

Mayan is quoted from the Relay minimum Base-USDC output, with 1% slippage requested independently for each stage. Combined results are indicative, expire within 30 seconds from request start, and are not an end-to-end guaranteed minimum. Provider costs are reflected in output estimates; source gas, Base ETH gas, Gateway fees and the onward TREE swap are not included in a complete total. A production flow still needs wallet connections, finality/status tracking, resumable stages, actual-wallet quote refresh, gas funding checks, and independent user approvals. No transaction execution is enabled.

Validated with 14 focused tests and live quotes for both origins. Guidance: current MystenLabs frontend-apps/SKILL.md and non-react.md; Relay quote/v2 documentation.

# TREE Gateway v1 — Mayan cross-chain ingress

Status: non-production prototype.

## Visible quote preview

Open `/gateway/` on the PR deploy preview. Preview-only links on the homepage
and Command Center lead to this page. Published snapshot sources are unchanged.

The interface supports Base/Ethereum USDC or ETH and Solana USDC or SOL,
with TREE selected by default and direct SUI/native USDC destinations available.
The read-only `/api/tree-gateway-quote` endpoint requests live Mayan estimates,
checks token/chain identities and deadlines, and returns only display fields.
No signing, transaction construction, or execution endpoint is included.

TREE quotes show the bridge settlement leg only, with a visible warning that
final TREE output and its onward swap are not verified. Mayan quotes request
zero referral fees; the planned 25 bps Gateway fee is disclosed as excluded
and is not collected. Source gas and the onward swap are also excluded.
Quotes expire after at most 30 seconds and clear whenever inputs change.

Mayan request format verified against `mayan-finance/swap-sdk/src/api.ts` and
`src/utils.ts`; SDK version 15.2.2 is encoded as `15_2_2` on the quote API.
Run `node --test tests/tree-gateway-*.test.* tests/sti-preview-build.test.mjs
tests/sti-preview-proxy.test.ts` for the focused checks.

## Purpose

TREE Gateway brings assets from supported source chains into Sui using Mayan, then delivers the user's selected Sui asset. TREE is the featured/default destination but is not mandatory.

## v1 source chains

- Base
- Ethereum
- Solana

BNB Chain (native BNB) and Robinhood Chain (native ETH) now have indicative two-stage quotes: Relay to native Base USDC, followed by Mayan to Sui. They are not direct Mayan source routes.

## Route policy

1. **Mayan direct** — if Mayan can quote the requested Sui coin directly, use the direct cross-chain route.
2. **TREE fallback** — if TREE is not directly supported, settle through a verified Mayan-supported Sui asset and hand off to the existing TREE Smart Router.
3. **Other Sui asset fallback** — settle through a verified Sui asset, then use a separately verified Sui-side route.

No fallback may execute without a verified quote for every leg.

## Safety

- No custody by TREE Gateway.
- No real-funds execution is enabled by this prototype.
- Destination chain must be Sui.
- Destination token identity must match the requested verified coin type.
- Quotes with no positive output, mismatched source/destination metadata, or stale deadlines fail closed.
- Final Sui transactions must use the current @mysten/sui v2 / gRPC stack and wallet-owned gas selection.
- Post-write reads must wait for transaction finality before refreshing balances.

## Referral fee

Prototype configuration: 25 bps (0.25%), disclosed in the review UI before execution.

The actual referral addresses are deliberately not hard-coded in this prototype. They must be configured and verified for each relevant chain before execution is enabled.

## Next implementation gate

Before UI execution is enabled:

- fetch Mayan's live token list for Sui;
- prove direct destination support for TREE or mark TREE as fallback-only;
- prove Base/Ethereum/Solana routes with live quote fixtures;
- determine the best verified settlement coin for each unsupported Sui destination;
- simulate the Sui-side fallback route;
- add a transaction review screen showing Mayan fees, TREE Gateway referral fee, Sui-side swap costs, minimum received, and route status.

## Final TREE estimate in the review preview

Gateway now reads the existing public Smart Router quote service for SUI → TREE after obtaining the bridge quote. The exact bridge minimum (9-decimal SUI base units) is the onward input. The response is reduced to amounts, allowlisted venue, pool fee, price impact and the earliest stage expiry; transaction material is never forwarded. Unsupported USDC settlement and unavailable/stale/mismatched TREE responses retain an explicitly incomplete bridge-only estimate.

This is an indicative sequence, not an executable or guaranteed end-to-end minimum. Quotes must be refreshed after each arrival. Sui gas must be funded separately; no SUI gas reserve or planned 0.25% Gateway fee is deducted. No signing, submission, production code changes or production deployment is enabled.

Guidance consulted live: MystenLabs skills README; frontend-apps/SKILL.md; accessing-data/SKILL.md and use-cases.md; sui-sdks/SKILL.md; ptbs/SKILL.md. This change uses a fixed public HTTPS quote read, with no new Sui RPC client or PTB construction.
