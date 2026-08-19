# TREE raffle prize pool

This Move package is the on-chain trust layer for the TREE Canopy Draw.

It provides:

- one-time draws using Sui's `0x8` randomness object;
- on-chain storage of the winning ticket;
- one-time winner registration guarded by `AdminCap`;
- prize reservation at registration time;
- wallet-only, replay-safe prize claims;
- permissionless pool deposits and admin recovery of unreserved funds only.

The package is not a deployed raffle by itself. Before production activation it
must be reviewed, tested on Sui testnet, published to mainnet, funded, and wired
to the keeper and frontend with the published package and object IDs.
