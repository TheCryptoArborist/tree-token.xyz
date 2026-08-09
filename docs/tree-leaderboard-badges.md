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

## Release gate

Production approval requires a complete exposure snapshot, complete 30-day activity snapshot, complete lifetime burn snapshot, evidence-backed validation of all six badge rules, and a successful combined Deploy Preview review.
