# Generation 1 completed — November 23, 2026 (America/Chicago)

The user's single approved final BNB completion and actual Sui delivery independently
verify. Do not resend. The full private lifecycle is closed: original custody,
reserve delivery, 25-USDT private purchase and lock, NFT return, acknowledgement
and BNB pass burn, then final authenticated completion.

- BNB source: `0x3e62c5a7479937bc2e07756a8e8fdcf106c39a07131cdcb70542983dfe077bee`.
- Exact new adapter `send(4)`, admin 8789, nonce 4752, outbound nonce 2.
- Message fee **0.004577084124304116 BNB**; gas **0.00001765785 BNB**;
  actual total **0.004594741974304116 BNB**, within the approved 0.006 cap.
- Sui delivery: `EPyf5Kc1BzjFq519ng7F3Q5Gs2g3oVML2Cay4npq7TaR`.
- Exact Completed event: approved vault, generation 1, redemption request.
  PacketDelivered matches BNB 30102, exact zero-padded adapter, nonce 2, package.
- Vault is empty, bound, announced, **phase 3 / generation 1 / ack_sent true**;
  request and recipient match. Current vault version/digest matches delivery effects.
- Original NFTree #2720 retains its exact identity/type and ownership in Sui dev
  wallet **45c4**. Completion does not write or move the NFT.
- BNB remains **Retired, purchases paused, canPlay false**, zero admin pass balance;
  runtime hashes, bindings, security settings and applied acknowledgement still match.

The final completion spends no USDT. The earlier 25-USDT purchase remains paid to
unchanged treasury 3720; NFT redemption/completion does not refund that purchase.
Public sales and gameplay remain disabled. No further transaction is required to
close generation 1. No new deposit or generation is authorized by this evidence.

## Reproduce and verification boundaries

Node 24, pinned root and `contracts/bnb-generation` dependencies:

```sh
node --use-env-proxy docs/multichain/generation-milestone/completion-completed/verify.mjs
node --test docs/multichain/generation-milestone/completion-completed/verify.test.mjs tools/bnb-completion/core.test.mjs
```

All **59 focused checks passed**, including rejection of wrong NFT owner/type,
stale checkpoint, wrong request/generation/recipient, incomplete phase, missing or
duplicate completion, wrong delivery nonce/sender/digest, failed transaction,
changed vault effects, NFT movement, source fee changes and duplicate submissions.
The verifier uses only read-only BNB calls and the existing pinned Sui GraphQL
client. Current Mysten README plus accessing-data/GraphQL references were read.
No signing, execution, retries, dependency updates or website deployment occur.

`user-receipt.json` preserves the supplied receipt; it is not trusted as chain
proof. `rpc-reads.json`, `bnb-verification.json`, `sui-state.json`, and
`sui-delivery.json` contain independently fetched evidence. `verification.json`
is the combined result. `session.json` preserves source recovery information.
These current-state checks intentionally fail after a later generation or vault
mutation; do not weaken them or resend to obtain a passing result.

## Remaining work

Review the completed lifecycle evidence and product requirements before any later
milestone. Public rollout, gameplay activation, further deposits/generations and
new spending require their own concrete review/authorization. Preserve existing
Sui authentication, payments, games, scoring and tournaments. Main has advanced
to `6162edf` with unrelated Tree Army work; it was inspected and not reset or
overwritten. Before any future site release recapture the actual current full
production baseline; never publish the historical root build.
