import { Inputs, Transaction } from "@mysten/sui/transactions";
import { CommunityRewardTokenConfig, COMMUNITY_REWARDS_PACKAGE_ID } from "./communityRewards";
import { CONFIG } from "./config";

function rewardPoolObject(tx: Transaction) {
  return tx.object(
    Inputs.SharedObjectRef({
      objectId: CONFIG.poolId,
      initialSharedVersion: CONFIG.poolInitialSharedVersion,
      mutable: true,
    }),
  );
}

export function buildFundPoolTransaction(amountMist: bigint) {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.moveCall({
    target: `${CONFIG.packageId}::rewards::fund_pool`,
    arguments: [rewardPoolObject(tx), payment],
  });
  return tx;
}

export function buildOpenRoundTransaction(perNftreeMist: bigint) {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  tx.moveCall({
    target: `${CONFIG.packageId}::rewards::open_round`,
    arguments: [
      tx.object(CONFIG.adminCapId),
      rewardPoolObject(tx),
      tx.pure.u64(perNftreeMist),
    ],
  });
  return tx;
}

export function buildClaimTransaction(nftreeObjectId: string) {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  tx.moveCall({
    target: `${CONFIG.packageId}::rewards::claim`,
    typeArguments: [CONFIG.nftreeType],
    arguments: [rewardPoolObject(tx), tx.object(nftreeObjectId)],
  });
  return tx;
}

function communityPoolObject(tx: Transaction, config: CommunityRewardTokenConfig, mutable: boolean) {
  return tx.object(
    Inputs.SharedObjectRef({
      objectId: config.poolObjectId,
      initialSharedVersion: config.poolInitialSharedVersion,
      mutable,
    }),
  );
}

function eligibilityRegistryObject(tx: Transaction, config: CommunityRewardTokenConfig, mutable = false) {
  if (!config.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion) {
    throw new Error(`${config.symbol} eligibility registry config is missing.`);
  }

  return tx.object(
    Inputs.SharedObjectRef({
      objectId: config.eligibilityRegistryObjectId,
      initialSharedVersion: config.eligibilityRegistryInitialSharedVersion,
      mutable,
    }),
  );
}

export function buildClaimCommunityTokenSnapshotTransaction(
  config: CommunityRewardTokenConfig,
  nftreeObjectId: string,
) {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  tx.moveCall({
    target: `${COMMUNITY_REWARDS_PACKAGE_ID}::rewards::claim_community_token_snapshot`,
    typeArguments: [config.coinType],
    // The community claim entry expects the NFTree object ID as an address value, not the NFT object reference.
    arguments: [communityPoolObject(tx, config, true), eligibilityRegistryObject(tx, config), tx.pure.address(nftreeObjectId)],
  });
  return tx;
}

export function buildFundCommunityTokenPoolTransaction(
  config: CommunityRewardTokenConfig,
  amountAtomic: bigint,
  coinObjectIds: string[],
) {
  if (!coinObjectIds.length) throw new Error(`No ${config.symbol} coin objects were found in this wallet.`);

  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  const [primaryCoinId, ...mergeCoinIds] = coinObjectIds;
  const primaryCoin = tx.object(primaryCoinId!);
  if (mergeCoinIds.length) {
    tx.mergeCoins(
      primaryCoin,
      mergeCoinIds.map((coinId) => tx.object(coinId)),
    );
  }
  const [payment] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountAtomic)]);
  tx.moveCall({
    target: `${COMMUNITY_REWARDS_PACKAGE_ID}::rewards::fund_community_token_pool`,
    typeArguments: [config.coinType],
    arguments: [communityPoolObject(tx, config, true), payment],
  });
  return tx;
}

export function buildOpenCommunityTokenRoundTransaction(config: CommunityRewardTokenConfig, amountAtomic: bigint) {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  tx.moveCall({
    target: `${COMMUNITY_REWARDS_PACKAGE_ID}::rewards::open_community_token_round`,
    typeArguments: [config.coinType],
    arguments: [tx.object(CONFIG.adminCapId), communityPoolObject(tx, config, true), tx.pure.u64(amountAtomic)],
  });
  return tx;
}

export function buildAddCommunityTokenRoundEligibilityTransaction(
  config: CommunityRewardTokenConfig,
  nftreeObjectIds: string[],
  ownerAddresses: string[],
) {
  if (!nftreeObjectIds.length) throw new Error("Holder snapshot batch is empty.");
  if (nftreeObjectIds.length !== ownerAddresses.length) {
    throw new Error("Holder snapshot batch has mismatched NFTree and owner counts.");
  }

  const tx = new Transaction();
  tx.setGasBudget(300_000_000);
  tx.moveCall({
    target: `${COMMUNITY_REWARDS_PACKAGE_ID}::rewards::add_community_token_round_eligibility`,
    typeArguments: [config.coinType],
    arguments: [
      tx.object(CONFIG.adminCapId),
      communityPoolObject(tx, config, false),
      eligibilityRegistryObject(tx, config, true),
      tx.pure.vector("address", nftreeObjectIds),
      tx.pure.vector("address", ownerAddresses),
    ],
  });
  return tx;
}

