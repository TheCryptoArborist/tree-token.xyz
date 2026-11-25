# Sui configuration completed — step 1 of 6

The user signed the approved Sui configuration in desktop Slush. Independent
verification confirms successful exact execution and current application state.
Do not repeat configuration, registration, slot creation or deployment.

- Digest: `6sbCjzYbNLWYBY8QuZjLyKeGnGZjtLUWktmrZZb1fRU8`
- Actual messaging channel: `0x63ee0fb967cf71aecd39d095a02aae6607d18b087c9537f4d7c4d0c8cf199023`
- Net gas: **0.014951541 SUI**, below the **0.1-SUI** step limit.
- The six-step approval remains **0.2 SUI combined** for two Sui transactions
  (0.1 each) and **0.0001 BNB combined** for four BNB transactions.

All four explicit app entries match: ULN302 send/receive libraries, LayerZero
executor with maximum message size 10,000, Sui-send confirmations 5 and
Sui-receive confirmations 20. Both directions require all three selected
Horizen, Twinstake and LayerZero Labs verifiers with no optional verifiers and
no default inheritance. Receiver metadata targets only the new vault, OApp and
exact original collection type. The actual registered channel and zero delegate
are unchanged. Admin ownership and protected custody effects are verified.

Fresh reads confirm original NFTree #2720 is still owned by the dev wallet;
custody is empty and unbound. The BNB pass remains paused, Unconfirmed,
generation zero and non-playable. No deposit, sale or gameplay was activated.
Cloud signed/submitted no transaction. This receipt update deploys no website.

## Evidence and reproduction

`user-receipt.json` is the supplied result; `verification.json` is the fresh
independent verification; `transaction.json` contains raw successful transaction
BCS, effects, events, balance changes and object types. All milestone identifiers,
configured entry IDs, gas and result flags match the supplied receipt.

With Node 24, root pinned dependencies and network access:

```sh
node --use-env-proxy --input-type=module - <<'JS'
import {verifyConfigurationReceipt} from './contracts/nftree-generation/scripts/configuration-handoff.mjs';
console.log(JSON.stringify(await verifyConfigurationReceipt('6sbCjzYbNLWYBY8QuZjLyKeGnGZjtLUWktmrZZb1fRU8'),null,2));
JS
```

The verifier checks current unbound/inactive state as well as historical execution.
After final binding or funding, use a stage-appropriate current-state check and
the saved historical transaction proof. A changed precondition does not mean this
configuration failed. The earlier registration-only preflight deliberately expects
empty metadata and must not be reused to gate the now-configured application.

## Next approved steps

Prepare the four BNB configuration calls (steps 2–5) for MetaMask with Ledger,
admin ending 8789, using this verified configuration as the Sui prerequisite.
Their combined fee ceiling remains 0.0001 BNB; deployment fees belong to the
previous milestone and are not charged against this configuration allowance.
Recheck fresh chain state, runtime hashes and fees, persist pending progress,
verify each receipt and resume without repeated transactions. Do not request the
six-step approval again unless scope or ceilings change.

After all four BNB receipts and both directions' settings are verified, expose
final Sui binding (step 6), capped at 0.1 SUI. Custody must still be empty and
unbound beforehand. Any signing page must stay under https://tree-token.xyz/play/
and preserve the entire current published site inventory. NFT deposits, public
sales and gameplay activation remain separately reviewed future milestones.
