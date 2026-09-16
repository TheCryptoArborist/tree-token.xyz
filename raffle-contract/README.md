# TREE raffle prize pool

This Move package is the on-chain trust layer for the TREE Canopy Draw.

It provides:

- one-time draws using Sui's `0x8` randomness object;
- on-chain storage of the winning ticket;
- one-time draws and winner registration guarded by a limited `OperatorCap`;
- prize reservation at registration time;
- wallet-only, replay-safe prize claims;
- permissionless pool deposits and separate `AdminCap` recovery of unreserved
  funds only. `AdminCap` and `UpgradeCap` must never be installed on the keeper.

The package is not a deployed raffle by itself. Before production activation it
must be reviewed, tested on Sui testnet, published to mainnet, funded, and wired
to the keeper and frontend with the published package and object IDs.

The verified Mainnet publication metadata and permanent object IDs are recorded
in `deployments/mainnet.json`. The prize pool is currently unfunded and the
OperatorCap remains in the admin wallet until the isolated keeper signer is
provisioned.
