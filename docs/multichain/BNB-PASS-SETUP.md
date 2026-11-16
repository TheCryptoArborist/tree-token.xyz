# Adapter verified; pass wallet step

Adapter transaction `0xf06e6fbc4b99218c1cb68d216d16ac0164370a522c756d3fc5bd3633484643d2` succeeded on BNB chain 56, block 133994663, from the designated BNB wallet at nonce 321. It created `0xb4c471c1fb8e31ddcbb518277e97a4575fc74779`. Actual gas fee was 62,882,150,000,000 wei (0.00006288215 BNB), with zero native value transferred.

Verification compared the exact creation input, account, chain, nonce, value, expected address and current deployed runtime against the reviewed draft/simulation. On-chain reads confirm the endpoint, Sui original-package peer, Bridge route, disposable NFT backing, Sui EID 30378, binder and LayerZero delegate. The adapter's pass is still zero. The public node could not serve code at the historical receipt block (`missing trie node`); current runtime was verified instead. No historical-code claim is made.

The pass creation simulation against this live adapter succeeded with an estimate of 1,718,669 gas. Both pending/latest nonces were 322. The predicted pass is `0xE98Fa205106028822572d2549EA41748F8BFd879`. Records include the actual adapter receipt, verification reads, verified summary and pass creation simulation/preparation.

The separate `/play/multichaintest/setup/bnb/pass/` page offers only the next zero-value creation transaction for the existing designated BNB wallet. It uses the verified adapter as its required code-hash-pinned dependency. The constructor fixes the approved BNB USDT token, adapter, payment treasury, wallet allowlist, Bridge route and disposable NFT backing. The pass price remains 25 USDT but this transaction does not approve, transfer or charge USDT. Binding, protocol configuration, reserve announcement and the pilot purchase remain separate.

The pass page reuses the reviewed parent core and preserves all identity, nonce, code/hash, simulation, balance, consent, persistence and duplicate guards. Its own config is SHA-256 pinned and its submission state key is separate. Receipt verification reads current code after verifying the successful creation receipt and exact transaction, so pruned historical state does not block an otherwise verifiable deployment. Runtime evidence is explicitly returned as `runtimeCheckedAt: latest`; it is never labeled historical verification. Shared error messages now refer to a contract/dependency to cover both adapter and pass steps.

Publication adds only the three new pass-page files and replaces the reviewed shared core, pinned to its exact prior hash. Every other static byte, all 49 backend package/provider/runtime records, five schedules and configuration remain protected against current production `6afb6c49562ccf8e9c3da8f6`. No BNB pass transaction has been signed or broadcast by this preparation.

The current MystenLabs skills README was checked for this request. No Sui Move code, Sui wallet setting, original NFTree or Sui SDK was changed.
