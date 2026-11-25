# BNB generation pass and adapter (unpublished)

New immutable adapter/pass pair for the one-ID Sui generation registry. No public
sale or Arcade integration. Deployment starts paused; only the designated initial
buyer may purchase in a subsequent reviewed trial. Existing trial contracts are
not modified or reused.

Run `npm ci --ignore-scripts` then `npm test` and `npm run compile` here.
The lock preserves the existing reviewed Solidity/OpenZeppelin/LayerZero versions.
Ganache fixtures run locally on simulated chain 56, never a real BNB account.

[Protocol, Move tests and limitations](../../docs/multichain/generation-milestone/README.md).
