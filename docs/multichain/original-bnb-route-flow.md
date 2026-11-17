# Original NFTree — BNB route configuration

Canonical signing page: /play/multichaintest/original/bnb/configure/.
Use Brave, BNB Smart Chain mainnet, account ending 83ae. The original Sui
configuration is confirmed by EFmDHsBSjkydv26Ajc8pvR9GFuNNmubo9tPjfrnc6Eos.
This stage configures the original adapter 0x90b5292a5074cfdd665c726b433cc0a97e0da6ab,
not the retired disposable-NFT pilot.

## Four separate approvals

1. Explicit SendUln302 library.
2. Explicit ReceiveUln302 library, zero grace period on this unused route.
3. Send executor (10,000 maximum bytes) and send ULN: 20 BNB confirmations,
   three required DVNs, no optional DVNs.
4. Receive ULN: 5 Sui confirmations, the same three required operators,
   no optional DVNs.

The operators are Horizen, Twinstake and LayerZero Labs, using the classic
non-lzRead addresses confirmed by official deployment metadata. EVM raw optional
DVN count is 255 to explicitly disable optional verifiers; effective count is 0.
A raw count of 0 would inherit defaults and is deliberately not used.
Frozen unsigned artifact: original-trial/bnb-route-unsigned.json.

## Verification and recovery

Before each wallet handoff, check Sui genesis, signed publication, slot,
registration and configuration receipts, live explicit Sui settings, source
capabilities, original #2720 ownership and empty/unbound Vault. Verify the
confirmed BNB pass binding, contract runtimes, immutable bindings, 25-USDT price,
treasury, paused/unminted pass, protocol code and exact route sequence.
Public RPC fallback handles reads only; selected extension handles actual
account/network identity and every signing request. The assistant signs nothing.

Route reads use one block and batches of three. Protocol defaults are pinned
separately; unexpected mixed settings or changed defaults fail closed. Nonce is
read dynamically, latest must equal pending. Each request is simulated with
zero native value. Gas estimate is bounded, allowance cannot exceed 0.01 BNB,
and the transaction supplies the reviewed gas price and limit. A changed stage,
nonce or fee estimate requires review. Fresh checked values must match the
reviewed values before handoff.

A Web Lock and durable exact stage/nonce/target/calldata-hash pending record
precede the signing request. Only explicit wallet rejection clears it without
a verified receipt. Ambiguous responses block duplicate submissions. The page
shows Check receipt and continue alongside the approval button and a manual
hash input. Receipt verification requires exact sender/target/chain/value,
one of the four exact calldata values, exact ordered logs and current matching
route/source/paused-pass state. A recorded pending request also requires the
same nonce and stage. A wallet Speed Up replacement can supply a different hash;
the exact recorded nonce, stage, target and calldata must still match.
Cleared browser storage can recover an exact signed
receipt without submitting another transaction.

## Validation and release

Read-only mainnet calls independently simulate all four unsigned requests.
The separate ephemeral local fork executes the entire sequence and verifies
each real contract event and all five observed route stages. Local fork hashes
are simulation evidence, never mainnet receipts. Source state and actual signed
Sui settings are independently checked. No actual BNB configuration transaction
is submitted by the assistant.

Publish only the new index.html/app.js/core.js, preserving all 598 existing
static paths, all 49 backend packages/provider/runtime records, configuration
fingerprints and five schedules. Existing pages and frozen snapshots remain
unchanged. The new canonical page must be checked after the locked release.

This stage does not bind the Sui peer, deposit an NFT, send a packet, mint a
pass, unpause purchases or charge stablecoins. Those remain later explicit
steps after complete route verification. Broader collection inventory work is
separate from this one-original-NFT trial.

Current MystenLabs guidance consulted: accessing-data/SKILL.md and
accessing-data/graphql.md. Existing pinned Sui SDK and read-only GraphQL checks
are preserved. No Move code, SDK upgrade or signing-key handling is introduced.
