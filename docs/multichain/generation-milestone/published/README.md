# Empty Sui publication receipt

Publication completed on Sui mainnet on November 22, 2026. The user signed
through desktop Slush on `https://tree-token.xyz/play/generation-publication/`.
Do not publish this package again. This is the new generation package, not the
retired trial vault/pass/route.

- **digest:** `DVoQj1tPzfASPesS1bdEsEBQnQ7AhzNS4kxeuEiQVq6S`
- **gasMist:** `69723600`
- **packageId:** `0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`
- **registryId:** `0x298204d60d1a886e72f1ece18de179065d487a76420f93b19bf7f61c7275c210`
- **oappId:** `0x0da3d845f4ab18a0a8d2f0669722a1d9161c2ea61ad714abc14d414721fd14e4`
- **capabilitiesOwnedBy:** `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`

Actual gas: **0.0697236 SUI**, within the approved 0.1 SUI budget.
All created object IDs, types and owners are in [verification.json](verification.json).
The vault AdminCap, OApp AdminCap and compatible-policy UpgradeCap remain in the
dev wallet. Custody logic remains upgradeable by that wallet.

## Independent verification

Fetched the transaction and current objects directly from mainnet GraphQL,
independently of the user-supplied receipt. `transaction.json` records the executed
transaction, `package.json` the deployed modules, `objects.json` the registry,
OApp and capabilities, and `candidate.json` the original NFT identity/ownership.
The verifier checks the exact approved transaction shape, dependencies, sender,
budget, effects and created capabilities. Both published modules match the
hash-pinned build byte for byte after replacing their zero self-address with the
published package address (codec offset 220, vault offset 2567).

At checkpoint **348094265** (`2026-11-22T19:32:20.797Z`), Registry.slot is null,
OApp peers and enforced options are empty, and no send is pending. No custody
slot or deposit was created by publication. At NFT checkpoint **348094135**
(`2026-11-22T19:31:49.042Z`), original NFTree #2720 retains its exact expected
type, object ID and dev-wallet owner. These are checkpointed observations;
refresh identity and ownership again before any later deposit.

Reproduce offline after installing the repository's pinned dependencies:

```sh
npm ci
node contracts/nftree-generation/scripts/verify-published.mjs
node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-publication/core.test.mjs
```

Validation: **78 tests passed**, including nine receipt tests rejecting a
substituted digest, altered/additional modules, moved capability, allocated slot,
configured peer, incorrect upgrade package and changed original owner. Existing
Move/EVM lifecycle tests were not rerun for this evidence-only update; contract
source and production assets are unchanged.

## Remaining work

Prepare and simulate creation of the single empty custody slot against these
verified IDs, then present the exact transaction for separate approval and wallet
signature. Do not execute it under the already-completed publication approval.
BNB deployment/configuration, peer binding, NFT deposit, sales and gameplay
activation remain subsequent reviewed milestones. No BNB deployment or gameplay
activation was performed in this receipt-recording task. Preserve current
production using the newest production/README.md baseline for any later release.
