# NFTree Rewards

Standalone Sui package for sending SUI rewards to NFTree holders. It is separate
from The Woods and does not depend on SAP, staking, or referral state.

## Mainnet Deployment

- Package:
  `0x2e0029466734d5baca6ee6dae6e9ae08b0c44c4ec3d0d0f93b0ccccf2ada290e`
- RewardPool:
  `0x35861dba2b386e4bd34272fd0150df76fadb56eb24fef8c84d5d98838d756fd2`
- AdminCap:
  `0xc68d11f4568ea0f316252e451c85ffb2e2f7ba26a43b68cbfce3c432c56f5942`
- UpgradeCap:
  `0x431447d1e8cf8a9d25ca68cce0571870315b1156e35cdc5bd0b1cc303169fec7`

## Web App

The Netlify site is a wallet-signed control surface for the live pool:

- fund the pool directly with SUI from a connected wallet,
- open a reward round from the admin wallet,
- claim the current round with an NFTree object.

```powershell
npm install
npm run build
npm run dev
```

## How It Works

1. Publish this package.
2. Keep the `AdminCap` in the reward manager wallet.
3. Call `create_default_pool` to create a shared pool for the current NFTree
   collection type:

```text
0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT
```

4. Fund the pool with SUI through `fund_pool`.
5. Start a reward round with `open_round`, setting the SUI amount each NFTree
   object can claim.
6. NFTree holders claim through `claim<NFTree>` by passing their NFTree object.

Each NFTree object can claim once per round. A wallet with two NFTrees can claim
twice, once with each object. The contract stores claim receipts by
`round + nftree_id`, so a new round lets the same NFTree claim again.

## Why Claim-Based

Sui transactions should not loop over every holder. This design avoids needing
an on-chain holder list and avoids failed giant payout batches. Holders prove
eligibility by using their NFTree object in the claim transaction.

## Entry Functions

- `create_default_pool(AdminCap)`: create the shared reward pool for the known
  NFTree collection.
- `create_pool(AdminCap, required_nftree_type)`: create a pool for a custom NFT
  type if the collection changes later.
- `fund_pool(RewardPool, Coin<SUI>)`: add SUI to the claim vault.
- `open_round(AdminCap, RewardPool, per_nftree_mist)`: start the next reward
  round and set the per-NFTree payout.
- `claim<NFTree>(RewardPool, NFTree)`: holder claims the active round reward.
- `withdraw_unallocated(AdminCap, RewardPool, amount, recipient)`: admin
  withdraws unused SUI from the vault.

## Local Verification

```powershell
$env:MOVE_HOME="$env:USERPROFILE\.move-thickquidity"
sui move build
sui move test
```

## Public Framing

```text
NFTree holder rewards are claim-based. We fund a public SUI pool, open a reward
round, and each NFTree can claim once for that round. Rewards are not tied to
The Woods or SAP.
```

