# Empty custody slot created and verified

The user completed the approved empty-slot transaction in desktop Slush.
The connection troubleshooting is superseded by this successful signature and
mainnet receipt. The exact extension-side action that resolved account sharing
was not reported, so no further cause is inferred.

- Digest: `GNDWXqgPJnZyeQaVFqnZ1HuXSnSiHUAKV1vL4Ke49yMX`
- Gas: **3,892,851 MIST (0.003892851 SUI)**, below the approved 0.02 SUI maximum.
- Package: `0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`
- Registry: `0x298204d60d1a886e72f1ece18de179065d487a76420f93b19bf7f61c7275c210`
- **Real Vault / route:** `0xf5dff8e2cc96824f89735fa16c068ee8194fbb7e8d697aeebe5d135f8a5916eb`

Do not create another slot. This real Vault ID replaces all ephemeral IDs in
historical simulation packets for future planning. The old trial route stays retired.

## Verification evidence

`transaction.json` and `receipt.json` were fetched independently from mainnet,
not copied from the user message. The existing exact-action verifier passed:
correct sender, package/type, registry/AdminCap inputs, one create_slot call,
approved gas policy, one SlotCreated event, one new shared Vault and no NFT input
or transfer. Registry.slot matches the new Vault; Registry.cap is empty because
the same CallCap moved into the Vault. The vault is phase Empty (0), generation 0,
NFT absent, bound=false, peer/request/recipient zero, and no pending announcement
or acknowledgement. The admin remains dev-owned.

The user-supplied receipt observed checkpoint 348177699 at
`2026-11-23T01:09:31.132Z` (November 22, 19:09:31 America/Chicago).
Independent receipt-state verification observed checkpoint 348177884 at
`2026-11-23T01:10:16.142Z`. `candidate.json` independently confirms original
NFTree #2720 still has the exact admitted type/ID and remains in the dev wallet.
`capabilities-oapp.json` confirms the OApp AdminCap and UpgradeCap remain dev-owned
and the OApp still has no peers or pending send. These are checkpointed facts;
refresh ownership and identity again before any later NFT deposit.

## Reproduce

With pinned dependencies installed (`npm ci`):

```sh
node --test contracts/nftree-generation/scripts/slot-created.test.mjs
```

Validation: 122 receipt/readiness/wallet tests passed.

This verifies saved historical evidence offline, including negative checks for
changed digest, extra commands and a transferred admin capability. For fresh
read-only receipt verification, call `verifySlotReceipt(digest)` from
`contracts/nftree-generation/scripts/slot-handoff.mjs` using the digest above.
The client rejects submission operations. No runtime/contract/frontend change
is included in this evidence milestone and no website release was performed.

## Remaining milestones

Prepare the matching BNB deployment review and simulations using this real Sui
Vault/route, the selected Ledger-backed BNB admin and unchanged fee wallet.
BNB deployment, peer configuration, NFT deposit, sales and gameplay activation
still require their subsequent reviews and approvals. Keep the Sui vault empty
and unbound until those steps are ready. Do not use a simulated Vault ID or the
retired trial configuration. No further transaction is authorized by saving this receipt.
