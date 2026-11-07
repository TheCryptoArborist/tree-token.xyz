# NFTree Rewards Operations

This package is separate from The Woods. Use it when you want to reward NFTree
holders directly from a funded SUI pool.

## Setup

From this folder:

```powershell
$env:MOVE_HOME="$env:USERPROFILE\.move-thickquidity"
sui move build
sui client publish --gas-budget 200000000
```

This package is already published on mainnet:

```powershell
$PACKAGE_ID="0x2e0029466734d5baca6ee6dae6e9ae08b0c44c4ec3d0d0f93b0ccccf2ada290e"
$ADMIN_CAP_ID="0xc68d11f4568ea0f316252e451c85ffb2e2f7ba26a43b68cbfce3c432c56f5942"
$UPGRADE_CAP_ID="0x431447d1e8cf8a9d25ca68cce0571870315b1156e35cdc5bd0b1cc303169fec7"
```

## Create The Reward Pool

```powershell
sui client call --package $PACKAGE_ID --module rewards --function create_default_pool --args $ADMIN_CAP_ID --gas-budget 50000000
```

Save the shared `RewardPool` object ID from the transaction output as
`POOL_ID`.

## Fund The Pool

Split a SUI coin first if you want to fund an exact amount:

```powershell
sui client split-coin `
  --coin-id <SUI_COIN_ID> `
  --amounts <FUND_AMOUNT_MIST> `
  --gas-budget 20000000
```

Then send that split coin into the reward pool:

```powershell
sui client call --package $PACKAGE_ID --module rewards --function fund_pool --args $POOL_ID $SPLIT_SUI_COIN_ID --gas-budget 50000000
```

## Open A Reward Round

Set the amount each NFTree object can claim. Examples:

- `0.01 SUI` = `10000000` MIST
- `0.05 SUI` = `50000000` MIST
- `0.10 SUI` = `100000000` MIST
- `1.00 SUI` = `1000000000` MIST

```powershell
sui client call --package $PACKAGE_ID --module rewards --function open_round --args $ADMIN_CAP_ID $POOL_ID $PER_NFTREE_REWARD_MIST --gas-budget 50000000
```

Opening a new round lets the same NFTrees claim again for the new round.

## Holder Claim Command

Give holders this claim target with the published package and pool IDs filled in:

```powershell
sui client call --package $PACKAGE_ID --module rewards --function claim --type-args "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT" --args $POOL_ID $NFTREE_OBJECT_ID --gas-budget 50000000
```

## Recover Unused Funds

```powershell
sui client call --package $PACKAGE_ID --module rewards --function withdraw_unallocated --args $ADMIN_CAP_ID $POOL_ID $AMOUNT_MIST $RECIPIENT_ADDRESS --gas-budget 50000000
```

## Community Token Reward Pools

Community token pools use the deployed community rewards package:

```powershell
$COMMUNITY_PACKAGE_ID="0x01027390c1d969d5d61f6c1af3d5bfc7a623c3801b93290e2e998b5ef3703094"
```

Pool creation support exists in the deployed `rewards` module:

```text
create_default_community_token_pool<T>(&AdminCap, &mut TxContext)
create_community_token_pool<T>(&AdminCap, vector<u8> required_nftree_type, &mut TxContext)
create_community_token_eligibility_registry<T>(&AdminCap, &CommunityTokenRewardPool<T>, &mut TxContext)
```

Preferred TreeDrop setup uses the default NFTree type:

```powershell
sui client call --package $COMMUNITY_PACKAGE_ID --module rewards --function create_default_community_token_pool --type-args "$COIN_TYPE" --args $ADMIN_CAP_ID --gas-budget 50000000
```

Save the created shared `CommunityTokenRewardPool<T>` object ID and initial
shared version from the transaction output.

Then create the eligibility registry for that pool:

```powershell
sui client call --package $COMMUNITY_PACKAGE_ID --module rewards --function create_community_token_eligibility_registry --type-args "$COIN_TYPE" --args $ADMIN_CAP_ID $COMMUNITY_POOL_ID --gas-budget 50000000
```

Save the shared `EligibilityRegistry` object ID and initial shared version,
then add the token config to `src/communityRewards.ts`.

## Suggested Public Copy

```text
NFTree holder rewards are live through a claim pool. Each NFTree can claim once
for the current round. Connect the wallet that owns your NFTree, select the
NFTree object, and claim the SUI reward.
```

