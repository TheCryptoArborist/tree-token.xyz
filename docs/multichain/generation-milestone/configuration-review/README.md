# New generation security configuration and binding review

**Prepared and simulated only. No transaction submitted, no site deployed.**
Registration is complete. This review uses actual channel
`0x63ee0fb967cf71aecd39d095a02aae6607d18b087c9537f4d7c4d0c8cf199023`, shared
version 1089269258, and only the new generation package/vault and BNB adapter.
No retired route is a write target. Exact unsigned transaction JSON, effects,
events and simulation-scoped object contents are in `sui/`; exact BNB calldata,
local receipts, runtime hashes and before/after reads are in `bnb-fork-review.json`.
Saved simulation bytes are historical evidence, not reusable signing packets.

## Proposed transactions and limits

| Order | Wallet | Action | Simulated net cost | Proposed ceiling |
| --- | --- | --- | --- | --- |
| 1 | Slush dev ending 45c4 | Explicit Sui libraries, executor, verification settings and receiver metadata | 0.014951541 SUI | 0.1 SUI |
| 2–5 | MetaMask/Ledger admin ending 8789 | BNB send library, receive library, send settings, receive settings | 0.00002372695 BNB total at the read quote | 0.0001 BNB total |
| 6 | Slush dev ending 45c4 | Bind empty Sui vault to new BNB adapter; initialize peer channel and enforced options | 0.009266747 SUI | 0.1 SUI |

Total estimated Sui cost is 0.024218288 SUI; proposed total maximum is 0.2 SUI.
These are new proposed limits, not an extension of registration approval.
Before signing, refresh state, simulation and fee quotes. Verify configuration
receipts on both chains before enabling the final binding signature. BNB steps
must resume from verified receipts and never repeat a pending transaction.
No signing page is added in this review. Any later handoff stays under
https://tree-token.xyz/play/ and preserves the full current production inventory.

## Exact security policy

Both directions require **all three** classic Horizen, Twinstake (metadata id
`nethermind`) and LayerZero Labs operators. No optional verifiers. An unavailable
required operator can delay delivery; pending redemption remains locked. Sui
currently inherits four operators, so this proposal explicitly replaces inheritance
for this application; it is not a claim that defaults already match.

- Sui send / BNB receive: 5 confirmations.
- BNB send / Sui receive: 20 confirmations.
- Explicit ULN302 send and receive libraries; zero receive-library grace period
  on this new, empty path.
- Explicit LayerZero executor, maximum message size 10,000 bytes.
- Sui disables all three default-inheritance flags. BNB stores optional count
  sentinel 255; the effective optional count is zero.
- Receiver metadata calls only the new package's `vault::lz_receive`, with the
  new Vault, OApp and exact original collection type. No ordered nonce callback.
- Sui binding targets adapter `0x74c20dEB476Dca58459956b1AcD65771197900C9`, not
  the pass. BNB already pins the new Sui package and vault route immutably.
- Binding enforces 200,000 destination BNB gas for reserve/ack messages (types 1
  and 3), as compiled in the vault. The deployed adapter's Sui receive option is
  30,000,000 gas units. This review does not change it. Configuration simulation
  is not end-to-end delivery or executor-capacity proof; delivery/fee checks are
  required before funding or sales.

## Evidence and checks

151 local automated checks passed, including 25 new configuration/binding checks.
[Hosted regression run 45111374252](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45111374252)
passed for source commit `6f6126f`: 187 Sui/handoff checks, 16 EVM contract
tests, 55 EVM wallet/review checks and 52 Move tests. Release bytecode and
frontend bundle comparisons passed unchanged.
Fresh checks-enabled Sui simulations verify exact commands/inputs, all expected
events, permitted object writes/creation, capability ownership and gas-only
balance changes. A second simulation of the same bytes reads resulting objects:
all four app configuration entries and receiver metadata match; binding changes
only the intended vault peer/bound fields, OApp/channel tables and options.
Custody remains empty and generation zero in the simulated bound state.

Negative mainnet simulations reject duplicate binding with `vault::bind` abort
code 5, and reject unauthorized configuration/binding at input ownership checks.
All four BNB calls reject another caller with exact `LZ_Unauthorized()` in the
local fork. The fork confirms explicit stored/effective settings and inactive
pass state. No remote RPC writes are permitted. Fresh after-reads confirm live
custody is still unbound and empty, with the BNB pass paused, Unconfirmed,
generation zero and non-playable.

The unchanged contract lifecycle tests remain in CI. This change adds review
builders/verifiers; it does not change or upgrade either deployed contract.

## Sources and reproduction

MystenLabs/skills README was fetched again at
`a384d9a158c4639f075ad3f6644d925108ddfc78`. Read ptbs, accessing-data and
sui-ts-sdk-backend skills, with building, commands, GraphQL and transactions
references. The pinned SDK and working wallet code are unchanged. Queries use
GraphQL; Sui JSON-RPC is deprecated. LayerZero metadata was refreshed from its
official deployment API (`protocol-metadata.json`). Configuration encodings were
checked against the vendored LayerZero source and existing tested codecs; the
new builders import no historical trial identity or signing code.

Node 24, `npm ci --ignore-scripts`; for fork checks also
`npm ci --ignore-scripts --prefix contracts/bnb-generation`.

```
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-registration/*.test.mjs contracts/bnb-generation/test/path-review.test.mjs
node --use-env-proxy contracts/nftree-generation/scripts/prepare-configuration-review.mjs /tmp/new-generation-config-review
node --use-env-proxy contracts/nftree-generation/scripts/configuration-negative-review.mjs /tmp/new-generation-negative-review.json
```

The output paths must be new. For a fresh BNB fork, put reviewed refreshed
`protocol-metadata.json` in a new directory, then run:

```
node --use-env-proxy contracts/bnb-generation/scripts/path-review.mjs /tmp/new-bnb-config-review
```

Mainnet simulation and public reads require network access. Current-state guards
intentionally stop after any configuration or binding is applied. New wallet
handoffs must reconcile partial progress and use stage-specific validators.

## Remaining gates

Review/approve these six live configuration/binding transactions and fee ceilings;
then implement the canonical handoff with fresh state and receipt recovery.
Reconcile every signed receipt before progressing. Refresh #2720 identity and
ownership again before any later deposit. Deposits, sales and gameplay activation
remain separate milestones. Registration alone did not approve those actions.
