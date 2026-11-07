# NFTree Rewards integration

This application moves the existing TreeDrop reward contracts into the native
`/rewards/` destination on tree-token.xyz. It retains the original TreeDrop package
and lockfile, contract addresses, registered tokens, and current claim receipts.
The website's existing wallet and liquidity modules are not replaced.

- `/rewards/`: aggregate holder claims and verified current-round history.
- `/rewards/?manage=1`: authorized project wallet's direct-distribution wizard.
- `/rewards/?advanced=1`: existing claim-pool operations for funded campaigns.
- `/rewards/?sponsor=1`: optional contributions to existing configured claim pools.

Build with `npm ci --ignore-scripts` and `npm run build` in this directory. Vite
emits `dist/` with `/rewards/` as its base. The preserved-package release script
maps this output to `/rewards/`, reuses every unchanged current production file
and backend package, and verifies the complete deployed inventory before release.
Do not deploy the repository root or rebuild the unrelated production handlers.

Routine distributions are snapshot-based direct payments. The manager groups
equal per-NFTree shares by wallet, excludes the project wallet, blocks incomplete
ownership snapshots, and requires the wallet owner to review and sign each batch.
It persists signed transaction digests before submission and checks receipts before
allowing replacement batches. Records can be exported and imported between devices;
browser-local history is not a shared cloud database. Confirmed payments remain on
Sui. Campaigns requiring start/end or uninterrupted holding use separately reviewed
eligibility; a single ownership snapshot does not establish those conditions.

Original-package SUI and upgraded community claims require separate PTBs because
combining their package versions produces InvalidLinkage. The holder action shows
the actual approval count and partitions these families while batching compatible
community tokens together. Both family paths were simulated unsigned on Mainnet.

No reward contract is published, no old claim round is replaced, and no payout is
performed during website deployment. Claims and payments always require the user's
wallet approval. Gas sponsorship is not enabled in this release.
