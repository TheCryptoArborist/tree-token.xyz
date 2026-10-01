# TREE FORCE '89 — mainnet wallet-role decision

Status: user-approved deployment inputs, not an executed deployment or enabled checkout.
Last revised: 2026-10-01, following Peter's administrator-only change at 11:58:14 UTC.

## Resolved wallet roles

### Checkout administrator and capability custody — changed

Peter selected this address as the replacement administrator:

`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`

Use this exact address for checkout administration and intended custody of both the checkout AdminCap and the package UpgradeCap when the reviewed publication is performed. This supersedes the earlier selection of the pilot-purchaser wallet for those administrative roles.

### First private-pilot purchaser — unchanged

`0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`

Retain this address for the first private-pilot purchase of one 20,000-TREE continue, after the payment flow is ready and the transaction is separately approved in the wallet. Peter changed the administrator only; do not substitute the new administrator as the purchaser or change the purchaser allowlist on that basis.

These roles are resolved; do not ask Peter to supply either address again. This records the user's designation, not independent proof of wallet control. A real signature must still establish control when an administrative or purchase action is performed. Do not create application-admin authority from an unauthenticated address string.

## Sales recipient — unchanged

All successful continue sales must still settle to:

`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

The replacement administrator is NOT a replacement sales recipient. All three addresses passed a local 0x-plus-64-lowercase-hex format check and are pairwise distinct. The existing purchaser-versus-recipient separation requirement remains satisfied. No balance, transaction history or on-chain ownership check was performed for this decision update.

The product remains 20,000 TREE per continue on Sui mainnet, three restored lives, the same wave and score, one continue per flight, and a free new game. No Canopy Credits package or dollar-price conversion is introduced.

## Deployment boundary

No AdminCap or UpgradeCap has been assigned or transferred by this document. Their ownership must be checked in the actual reviewed deployment transaction and confirmed from successful on-chain effects after publication. An alternative publishing wallet, including the pilot-purchaser wallet, must not silently retain the capabilities. If any capability already exists when deployment work resumes, verify its owner and prepare a separately reviewed transfer rather than treating this document as an on-chain change.

The backend quote-signing authority is a separate server-side role. Do not request or load the administrator wallet's private key or seed phrase into the application, repository, CI or quote service.

This wallet decision does not select an irreversible upgrade policy, approve an unspecified gas budget or cumulative pilot cap, waive the remaining security/recovery checks, activate a server allowlist, publish a Move package or authorize an automatic token transfer. Preserve the mainnet-first development decision; no Sui testnet setup is requested from Peter.

## Remaining release work

Complete the scoped order/quote, independent receipt-verification and paid-delivery runtime connection, checkpoint eligibility authorization, and operational handling for ambiguous interrupted delivery. Settle cumulative pilot limits and the reviewed deployment/gas configuration before publication and the restricted installed-wallet purchase test. The existing bounded event search must not treat an empty result as proof of nonpayment.

This document is the current wallet-role decision. It supersedes prior administrator selections in PR #49, `docs/direct-receipt-binding-validation.md`, and earlier reports. Their recorded implementation, deployment and test results remain historical and are not repeated or upgraded by this document.

## Decision history

- 2026-10-01 at 03:02:41 UTC: Peter designated `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6` for both administration and the first purchase test. Recorded in commit `c6506385df8263b2de4bb3d7c99f4a0946e203f9`.
- 2026-10-01 at 11:58:14 UTC: Peter changed only the administrator to `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`. The original pilot purchaser and sales recipient remain unchanged.

## Change scope and guidance

Documentation-only change on `feature/paid-continue-delivery` (draft PR #49). No runtime code, database, deployed preview, production branch, credit balance, checkout gate or on-chain object was changed. No funds moved and no game/payment tests were rerun for this documentation-only update.

Guidance reviewed live: MystenLabs/skills `README.md` and the publishing, signer/capability-custody and pre-publication sections of `sui-publish/SKILL.md`. Capability ownership is a deployment decision distinct from the sales-recipient setting.
