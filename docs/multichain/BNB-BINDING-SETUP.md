# Pass verified; one-time BNB binding

Transaction `0x532199d60999a538991c000ec65db1f64a513eb2552c580627edb09c12faff1f` successfully deployed the pass at `0xe98fa205106028822572d2549ea41748f8bfd879` on BNB chain 56, block 133996393, from the designated BNB wallet at nonce 322. Actual gas fee: 0.0000851989 BNB. Exact creation input, zero value, sender, chain, nonce, predicted address and current runtime matched the reviewed pass draft.

Getter verification confirmed BNB USDT, the approved treasury, wallet A, zero wallet B, the verified adapter, Sui Bridge route and disposable NFT backing, price 25 × 10^18 and state Unconfirmed. The adapter remains unbound, and its binder is the designated BNB wallet. Receipt, getter responses and summary are stored alongside this note.

The next read-only simulation of `bindPass(pass)` against the live adapter succeeded, estimating 50,323 gas. Both pending/latest nonces were 323. No binding transaction was signed or broadcast by preparation.

The isolated `/play/multichaintest/setup/bnb/bind/` page submits only this fixed zero-value contract call after explicit user confirmation. The UI identifies the binding as permanent and one-time. The binding core pins both deployed code hashes and exact `bindPass(address)` calldata, checks identity and both nonces, confirms the adapter is unbound and the pass points back to it, simulates the actual call, estimates gas and checks native balance. It reuses the reviewed parent's quantity normalization, read deadlines, identity, storage and state validation. Cross-tab locking, durable pending state, rejection/ambiguous-error handling, and wallet-change checks remain in place. Signature requests are never automatically timed out or retried.

Receipt verification requires the successful zero-value transaction to the reviewed adapter with exact calldata/account/chain/nonce; the matching indexed `PassBound` event; both verified current code hashes; and the live reciprocal adapter/pass relationship. A pending receipt is not success. Existing creation-page code and configuration are not modified by this release.

This release adds exactly four new static files against production `6afb6f5dc358aa4d21c42598`. All existing published files, 49 backend package/provider/runtime records, five schedules, environment/runtime configuration and lock remain protected. The current MystenLabs skills README was checked. No Sui Move code, original NFTree collection, Sui wallet integration or Sui SDK changes are made.

After binding, Sui endpoint registration, both application peers/libraries/DVN/executor configuration, reserve delivery, the 25-USDT purchase and full redemption/acknowledgement round trip still remain. The suite's live ownership/payment checks are not wired to this disposable pilot.
