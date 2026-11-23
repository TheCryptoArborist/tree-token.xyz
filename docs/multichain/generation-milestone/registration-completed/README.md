# Sui registration completed — November 22, 2026

The user signed the approved registration in desktop Slush. Independent reads
verified the successful transaction, exact command and object references, events,
effects, gas, current registration entry and messaging channel. The user receipt
matches the independent verification on every milestone identifier and result.
Do not repeat registration.

- Digest: `DF8dMqSXXtYBoemHsPYk2QJDkuUY2m8zTRDdcu6Y9DFt`
- Package: `0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`
- Vault: `0xf5dff8e2cc96824f89735fa16c068ee8194fbb7e8d697aeebe5d135f8a5916eb`
- Actual messaging channel: `0x63ee0fb967cf71aecd39d095a02aae6607d18b087c9537f4d7c4d0c8cf199023`
- Registry entry: `0x6e8f3156b67d9e5f35c4874604b868bdecf9df52d61a6be90a87b5033ecd9d3a`
- Net gas: **0.004668124 SUI**, below the **0.02 SUI** approved maximum.
- Channel initial shared version: **1089269258**.

The registration entry points to this actual channel with empty metadata and a
zero delegate. The shared channel belongs to the new package, has zero peer
channels and is not sending. The vault remains empty, unbound, phase zero and
generation zero. The Vault AdminCap remains in the dev wallet ending 45c4.
The transaction effects do not modify the NFT, custody, registry, OApp admin
capability or upgrade capability. Fresh BNB checks confirm the reviewed runtime,
completed deployment receipts and binding, purchases paused, Unconfirmed state,
generation zero and canPlay false. Cloud submitted no transaction.

Evidence: `user-receipt.json` is the supplied receipt; `verification.json` is a
fresh independent query through the committed verifier; `transaction.json` is
raw transaction data, effects, events, balance changes and BCS from Sui GraphQL.
The verifier uses read-only Sui queries and BNB RPC reads. This documentation
change does not deploy a site, change contracts or configure either chain.

## Reproduce

From the repository root, use Node 24 and the pinned dependencies (`npm ci
--ignore-scripts`). With network access:

```sh
node --use-env-proxy --input-type=module - <<'JS'
import {verifyRegistrationReceipt} from './contracts/nftree-generation/scripts/registration-handoff.mjs';
console.log(JSON.stringify(await verifyRegistrationReceipt('DF8dMqSXXtYBoemHsPYk2QJDkuUY2m8zTRDdcu6Y9DFt'),null,2));
JS
```

This verifier intentionally checks current empty/unbound/inactive state as well
as historical execution. After a later approved configuration milestone changes
that state, use the saved historical proof and a verifier appropriate to the new
stage; do not interpret a future precondition failure as a failed registration.

## Next milestone

The explicit message-path security configuration and Sui peer binding are now
prepared and simulated using the actual channel above; see
[configuration review](../configuration-review/README.md). Review the complete two-direction
configuration and executor requirements before presenting concrete transactions
for approval. The existing proposal is in `../path-review/README.md` and has not
been submitted. Do not use simulated channel IDs or reopen the retired trial.
Refresh original NFTree #2720 identity and ownership before any later deposit.
Deposits, sales and gameplay activation remain later reviewed milestones.
