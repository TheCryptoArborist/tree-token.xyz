# TREE Gateway v1 — Mayan cross-chain ingress

Status: non-production prototype.

## Purpose

TREE Gateway brings assets from supported source chains into Sui using Mayan, then delivers the user's selected Sui asset. TREE is the featured/default destination but is not mandatory.

## v1 source chains

- Base
- Ethereum
- Solana

BNB Smart Chain is intentionally excluded from v1 until an exact BSC → Sui route is proven with a live Mayan quote.

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
