# TREE FORCE '89 — mainnet wallet-role decision

Status: user-approved deployment inputs, not an executed deployment or enabled checkout.

## Resolved wallet roles

Peter supplied the following public Sui address in direct response to the request for one address to use for both administration and the first purchase test:

`0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`

Use this exact address for:

- Checkout administrator and intended custody of the checkout AdminCap.
- Intended custody of the package UpgradeCap when the reviewed publication is performed.
- First private-pilot purchaser of one 20,000-TREE continue, after the payment flow is ready and the transaction is separately approved in the wallet.

These roles are now resolved; do not ask Peter to supply the administrator or first-purchaser address again. This records the user's designation, not independent proof of wallet control. A real signature must still establish control when an administrative or purchase action is performed. Do not create application-admin authority from an unauthenticated address string.

## Sales recipient remains unchanged

All successful continue sales must still settle to:

`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

The administrator/pilot-purchaser address is NOT a replacement sales recipient. Both addresses passed a local 0x-plus-64-lowercase-hex format check, and they differ, satisfying the existing purchaser-versus-recipient separation requirement. No balance, transaction history or on-chain ownership check was performed for this decision record.

The product remains 20,000 TREE per continue on Sui mainnet, three restored lives, the same wave and score, one continue per flight, and a free new game. No Canopy Credits package or dollar-price conversion is introduced.

## Deployment boundary

No AdminCap or UpgradeCap has been assigned by this document. Their ownership must be checked in the actual reviewed deployment transaction and confirmed from successful on-chain effects after publication. An alternative publishing wallet must not silently retain the capabilities.

The backend quote-signing authority is a separate server-side role. Do not request or load the administrator wallet's private key or seed phrase into the application, repository, CI or quote service.

This wallet decision does not select an irreversible upgrade policy, approve an unspecified gas budget or cumulative pilot cap, waive the remaining security/recovery checks, activate a server allowlist, publish a Move package or authorize an automatic token transfer. Preserve the mainnet-first development decision; no Sui testnet setup is requested from Peter.

## Remaining release work

Complete the scoped order/quote, independent receipt-verification and paid-delivery runtime connection, checkpoint eligibility authorization, and operational handling for ambiguous interrupted delivery. Settle cumulative pilot limits and the reviewed deployment/gas configuration before publication and the restricted installed-wallet purchase test. The existing bounded event search must not treat an empty result as proof of nonpayment.

The role-selection entries previously listed as unresolved in `docs/hosted-continue-readonly-deployment.md` and PR #49 are superseded by this decision. Their deployment/test results remain historical and are not repeated or upgraded by this document.

## Change scope and guidance

Documentation-only change on `feature/paid-continue-delivery` (draft PR #49). No runtime code, database, deployed preview, production branch, credit balance, checkout gate or on-chain object was changed. No funds moved and no game/payment tests were rerun for this documentation-only update.

Guidance reviewed live: MystenLabs/skills `README.md` and `sui-publish/SKILL.md`, including the signer/capability custody and pre-publication sections. Capability ownership is a deployment decision distinct from the sales-recipient setting.
