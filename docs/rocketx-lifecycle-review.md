# RocketX lifecycle review — 2026-09-29

Scope: PR46, preview only, native BNB / Robinhood ETH to native SUI. No order, deposit address, signature, payment or refund request was created. The new deposit/status adapters are offline contract checks tested with synthetic fixtures; they are not a live tracker or a funding authorization.

## Verified documentation

- [Official API reference](https://documenter.getpostman.com/view/8177220/2sBXcHjKfY): POST /v1/swap creates a request ID and deposit instructions. Bind provider/token IDs to a fresh quote; explicitly set Sui recipient. Walletless routes do not require a userAddress in the quote guidance, despite the swap section marking it required. Preserve source ownership for recovery. A separate refund address is conditional on isRefundAddressRequired.
- The deposit description says fund within five hours, but does not provide a complete provider-specific expiry contract. Never treat a 30-second quote refresh timer as the deposit deadline.
- GET /v1/status uses requestId; txId is optional for walletless routes. For non-walletless routes, the docs say a status call with the source hash completes the process, so it must not be treated as a universally side-effect-free lookup. No status request was issued against unrelated or fabricated IDs.
- Documented substates: transaction_pending, pending, approved, executed, withdrawal, withdraw_success, invalid. Provider success is not independent proof of native SUI delivered to the bound recipient.
- [Refund policy, section 18](https://cdn.rocketx.exchange/pd135zq/docs/rocketx-exchange-terms.pdf): support-mediated, conditional recovery; fees may be deducted. Failed does not imply refunded. Official Help is the support channel. Do not promise a refund deadline or guaranteed full return.

## Implemented preview work

- Quotes request disableRoutesWithMemo=true, retain provider refund-address/memo flags as true/false/unknown, and keep secrets server-only.
- A compact collapsed Transfer steps & recovery panel explains one source payment, subsequent tracking, recipient checks and recovery. No fake deposit address or active order UI.
- Offline deposit checks bind request, provider, assets, source amount, recipient echo, plain native transfer and fee. Changed/missing recipient, contract calldata, memo, wrong amount or a 0.4%→0.6% fee change fails closed. No transaction payload is returned.
- Offline status checks reject wrong request, recipient, asset, provider and amount. Unknown/malformed/failed/time-out states do not invite resending or claim refund. Even withdraw_success is receipt-pending, never confirmed delivery.
- Offline order preparation now explicitly preserves the reviewed fee, provider/token IDs, amount and recipient. It rejects stale quotes, missing refund requirements and amounts that a JSON number cannot represent exactly. Where required, the refund address must be the separately reviewed source address. No request is sent by this helper.
- If creation omits the recipient, an independently obtained status for the same order can supply it only when assets, amount, recipient and deposit address agree and the order is still unfunded. A conflicting creation recipient is never overwritten. Six synthetic order/status tests pass; this is not live order verification.

## Still required before order/payment enablement

### Wallet review validation — 2026-09-29

- The user confirmed that BNB Chain → SUI in PR46's preview shows both the Brave source address and Slush receiving address, plus the source BNB balance. This is user-reported extension validation; no signature or transfer was requested.
- Three controller integration tests execute the actual wallet controller with simulated DOM and providers. They cover BNB and Robinhood source-only balance reads, network mismatch blocking, account/Sui changes, and delayed responses after disconnect or route changes. No real accounts or provider calls are used by these tests.
- The live Robinhood wallet connection has not been independently confirmed. Wallet connection and balance display do not validate order creation, fee parity, delivery or refunds.

### Remaining order and payment work

1. Resolve quote/order fee parity: authenticated quotes were 0.4%; swap docs default to 0.6% and contain conflicting minimum-fee statements. Validate actual final order fee with provider confirmation or an approved sandbox/unfunded-order test.
2. Confirm walletless destination echo and refund address semantics for the selected provider. The documented creation sample omits destinationAddress; the offline checker deliberately refuses that incomplete response until a bound response verifies it.
3. Confirm provider-specific deposit deadline, under/overpayment, delayed deposits, refunds and source-gas accounting.
4. Add durable private order storage and idempotency/reconciliation before retryable creation calls. No public arbitrary-ID tracker; bind status to the user's order/session. Never create a replacement order after a timeout without reconciling the prior call.
5. Add independent Sui Mainnet transaction/recipient/native coin credit verification using current gRPC/GraphQL, followed by failure/recovery validation. A hash or provider success flag alone is insufficient.
6. Confirm supported regions and provider terms before enabling payment. No automatic SUI→TREE swap; retain user review and SUI for gas.

## Questions prepared for RocketX (not sent)

For BNB and Robinhood native ETH → SUI walletless routes: is a sandbox or non-executable order validation API available? How should our quoted 0.4% fee be preserved in /swap? Which response verifies the bound Sui destination, precise deposit deadline and refund address? What are the idempotency and lookup semantics after a timed-out /swap request? What are the status/refund states and underpayment, overpayment, expired/late-deposit recovery rules for the selected providers?

Guidance consulted live: MystenLabs skills README, frontend-apps/limitations.md, accessing-data/SKILL.md and accessing-data/use-cases.md; Netlify Functions guidance and serverless coding context. No new Sui transaction code was added.
