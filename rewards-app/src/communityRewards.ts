import { bcs } from "@mysten/sui/bcs";
import { CONFIG } from "./config";
import { claimKeyBytes, fetchRewardField, fetchRewardObject, moveInteger, requiredMoveAddress } from "./rewardClient";
import { REGISTERED_REWARD_TOKENS } from "./rewardTokens";
import type { RegisteredRewardToken } from "./rewardTokens";

export type CommunityRewardTokenConfig = {
  tokenId: string;
  symbol: string;
  coinType: string;
  poolObjectId: string;
  poolInitialSharedVersion: number;
  eligibilityRegistryObjectId?: string;
  eligibilityRegistryInitialSharedVersion?: number;
  claimFunctionName: "claim_community_token_snapshot";
  fundFunctionName: "fund_community_token_pool";
  openRoundFunctionName: "open_community_token_round";
  addEligibilityFunctionName: "add_community_token_round_eligibility";
};

export type CommunityTokenPoolState = {
  tokenId: string;
  symbol: string;
  token?: RegisteredRewardToken;
  poolObjectId: string;
  poolInitialSharedVersion: number;
  eligibilityRegistryObjectId?: string;
  eligibilityRegistryInitialSharedVersion?: number;
  objectType?: string;
  currentRound: bigint;
  perNftreeAmount: bigint;
  vaultBalance: bigint;
  totalFunded: bigint;
  totalClaimed: bigint;
  totalClaims: bigint;
  claimedTableId?: string;
  source: "mainnet" | "unavailable";
  error?: string;
};

export const COMMUNITY_REWARDS_PACKAGE_ID =
  "0x01027390c1d969d5d61f6c1af3d5bfc7a623c3801b93290e2e998b5ef3703094";

const COMMUNITY_FUNCTIONS = {
  claimFunctionName: "claim_community_token_snapshot",
  fundFunctionName: "fund_community_token_pool",
  openRoundFunctionName: "open_community_token_round",
  addEligibilityFunctionName: "add_community_token_round_eligibility",
} as const;

export const COMMUNITY_REWARD_TOKEN_CONFIGS: CommunityRewardTokenConfig[] = [
  {
    tokenId: "tree",
    symbol: "TREE",
    coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
    poolObjectId: "0xaa1847d04fc90781224187fd4e64c759c88a3987df8f997f743f3a68f5b7f525",
    poolInitialSharedVersion: 921100177,
    eligibilityRegistryObjectId: "0x68b7cf6ad8e36bd6a85ebac36e9526935e13b2ce764d56092851b300665c0238",
    eligibilityRegistryInitialSharedVersion: 921100181,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "suitrump",
    symbol: "SUITRUMP",
    coinType: "0xdeb831e796f16f8257681c0d5d4108fa94333060300b2459133a96631bf470b8::suitrump::SUITRUMP",
    poolObjectId: "0xbf296c271307f30180416267c3072aa395adf78c89b6112e293e4d3e12f628ba",
    poolInitialSharedVersion: 921100178,
    eligibilityRegistryObjectId: "0x33349a2fdca81a4757a91fce3267aeafc4135a71b6008dbf4dee9c6f1e9720cc",
    eligibilityRegistryInitialSharedVersion: 921100182,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "victory",
    symbol: "VICTORY",
    coinType: "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN",
    poolObjectId: "0x2fdd85f8b77da7dfd94cc0a2f59795b4c15f499f8c955dda570db293ae0cda2d",
    poolInitialSharedVersion: 921100179,
    eligibilityRegistryObjectId: "0xd859f6ffae8ad3a18afbe44977b610aaa5ccbdd42f110484988efa37e05561e1",
    eligibilityRegistryInitialSharedVersion: 921100183,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "usdc",
    symbol: "USDC",
    coinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    poolObjectId: "0xdcaa78dc5aa8ca0ff6a2c079befb2a714cbf010a34c71aa5d96ff452692b5151",
    poolInitialSharedVersion: 922820089,
    eligibilityRegistryObjectId: "0x92fa7daa27d2e6b390cd702ec2d71dd70070bea971584d2ad9dcccb5e56ad711",
    eligibilityRegistryInitialSharedVersion: 922820090,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "wheels",
    symbol: "WHEELS",
    coinType: "0x6a9c2ded791f1eea4c23ac9bc3dbebf3e5b9f828a9837c9dd62d5e5698aac3ee::wheels::WHEELS",
    poolObjectId: "0xb1c8be0c6bb668c1a3493be7014a167ecc217bf9586dbd45a622298134c353bc",
    poolInitialSharedVersion: 922820107,
    eligibilityRegistryObjectId: "0x1f9ad6d4129b19f4e85ce8ac4a0b5aaf3418d9f4ae6cc63c00bce1f4aafeadae",
    eligibilityRegistryInitialSharedVersion: 922820108,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "wbtc",
    symbol: "WBTC",
    coinType: "0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC",
    poolObjectId: "0x8112e59a86c7246f2e2a22dcf03b9b82d591beba45b3738475a93685e6bfb3c5",
    poolInitialSharedVersion: 922820115,
    eligibilityRegistryObjectId: "0x7fb9b7b54f392fa42785c41bfbae43a0f49cb27258088a42f33fe026d527e303",
    eligibilityRegistryInitialSharedVersion: 922820116,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "xaum",
    symbol: "XAUM",
    coinType: "0x9d297676e7a4b771ab023291377b2adfaa4938fb9080b8d12430e4b108b836a9::xaum::XAUM",
    poolObjectId: "0x3a6d2a8d4c7c2522600e827ad9f04b22e357255f548dc5e2e78c9ca546f3d5d5",
    poolInitialSharedVersion: 922820091,
    eligibilityRegistryObjectId: "0xb1eba8d3121bec198970279498c4aab08fb575c39bfb64ca5a57cf6042d00a66",
    eligibilityRegistryInitialSharedVersion: 922820092,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "swarm",
    symbol: "TRUTH",
    coinType: "0x0a48f85a3905cfa49a652bdb074d9e9fabad27892d54afaa5c9e0adeb7ac3cdf::swarm_network_token::SWARM_NETWORK_TOKEN",
    poolObjectId: "0x71d7872a49afc7e1a1ec19d17b2a29579ca7a044c5ccb2bd4e174fd076be1f44",
    poolInitialSharedVersion: 922820093,
    eligibilityRegistryObjectId: "0x050bb03661687eace3fa09838128dbcecd4bfbdbb9782474d2d9581f9684d421",
    eligibilityRegistryInitialSharedVersion: 922820094,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "wal",
    symbol: "WAL",
    coinType: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
    poolObjectId: "0xc53d24143b44bb21af33057706ba03589a13d1392e00f760c567dcfd9f0b8041",
    poolInitialSharedVersion: 922820095,
    eligibilityRegistryObjectId: "0xc3d101f93189cf2ff4c445ffbf14d2d8e23d15508d0ca81c4ba68ff3c91aa443",
    eligibilityRegistryInitialSharedVersion: 922820096,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "ns",
    symbol: "NS",
    coinType: "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS",
    poolObjectId: "0xae9f2181a3ccc84162f012a67bed06b4dca023f2d1161706a33847a979e7fb0a",
    poolInitialSharedVersion: 922820097,
    eligibilityRegistryObjectId: "0x694a161ddc2d6cf06472831d827c26ec59582a7c7cc97c5a6117e6629b31a957",
    eligibilityRegistryInitialSharedVersion: 922820098,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "tato",
    symbol: "TATO",
    coinType: "0x04deb377c33bfced1ab81cde96918e2538fe78735777150b0064ccf7df5e1c81::tato::TATO",
    poolObjectId: "0x73dd41fbf44ecb9c3a5bf56f4dda3dced6489004133098a928e36e431b653955",
    poolInitialSharedVersion: 922820099,
    eligibilityRegistryObjectId: "0x2863bc98e151cf89fc24fe99aeba650dc5ebb5983a81220d8ef487835b650337",
    eligibilityRegistryInitialSharedVersion: 922820100,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "mews",
    symbol: "MEWS",
    coinType: "0x2dcf8629a70b235cda598170fc9b271f03f33d34dd6fa148adaff481e7a792d2::mews::MEWS",
    poolObjectId: "0x6f44526334426fddec4ad41a8470078f6a63a7dbb862f40828b7a64e1bd6f79e",
    poolInitialSharedVersion: 922820101,
    eligibilityRegistryObjectId: "0x5cb4bb1c6b7bb8255326a18eeeb1afe5515359212918aef6a590537bbe26cac3",
    eligibilityRegistryInitialSharedVersion: 922820102,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "axol",
    symbol: "AXOL",
    coinType: "0xf00eb7ab086967a33c04a853ad960e5c6b0955ef5a47d50b376d83856dc1215e::axol::AXOL",
    poolObjectId: "0xa30ca2a5aa859d4399370853d2af58aeabd81fc17ab54cb99a29e4594aab29e0",
    poolInitialSharedVersion: 922820103,
    eligibilityRegistryObjectId: "0x36c7b3997acc9ffeb1f54ae7621f7da453dec8577bfcaf8193933f08e4a89620",
    eligibilityRegistryInitialSharedVersion: 922820104,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "usdsui",
    symbol: "USDSUI",
    coinType: "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI",
    poolObjectId: "0x4005ccaa26b1f1358dfd16cfc69f24fa37101416a9e02fdfe82a5413f09f23a5",
    poolInitialSharedVersion: 922820105,
    eligibilityRegistryObjectId: "0xc1804f0003e43f8fbe9ff22415db7bb6c152c9cf0f16fcc4ef7c86ec084fbe38",
    eligibilityRegistryInitialSharedVersion: 922820106,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "mbp",
    symbol: "MBP",
    coinType: "0x4d68a38f0c7abcea02106da3bab76f5e6b0b242c100746eb1ef9692cd1129d25::mbp::MBP",
    poolObjectId: "0xc357a62becb0df11812774dd5b443578b2adeb987bbf9a0a1a3ddce43d1a1fb6",
    poolInitialSharedVersion: 922820109,
    eligibilityRegistryObjectId: "0x03c4778d44e76b0abadebe8179abd6d8c4f3ae40f723f2d8358cadd9cbb10874",
    eligibilityRegistryInitialSharedVersion: 922820110,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "pans",
    symbol: "PANS",
    coinType: "0xc9523f683256502be15ec4979098d510f67b6d3f0df02eebf124515014433270::pans::PANS",
    poolObjectId: "0x999366589bc2fc5293d6b5dd22ed8a4fca92fb8f4f107ea3f3072d1e1f146c1b",
    poolInitialSharedVersion: 922820111,
    eligibilityRegistryObjectId: "0xea0b746663792ba1ea898616ff088c4a760e4c385467fc1ea5cb9957b9401eec",
    eligibilityRegistryInitialSharedVersion: 922820112,
    ...COMMUNITY_FUNCTIONS,
  },
  {
    tokenId: "deep",
    symbol: "DEEP",
    coinType: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    poolObjectId: "0x853c4f3725d5d8322c9b32441fc4f280813bc3cd6947ba16c45f428319582621",
    poolInitialSharedVersion: 922820113,
    eligibilityRegistryObjectId: "0x43941c3138a3807779d12fb08b6148516da83bc9f99a0b89f2b76c60e8cb609d",
    eligibilityRegistryInitialSharedVersion: 922820114,
    ...COMMUNITY_FUNCTIONS,
  },
];

type EligibilityRegistryState = {
  registryObjectId: string;
  poolId?: string;
  eligibleOwnersTableId?: string;
  snapshotCountsTableId?: string;
  eligibleOwnersSize: bigint;
  snapshotCountsSize: bigint;
};

export type CommunityEligibilityResult = {
  eligibleNFTreeIds: Set<string>;
  ownerByNFTreeId: Record<string, string>;
  ownerMismatchByNFTreeId: Record<string, string>;
};

export type CommunityEligibilityPublishPair = {
  nftreeObjectId: string;
  ownerAddress: string;
};

export type CommunityEligibilityPreflightResult = {
  status:
    | "not-published"
    | "already-published"
    | "partially-published"
    | "owner-mismatch"
    | "unavailable"
    | "snapshot-finalized"
    | "snapshot-mismatch";
  snapshotFinalizedCount?: number;
  publishedPairs: CommunityEligibilityPublishPair[];
  missingPairs: CommunityEligibilityPublishPair[];
  ownerMismatchPairs: Array<CommunityEligibilityPublishPair & { existingOwnerAddress: string }>;
  unavailablePairs: CommunityEligibilityPublishPair[];
};

const COMMUNITY_ELIGIBILITY_CLAIM_KEY_TYPE = `${CONFIG.packageId}::rewards::ClaimKey`;

async function fetchEligibilityRegistryState(config: CommunityRewardTokenConfig, signal?: AbortSignal): Promise<EligibilityRegistryState> {
  if (!config.eligibilityRegistryObjectId) throw new Error(`${config.symbol} eligibility registry is not configured.`);
  const { fields } = await fetchRewardObject(config.eligibilityRegistryObjectId, signal);
  return {
    registryObjectId: config.eligibilityRegistryObjectId,
    poolId: requiredMoveAddress(fields.pool_id, `${config.symbol} registry pool ID`),
    eligibleOwnersTableId: requiredMoveAddress(fields.eligible_owners, `${config.symbol} eligible owners table`),
    snapshotCountsTableId: requiredMoveAddress(fields.snapshot_counts, `${config.symbol} snapshot counts table`),
    eligibleOwnersSize: moveInteger(fields.eligible_owners, `${config.symbol} eligible owner count`),
    snapshotCountsSize: moveInteger(fields.snapshot_counts, `${config.symbol} snapshot count`),
  };
}

async function fetchSnapshotFinalizedCount(
  config: CommunityRewardTokenConfig,
  snapshotCountsTableId: string,
  currentRound: bigint,
  signal?: AbortSignal,
) {
  const field = await fetchRewardField(snapshotCountsTableId, "u64", bcs.u64().serialize(currentRound).toBytes(), signal);
  if (!field) return undefined;
  if (field.value.type !== "u64") throw new Error(`${config.symbol} snapshot count has an unexpected value type.`);
  const count = BigInt(bcs.u64().parse(field.value.bcs));
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${config.symbol} snapshot count is too large.`);
  return Number(count);
}

async function fetchEligibilityOwnerForNFTree(
  config: CommunityRewardTokenConfig,
  eligibleOwnersTableId: string,
  currentRound: bigint,
  nftreeObjectId: string,
  signal?: AbortSignal,
) {
  const field = await fetchRewardField(
    eligibleOwnersTableId, COMMUNITY_ELIGIBILITY_CLAIM_KEY_TYPE, claimKeyBytes(currentRound, nftreeObjectId), signal,
  );
  if (!field) return undefined;
  if (field.value.type !== "address") throw new Error(`${config.symbol} eligibility owner has an unexpected value type.`);
  return requiredMoveAddress(bcs.Address.parse(field.value.bcs), `${config.symbol} eligibility owner`);
}

export function findCommunityRewardConfig(tokenId: string) {
  return COMMUNITY_REWARD_TOKEN_CONFIGS.find((config) => config.tokenId === tokenId);
}

export function isCommunityRewardConfigured(tokenId: string) {
  return Boolean(findCommunityRewardConfig(tokenId));
}

export function formatTokenAmount(amount: bigint, decimals: number, maxFractionDigits = 4) {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n || maxFractionDigits <= 0) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

export async function fetchCommunityTokenPoolState(
  config: CommunityRewardTokenConfig,
  tokens = REGISTERED_REWARD_TOKENS,
  signal?: AbortSignal,
): Promise<CommunityTokenPoolState> {
  const { object, fields } = await fetchRewardObject(config.poolObjectId, signal);
  const token = tokens.find((item) => item.tokenId === config.tokenId);
  const poolInitialSharedVersion = object.owner.$kind === "Shared"
    ? Number(object.owner.Shared.initialSharedVersion)
    : config.poolInitialSharedVersion;
  if (!Number.isSafeInteger(poolInitialSharedVersion) || poolInitialSharedVersion <= 0) {
    throw new Error(`${config.symbol} shared pool version is unavailable.`);
  }
  return {
    tokenId: config.tokenId,
    symbol: config.symbol,
    token,
    poolObjectId: config.poolObjectId,
    poolInitialSharedVersion,
    eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
    eligibilityRegistryInitialSharedVersion: config.eligibilityRegistryInitialSharedVersion,
    objectType: object.type,
    currentRound: moveInteger(fields.current_round, `${config.symbol} current round`),
    perNftreeAmount: moveInteger(fields.per_nftree_amount, `${config.symbol} reward per NFTree`),
    vaultBalance: moveInteger(fields.vault, `${config.symbol} vault balance`),
    totalFunded: moveInteger(fields.total_funded, `${config.symbol} total funded`),
    totalClaimed: moveInteger(fields.total_claimed, `${config.symbol} total claimed`),
    totalClaims: moveInteger(fields.total_claims, `${config.symbol} claim count`),
    claimedTableId: requiredMoveAddress(fields.claimed, `${config.symbol} claim receipt table`),
    source: "mainnet",
  };
}

export async function fetchAllCommunityTokenPoolStates(
  tokens = REGISTERED_REWARD_TOKENS,
  signal?: AbortSignal,
): Promise<CommunityTokenPoolState[]> {
  const results = await Promise.allSettled(
    COMMUNITY_REWARD_TOKEN_CONFIGS.map((config) => fetchCommunityTokenPoolState(config, tokens, signal)),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const config = COMMUNITY_REWARD_TOKEN_CONFIGS[index]!;
    return {
      tokenId: config.tokenId,
      symbol: config.symbol,
      token: tokens.find((item) => item.tokenId === config.tokenId),
      poolObjectId: config.poolObjectId,
      poolInitialSharedVersion: config.poolInitialSharedVersion,
      eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
      eligibilityRegistryInitialSharedVersion: config.eligibilityRegistryInitialSharedVersion,
      currentRound: 0n,
      perNftreeAmount: 0n,
      vaultBalance: 0n,
      totalFunded: 0n,
      totalClaimed: 0n,
      totalClaims: 0n,
      source: "unavailable",
      error: result.reason instanceof Error ? result.reason.message : "Community pool read failed.",
    };
  });
}

export function getActiveCommunityDropAssets(states: CommunityTokenPoolState[]) {
  return states.filter((state) => state.source === "mainnet" && state.currentRound > 0n && state.perNftreeAmount > 0n && state.vaultBalance >= state.perNftreeAmount);
}

export async function fetchCommunityEligibilityForNFTrees(
  config: CommunityRewardTokenConfig,
  currentRound: bigint,
  nftreeObjectIds: string[],
  connectedWallet: string,
  signal?: AbortSignal,
): Promise<CommunityEligibilityResult> {
  const eligibleNFTreeIds = new Set<string>();
  const ownerByNFTreeId: Record<string, string> = {};
  const ownerMismatchByNFTreeId: Record<string, string> = {};
  if (currentRound <= 0n || !nftreeObjectIds.length) {
    return { eligibleNFTreeIds, ownerByNFTreeId, ownerMismatchByNFTreeId };
  }
  if (!config.eligibilityRegistryObjectId) throw new Error(`${config.symbol} eligibility registry is unavailable.`);

  const connectedWalletKey = connectedWallet.toLowerCase();
  const registryState = await fetchEligibilityRegistryState(config, signal);
  if (!registryState.eligibleOwnersTableId) throw new Error(`${config.symbol} eligible owners table unavailable.`);
  const eligibleOwnersTableId = registryState.eligibleOwnersTableId;
  console.info("[TreeDrop eligibility status] checking", {
    tokenId: config.tokenId,
    symbol: config.symbol,
    eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
    eligibleOwnersTableId,
    round: currentRound.toString(),
    claimKeyType: COMMUNITY_ELIGIBILITY_CLAIM_KEY_TYPE,
    nftreeObjectIds,
    connectedWallet: connectedWalletKey,
  });

  await Promise.all(
    nftreeObjectIds.map(async (objectId) => {
      try {
        const ownerAddress = await fetchEligibilityOwnerForNFTree(config, eligibleOwnersTableId, currentRound, objectId, signal);
        if (!ownerAddress) {
          console.info("[TreeDrop eligibility status] not eligible", {
            tokenId: config.tokenId,
            symbol: config.symbol,
            nftreeObjectId: objectId,
          });
          return;
        }
        ownerByNFTreeId[objectId.toLowerCase()] = ownerAddress;
        if (ownerAddress === connectedWalletKey) {
          eligibleNFTreeIds.add(objectId.toLowerCase());
          console.info("[TreeDrop eligibility status] eligible", {
            tokenId: config.tokenId,
            symbol: config.symbol,
            nftreeObjectId: objectId,
            ownerAddress,
          });
          return;
        }
        ownerMismatchByNFTreeId[objectId.toLowerCase()] = ownerAddress;
        console.info("[TreeDrop eligibility status] owner mismatch", {
          tokenId: config.tokenId,
          symbol: config.symbol,
          nftreeObjectId: objectId,
          eligibilityOwner: ownerAddress,
          connectedWallet: connectedWalletKey,
        });
      } catch (error) {
        console.error("[TreeDrop eligibility status] unavailable", {
          tokenId: config.tokenId,
          symbol: config.symbol,
          eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
          round: currentRound.toString(),
          nftreeObjectId: objectId,
          error,
        });
        throw error;
      }
    }),
  );

  return { eligibleNFTreeIds, ownerByNFTreeId, ownerMismatchByNFTreeId };
}

export async function fetchCommunityEligibilityPreflight(
  config: CommunityRewardTokenConfig,
  currentRound: bigint,
  pairs: CommunityEligibilityPublishPair[],
  signal?: AbortSignal,
): Promise<CommunityEligibilityPreflightResult> {
  const publishedPairs: CommunityEligibilityPublishPair[] = [];
  const missingPairs: CommunityEligibilityPublishPair[] = [];
  const ownerMismatchPairs: Array<CommunityEligibilityPublishPair & { existingOwnerAddress: string }> = [];
  const unavailablePairs: CommunityEligibilityPublishPair[] = [];

  if (!config.eligibilityRegistryObjectId || currentRound <= 0n || !pairs.length) {
    return {
      status: "unavailable",
      publishedPairs,
      missingPairs,
      ownerMismatchPairs,
      unavailablePairs: pairs,
    };
  }

  let normalizedPairs: CommunityEligibilityPublishPair[];
  let registryState: EligibilityRegistryState;
  let snapshotFinalizedCount: number | undefined;
  try {
    normalizedPairs = pairs.map((pair) => ({
      nftreeObjectId: requiredMoveAddress(pair.nftreeObjectId, "Snapshot NFTree ID"),
      ownerAddress: requiredMoveAddress(pair.ownerAddress, "Snapshot owner address"),
    }));
    registryState = await fetchEligibilityRegistryState(config, signal);
    if (!registryState.eligibleOwnersTableId || !registryState.snapshotCountsTableId) {
      throw new Error(`${config.symbol} snapshot registry tables are unavailable.`);
    }
    snapshotFinalizedCount = await fetchSnapshotFinalizedCount(
      config,
      registryState.snapshotCountsTableId,
      currentRound,
      signal,
    );
  } catch {
    return {
      status: "unavailable",
      publishedPairs,
      missingPairs,
      ownerMismatchPairs,
      unavailablePairs: pairs,
    };
  }

  const eligibleOwnersTableId = registryState.eligibleOwnersTableId;
  const snapshotCountsTableId = registryState.snapshotCountsTableId;
  const hasDuplicateNFTreeIds = new Set(normalizedPairs.map((pair) => pair.nftreeObjectId)).size !== normalizedPairs.length;

  console.info("[TreeDrop eligibility preflight] checking", {
    tokenId: config.tokenId,
    symbol: config.symbol,
    eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
    eligibleOwnersTableId,
    snapshotCountsTableId,
    snapshotFinalizedCount,
    round: currentRound.toString(),
    claimKeyType: COMMUNITY_ELIGIBILITY_CLAIM_KEY_TYPE,
    pairCount: pairs.length,
  });

  // A finalized count is not evidence of which NFTree belongs to which wallet.
  // Verify every pair even when the on-chain round has already been finalized.
  await Promise.all(
    normalizedPairs.map(async (normalizedPair) => {
      try {
        const existingOwnerAddress = await fetchEligibilityOwnerForNFTree(
          config,
          eligibleOwnersTableId,
          currentRound,
          normalizedPair.nftreeObjectId,
          signal,
        );
        if (!existingOwnerAddress) {
          missingPairs.push(normalizedPair);
          return;
        }
        if (existingOwnerAddress === normalizedPair.ownerAddress) {
          publishedPairs.push(normalizedPair);
          return;
        }
        ownerMismatchPairs.push({ ...normalizedPair, existingOwnerAddress });
      } catch (error) {
        console.error("[TreeDrop eligibility preflight] unavailable", {
          tokenId: config.tokenId,
          symbol: config.symbol,
          eligibilityRegistryObjectId: config.eligibilityRegistryObjectId,
          eligibleOwnersTableId,
          round: currentRound.toString(),
          nftreeObjectId: normalizedPair.nftreeObjectId,
          error,
        });
        unavailablePairs.push(normalizedPair);
      }
    }),
  );

  let status: CommunityEligibilityPreflightResult["status"] = "not-published";
  if (unavailablePairs.length) status = "unavailable";
  else if (ownerMismatchPairs.length) status = "owner-mismatch";
  else if (hasDuplicateNFTreeIds) status = "snapshot-mismatch";
  else if (snapshotFinalizedCount !== undefined) {
    status = snapshotFinalizedCount === normalizedPairs.length && publishedPairs.length === normalizedPairs.length
      ? "snapshot-finalized"
      : "snapshot-mismatch";
  }
  else if (publishedPairs.length === normalizedPairs.length) status = "already-published";
  else if (publishedPairs.length > 0) status = "partially-published";

  return { status, snapshotFinalizedCount, publishedPairs, missingPairs, ownerMismatchPairs, unavailablePairs };
}

