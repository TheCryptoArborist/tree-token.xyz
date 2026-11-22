# Empty custody slot — prepared, not submitted

The verified published package is ready for a separate empty-slot transaction.
The user subsequently approved the exact action and canonical signing page; see
[approval.json](approval.json) and [handoff.md](handoff.md). Execution still requires
the user's wallet signature.

## Exact proposed action

Call `vault::create_slot<original_collection::NFT>` once on package
`0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`.
Use the published shared registry
`0x298204d60d1a886e72f1ece18de179065d487a76420f93b19bf7f61c7275c210`
and dev-owned AdminCap
`0x4e7fde0fa22d78a2916f7ea8d2e7d4688d04ee4c60152d8a09d4a334e89f6aac`.
Signer and gas payer remain the approved Sui dev wallet ending `45c4`.

Estimated net gas: **3,892,851 MIST (0.003892851 SUI)**.
Proposed maximum budget: **20,000,000 MIST (0.02 SUI)**, paid from address balance.
The full unsigned bytes, hash, simulation and before/after checkpoint observations
are in [simulation.json](simulation.json). Simulated object IDs are **not deployed
addresses**. Rebuild and re-simulate before any signature; saved bytes are review
evidence and have a bounded epoch validity window.

The action creates one shared, empty Vault and fills Registry.slot. It moves the
package CallCap from the Registry into that Vault. The AdminCap stays owned by
the dev wallet (its object version advances as a transaction input); UpgradeCap
and OApp AdminCap are not inputs. The pinned initializer sets generation 0,
phase Empty, no NFT, zero peer, bound=false, and no pending message. Slot creation
is one-time and cannot be reset. Later binding/deposit require separate actions.
No original NFT is an input; no BNB peer is configured; no sale or gameplay is
activated. The retired trial route is untouched.

## Validation

Mainnet checks-enabled simulation succeeded. Fresh before/after observations show
the registry still has no slot, peers remain empty, all capabilities retain their
owners, and original NFTree #2720 remains in the dev wallet. No transaction was
submitted. Candidate identity/ownership must be refreshed again before deposit.

Live adversarial simulations in `negative-simulations.json` prove a second slot
call in the same transaction aborts with ESlotUsed (3), rolling back the first
call, and a different NFT type aborts with EWrongType (2). Neither leaves a created
vault or event. **91 local tests passed**, including 13 slot review tests that
reject changed sender/type/inputs, extra commands/objects/payments, moved admin,
wrong event backing, wrong chain and increased budget. Prior contract tests cover
unauthorized access, generation allocation and redemption; contract code is unchanged.

## Reproduce

Use the pinned root dependencies (`npm ci`) and Node 24. In a proxy-based Cloud
workspace, retain `--use-env-proxy`; otherwise it is optional. Each output filename
must be new so prior evidence is preserved.

```sh
node --use-env-proxy contracts/nftree-generation/scripts/slot-review.mjs /tmp/new-slot-review.json
node --use-env-proxy contracts/nftree-generation/scripts/slot-negative.mjs /tmp/new-slot-negative.json
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-publication/core.test.mjs
```

The client permits only mainnet GraphQL queries and simulation, rejecting mutation
and execution requests. There is no signer. MystenLabs/skills README was freshly
fetched at `a384d9a158c4639f075ad3f6644d925108ddfc78`; applicable PTB and SDK backend
skills and their building/commands/transactions references were read. SDK remains
pinned at 2.26.1. Explicit gas and full-byte simulation are used for this bounded
review, consistent with the existing publication handoff; no wallet integration
or dependency migration is included.

## Remaining boundary

Approval for this exact empty-slot action and 0.02 SUI maximum is recorded in
`approval.json`. Any signing handoff must be served under
`https://tree-token.xyz/play/`, with a fresh production capture and preservation
release. No signing page or production file changed in this preparation milestone.
After execution, independently verify the real Vault ID, Registry.slot, empty
state and retained capabilities before considering peer binding or deposit.
