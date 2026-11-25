# Reserve source and forward delivery complete — November 23, 2026

The user signed the approved atomic NFTree #2720 deposit and reserve send.
Sui digest: `i6nTSPBKFSUf7GXhsnocnFfuuMtkqvQASR91YTZZdfE`.
Independent verification confirms exact transaction commands/references, fee
payees, custody effects and retained route security. Original #2720 is wrapped
in new vault `0xf5dff8e2cc96824f89735fa16c068ee8194fbb7e8d697aeebe5d135f8a5916eb`,
phase 1, generation 1, announced. Do not repeat this transaction.

Actual native message fee: **0.094851295 SUI**. Net gas: **0.003992655 SUI**.
Combined actual cost: **0.09884395 SUI**, within the 0.35-SUI ceiling. The verifier's
historical `estimatedTotalMist` field is computed from actual effects for a receipt;
here it equals 98843950 MIST. No USDT payment occurred in this transaction.

The user's initial receipt correctly reported pending BNB delivery. A subsequent
independent query confirms the adapter stored the exact expected payload hash,
with the pass **Ready, generation 1, purchasesPaused true, canPlay false**.
Destination transaction:
`0x689d2c8683f56af38d9e94ee032872829bef97a2673b77dd2f72c060e0860024`,
block `0x8105c0b`, successful canonical receipt. Its adapter MessageApplied event
matches kind 1, generation 1 and GUID
`0xecfb51b3c1866ca41d2698129f8247504c83b759812a84df0bd30990c41f03f8`.
The same receipt contains the new pass's ReserveConfirmed(1) event. No token has
been purchased or minted. This proves the first forward delivery, not the return
or complete redemption lifecycle.

## Evidence and reproduction

- `user-reported-status.json`: summary of initial pending receipt.
- `transaction.json`: independently retrieved Sui transaction, effects and events.
- `sui-read-*.json`: recorded GraphQL queries/results, including current custody
  and security state. The two transaction reads are intentional capture + verifier.
- `bnb-rpc-reads.json`: exact read-only receipt, code and configuration RPC checks.
- `verification.json`: successful combined source/current destination verification.
- `bnb-delivery.json`: destination logs, successful receipt, canonical block hash
  and decoded application events.

From root with pinned Node 24 dependencies installed:

```sh
node --use-env-proxy docs/multichain/generation-milestone/reserve-completed/verify.mjs
```

This only reads chains and writes evidence; it never signs or submits. It checks
current phase-1 custody and pending/Ready state, and deliberately fails after later
lifecycle transitions. The first independent attempt encountered a transient BNB
RPC response error; a full new verification completed successfully. No write or
message retry occurred. No source or live-site code was changed for this receipt.

## Next reviewed milestone

Prepare the exact private 25-USDT acquisition and subsequent redemption fee/recovery
review, including purchase-unpause scope, exact allowance, buyer/treasury identities,
current quotes and expected transitions. Purchase is a real payment to the unchanged
treasury; redemption does not refund it. No private purchase, unpause, USDT allowance,
redemption or gameplay activation is authorized by receipt reconciliation.

The original remains in custody. There is no direct admin withdrawal under the
published lifecycle. Normal return proceeds through private acquisition, redemption
lock, return delivery, burn acknowledgement and generation completion. Follow
`../delivery-review/README.md`; its earlier pre-deposit status is historical.
Existing Sui authentication, payments, games, scoring and tournaments are unchanged.
