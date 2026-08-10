# Verified TREE behavioral badge architecture

This phase completes the six requested Top 50 badges without allowing historical transaction indexing to block the verified Liquid TREE plus LP exposure leaderboard.

## Public badges

- LP Provider
- LP Maxi
- Diamond Hands
- Paper Hands
- Accumulator
- Burned

## Required separation

The exposure ranking, rolling 30-day trading activity, and lifetime burn attribution are separate complete-only snapshots.

A failed or incomplete badge refresh must not erase, delay, or corrupt the latest complete exposure snapshot. The public Command Center may merge badge data only when the badge snapshot is complete and references the current ranked wallet set.

## Rules

- Diamond Hands: zero classified TREE sells in the complete rolling 30-day window.
- Paper Hands: classified TREE sold exceeds TREE bought in the rolling 30-day window, subject to the configured minimum-volume safeguard.
- Accumulator: at least 10 qualifying buys, at least 100,000 TREE bought, and net accumulation in the rolling 30-day window.
- Burned: cumulative verified TREE sent to the Sui zero address is at least 500,000 TREE.

Transfers, LP joins and exits, staking, rewards, merges, splits, and burns are not classified as buys or sells.

## Sui-native rolling activity index

The activity index reads successful Sui transactions that affect a recognized TREE pool. A transaction is classified only when:

1. A currently ranked wallet is the transaction sender.
2. The transaction contains a recognized SuiDex V2, SuiDex V3, or Turbos TREE swap MoveCall.
3. The sender has an exact, nonzero TREE balance change.
4. The transaction does not contain a disqualifying TREE liquidity, position, farm, staking, fee-collection, reward, or burn operation.

A positive sender TREE balance change is a buy. A negative sender TREE balance change is a sell. Routed transactions that touch more than one recognized pool are deduplicated by wallet and transaction digest.

The rolling 30-day boundary is resolved from Sui checkpoint timestamps. Each pool stores its checkpoint range and GraphQL page cursor after every page, so an interrupted or rate-limited refresh resumes instead of restarting the complete window.

## Page-resumable lifetime burn index

TREE package creation was verified at Sui checkpoint `169361209`. Lifetime burn attribution begins at that checkpoint rather than blockchain genesis.

For every currently ranked wallet, the burn index stores:

- The bounded checkpoint range being scanned.
- The next GraphQL page cursor.
- The exact cumulative TREE credited to the Sui zero address within that range.
- The last fully completed checkpoint.

Progress is persisted after every page. A wallet receives the Burned badge only after its full history reaches the current checkpoint and cumulative verified TREE sent to the zero address is at least 500,000 TREE.

## Complete-only publication

The exposure snapshot, activity index, and burn index are stored independently. An incomplete activity or burn refresh preserves both the exposure leaderboard and the prior complete badge snapshot. A new six-badge snapshot is published only after all 50 displayed wallets have complete activity and burn evidence that matches the current exposure-ranked wallet set.

## Release gate

Production approval requires a complete exposure snapshot, complete 30-day activity snapshot, complete lifetime burn snapshot, evidence-backed validation of all six badge rules, and a successful combined Deploy Preview review.
