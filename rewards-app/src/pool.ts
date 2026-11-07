import { bcs } from "@mysten/sui/bcs";
import { CONFIG } from "./config";
import {
  claimKeyBytes,
  fetchRewardField,
  fetchRewardObject,
  moveInteger,
  requiredMoveAddress,
  rewardClient,
} from "./rewardClient";

export type RewardPoolState = {
  currentRound: bigint;
  perNftreeMist: bigint;
  totalFunded: bigint;
  totalClaimed: bigint;
  totalClaims: bigint;
  vaultBalance: bigint;
  claimedTableId?: string;
  source: "mainnet" | "unavailable";
};

export type OwnedNFTree = {
  objectId: string;
  label: string;
  version?: string;
  digest?: string;
};

const SUI_CLAIM_KEY_TYPE = `${CONFIG.packageId}::rewards::ClaimKey`;
// Community pools retain the original package's ClaimKey type.
export const COMMUNITY_CLAIM_KEY_TYPE = SUI_CLAIM_KEY_TYPE;

export async function fetchRewardPoolState(signal?: AbortSignal): Promise<RewardPoolState> {
  const { fields } = await fetchRewardObject(CONFIG.poolId, signal);
  return {
    currentRound: moveInteger(fields.current_round, "SUI current round"),
    perNftreeMist: moveInteger(fields.per_nftree_mist, "SUI reward per NFTree"),
    totalFunded: moveInteger(fields.total_funded, "SUI total funded"),
    totalClaimed: moveInteger(fields.total_claimed, "SUI total claimed"),
    totalClaims: moveInteger(fields.total_claims, "SUI claim count"),
    vaultBalance: moveInteger(fields.vault, "SUI vault balance"),
    claimedTableId: requiredMoveAddress(fields.claimed, "SUI claim receipt table"),
    source: "mainnet",
  };
}

async function fetchClaimedNFTreesByKeyType(
  claimedTableId: string | undefined,
  round: bigint,
  nftreeObjectIds: string[],
  claimKeyType: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const claimed = new Set<string>();
  if (round <= 0n || !nftreeObjectIds.length) return claimed;
  if (!claimedTableId) throw new Error("Claim receipt table is unavailable.");

  await Promise.all(nftreeObjectIds.map(async (objectId) => {
    const field = await fetchRewardField(claimedTableId, claimKeyType, claimKeyBytes(round, objectId), signal);
    if (!field) return;
    // The receipt is a bool. A decode/type error must block claims rather than
    // making an existing receipt appear unclaimed.
    if (field.value.type !== "bool") throw new Error("Claim receipt has an unexpected value type.");
    if (bcs.bool().parse(field.value.bcs)) claimed.add(objectId.toLowerCase());
  }));
  return claimed;
}

export async function fetchClaimedNFTrees(
  claimedTableId: string | undefined,
  round: bigint,
  nftreeObjectIds: string[],
  signal?: AbortSignal,
): Promise<Set<string>> {
  return fetchClaimedNFTreesByKeyType(claimedTableId, round, nftreeObjectIds, SUI_CLAIM_KEY_TYPE, signal);
}

export async function fetchClaimedCommunityNFTrees(
  claimedTableId: string | undefined,
  round: bigint,
  nftreeObjectIds: string[],
  signal?: AbortSignal,
): Promise<Set<string>> {
  return fetchClaimedNFTreesByKeyType(claimedTableId, round, nftreeObjectIds, COMMUNITY_CLAIM_KEY_TYPE, signal);
}

export async function fetchOwnedNFTrees(owner: string, signal?: AbortSignal): Promise<OwnedNFTree[]> {
  const owned: OwnedNFTree[] = [];
  const seenCursors = new Set<string>();
  let page = await rewardClient.listOwnedObjects({
    owner, type: CONFIG.nftreeType, include: { display: true }, limit: 50, signal,
  });
  while (true) {
    signal?.throwIfAborted();
    for (const object of page.objects) {
      const display = object.display?.output;
      const label = typeof display?.name === "string" ? display.name :
        typeof display?.description === "string" ? display.description : object.objectId;
      owned.push({ objectId: object.objectId, label, version: object.version, digest: object.digest });
    }
    if (!page.hasNextPage) break;
    if (!page.cursor || seenCursors.has(page.cursor)) throw new Error("NFTree scan did not return a new page cursor.");
    seenCursors.add(page.cursor);
    page = await rewardClient.listOwnedObjects({
      owner, type: CONFIG.nftreeType, include: { display: true }, limit: 50, cursor: page.cursor, signal,
    });
  }
  return owned;
}

export function unavailablePoolState(): RewardPoolState {
  return {
    currentRound: 0n,
    perNftreeMist: 0n,
    totalFunded: 0n,
    totalClaimed: 0n,
    totalClaims: 0n,
    vaultBalance: 0n,
    claimedTableId: undefined,
    source: "unavailable",
  };
}
