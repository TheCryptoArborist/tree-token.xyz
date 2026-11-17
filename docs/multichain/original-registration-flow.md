# Original NFTree LayerZero registration

This page registers the confirmed original NFTree application on Sui mainnet.
Canonical path: /play/multichaintest/original/register/.
Use the existing Slush extension in Brave and Sui dev account ending 45c4.

One PTB calls the deployed package vault::register<original collection::NFT>
with the actual empty Vault read-only, matching dev-owned vault AdminCap, mutable
Sui LayerZero EndpointV2 and empty vector<u8> metadata. Wallet gas stays unresolved
and is selected by Slush. The returned address has drop and needs no extra command.
The package CallCap identity, not shared OApp ID, is registered.

The current endpoint/table identity and absent registration are checked.
The actual BNB binding receipt, exact PassBound event, reviewed contract runtimes,
fixed price/treasury/controller and paused/unminted pass are independently verified
through read-only public BNB calls. These calls check the public historical sender;
they do not claim an active BNB wallet connection. Sui chain, publication/slot
receipts, current dev-owned original NFT/capabilities and empty unbound Vault
are checked through the pinned SDK 2.26.1 and existing GraphQL helpers.

Fresh checked simulation validates exact sender/gas owner, one MoveCall, original
type arguments, exact four inputs, empty metadata, one registration event, only
the new shared messaging channel and typed registry field, permitted endpoint/
admin/gas effects, net gas under 0.1 SUI and no other balance change. An ephemeral
created-and-deleted UID effect from the endpoint channel creation and gas balance
accumulator effects are permitted. NFT, Vault, original Registry, shared OApp and
other authority/configuration objects must not be changed.

The page uses a two-minute quote and repeats preflight before user approval.
Wallet identity/network/epoch or fee drift invalidates review. Web Locks and
durable storage prevent duplicate handoffs. Ambiguous errors keep the pending
guard; explicit rejection or known failed execution clears it. Receipt recovery
validates the exact transaction/event and current channel/registry entry,
unchanged source state and BNB binding before clearing pending state.

Unsigned simulation evidence: original-trial/registration-simulation.json;
validated net gas 4,668,124 MIST (0.004668124 SUI). Channel/field IDs in this
evidence are simulation-only. Do not use them as deployed configuration.
No original NFT deposit, USDT charge, mint, sale activation, cross-chain send,
peer/library/DVN/executor change or assistant submission occurs in this step.
Execution metadata and route settings are separate reviewed approvals.

Publication adds exactly index.html, app.js and core.js under the new path,
preserving all 592 existing paths, 49 complete backend packages, full runtime/
provider/configuration/environment fingerprints and five schedules. Expected
locked baseline: 6afcbf06032b351187d30179. Total after release: 595 paths.
All older signing snapshots and wallet bundles remain byte-identical.

Guidance checked live on 2026-11-17:
https://github.com/MystenLabs/skills/blob/main/README.md
https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md
https://github.com/MystenLabs/skills/blob/main/ptbs/building.md
https://github.com/MystenLabs/skills/blob/main/ptbs/commands.md
https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
https://github.com/MystenLabs/skills/blob/main/frontend-apps/transactions.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md

Pinned LayerZero endpoint_v2::register_oapp and oapp_registry::register_oapp
source was inspected; it permits empty metadata and enforces one registration.
No dependency, contract source or live Arcade wallet integration is upgraded.
