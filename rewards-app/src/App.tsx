import { fetchRewardCoins, fetchRewardBalance } from "./rewardClient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UiWallet,
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentWallet,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from "@mysten/dapp-kit-react";
import { CONFIG } from "./config";
import { CampaignRewardConfig, SAMPLE_CAMPAIGN_REWARDS } from "./campaignRewards";
import {
  applyResolvedOwnersImport,
  fetchHolderSnapshot,
  HolderSnapshot,
  HolderSnapshotSource,
  parseHolderSnapshotImport,
  snapshotToCsv,
  unresolvedOwnersToCsv,
} from "./holderSnapshot";
import {
  COMMUNITY_REWARD_TOKEN_CONFIGS,
  COMMUNITY_REWARDS_PACKAGE_ID,
  CommunityRewardTokenConfig,
  CommunityEligibilityPreflightResult,
  CommunityTokenPoolState,
  fetchAllCommunityTokenPoolStates,
  fetchCommunityEligibilityForNFTrees,
  fetchCommunityEligibilityPreflight,
  findCommunityRewardConfig,
  formatTokenAmount,
  getActiveCommunityDropAssets,
  isCommunityRewardConfigured,
} from "./communityRewards";
import { formatInteger, formatSui, isSuiAddress, parseSuiToMist, parseTokenAmountToAtomic, shortId } from "./format";
import {
  fetchClaimedCommunityNFTrees,
  fetchClaimedNFTrees,
  fetchOwnedNFTrees,
  fetchRewardPoolState,
  OwnedNFTree,
  RewardPoolState,
  unavailablePoolState,
} from "./pool";
import {
  buildAddCommunityTokenRoundEligibilityTransaction,
  buildClaimTransaction,
  buildClaimCommunityTokenSnapshotTransaction,
  buildFundPoolTransaction,
  buildFundCommunityTokenPoolTransaction,
  buildOpenCommunityTokenRoundTransaction,
  buildOpenRoundTransaction,
} from "./transactions";
import {
  FEATURED_REWARD_TOKENS,
  REGISTERED_REWARD_TOKENS,
  RegisteredRewardToken,
} from "./rewardTokens";
import {
  applyMetadataToRegisteredToken,
  hydrateRegisteredTokenMetadata,
  TokenMetadataDraft,
  TokenMetadataResult,
} from "./tokenMetadata";

type TxStatus = {
  label: string;
  detail: string;
  digest?: string;
  tone: "idle" | "pending" | "success" | "error";
};

type EligibilityPublishState = {
  isPublishing: boolean;
  isChecking: boolean;
  progress: string;
  error: string;
  digests: string[];
  lastPublishedCount: number;
  tokenId?: string;
  round?: string;
  eligibleCount: number;
  alreadyPublishedCount: number;
  missingCount: number;
  ownerMismatchCount: number;
  unavailableCount: number;
  snapshotFinalizedCount?: number;
  preflightStatus?: CommunityEligibilityPreflightResult["status"];
  missingPairs: Array<{ nftreeObjectId: string; ownerAddress: string }>;
  ownerMismatchPairs: Array<{ nftreeObjectId: string; ownerAddress: string; existingOwnerAddress: string }>;
};

type FeaturedTokenSettings = {
  tokenId: string;
  displayName: string;
  symbol: string;
  projectName: string;
  decimals: string;
  logoUrl: string;
  projectUrl: string;
  xUrl: string;
  telegramUrl: string;
  chartUrl: string;
  notes: string;
};

type CommunityEligibilityState = {
  eligibleNFTreeIds: Set<string>;
  ownerMismatchByNFTreeId: Record<string, string>;
};

type TelegramAlertType = "reward-live" | "pool-funded" | "campaign-coming-soon";

type TelegramServiceStatus = {
  isChecking: boolean;
  isConfigured: boolean;
  message: string;
};

type TelegramAlertAsset = {
  tokenId: string;
  symbol: string;
  perNftreeLabel: string;
  poolBalanceLabel: string;
  eligibilityLabel: string;
  isOpen: boolean;
  isClaimReady: boolean;
  warning?: string;
};

type TelegramAlertHistoryItem = {
  id: string;
  alertType: TelegramAlertType;
  sentAt: string;
  assets: string[];
  status: "sent" | "failed";
};

type TelegramEligibilityRecord = {
  tokenId: string;
  round: string;
  eligibleCount: number;
  snapshotTime?: string;
  updatedAt: string;
};

type AssetClaimabilityStatus =
  | "checking"
  | "claimable"
  | "already claimed"
  | "not eligible"
  | "eligibility unknown"
  | "claim status unavailable";

function assetStatusLabel(status: AssetClaimabilityStatus) {
  if (status === "claim status unavailable") return "Unavailable";
  if (status === "eligibility unknown") return "Eligibility unknown";
  return status
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const EMPTY_STATUS: TxStatus = {
  label: "Ready",
  detail: "Connect the wallet that holds your NFTree to check for rewards.",
  tone: "idle",
};

function emptyEligibilityPublishState(): EligibilityPublishState {
  return {
    isPublishing: false,
    isChecking: false,
    progress: "",
    error: "",
    digests: [],
    lastPublishedCount: 0,
    eligibleCount: 0,
    alreadyPublishedCount: 0,
    missingCount: 0,
    ownerMismatchCount: 0,
    unavailableCount: 0,
    snapshotFinalizedCount: undefined,
    missingPairs: [],
    ownerMismatchPairs: [],
  };
}

const FEATURED_TOKEN_SETTINGS_KEY = "treedrop.featuredTokenPreview.v1";
const TELEGRAM_ALERT_HISTORY_KEY = "treedrop.telegramAlertHistory.v1";
const TELEGRAM_ELIGIBILITY_RECORD_KEY = "treedrop.telegramEligibilityRecords.v1";
const TELEGRAM_DEFAULT_IMAGE_URL = "https://treedrop.xyz/telegram-alert-default.png";
const REGISTERED_TOKEN_METADATA_CACHE_KEY = "treedrop.registeredTokenMetadata.v1";
const TOKEN_METADATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const SUI_GAS_RESERVE_MIST = 50_000_000n;
// Announcements remain on the original service; the native rewards page does
// not configure or call an unrelated messaging backend.
const TELEGRAM_ALERTS_ENABLED = false;
const REWARD_EXCLUDED_WALLET_ADDRESSES = [CONFIG.adminAddress.toLowerCase()];

function isRewardExcludedWallet(address?: string) {
  return Boolean(address && REWARD_EXCLUDED_WALLET_ADDRESSES.includes(address.toLowerCase()));
}

function shouldExcludeNFTreeOwnerFromRewards(ownerAddress?: string) {
  return isRewardExcludedWallet(ownerAddress);
}

function filterRewardEligibleNFTrees<T>(nftrees: T[], ownerAddress?: string) {
  // Future holder-snapshot generation should call this before opening a distribution.
  return shouldExcludeNFTreeOwnerFromRewards(ownerAddress) ? [] : nftrees;
}

function formatTokenSelectLabel(token: RegisteredRewardToken) {
  const symbol = token.symbol.trim();
  const name = token.name.trim();
  if (!name || name.toLowerCase() === symbol.toLowerCase()) return symbol;
  return `${symbol} - ${name}`;
}

function workflowStepClass(state: string) {
  const normalized = state.toLowerCase();
  if (
    normalized.includes("complete") ||
    normalized.includes("not required") ||
    normalized.includes("claim-ready") ||
    normalized.includes("ready") ||
    normalized.includes("monitor") ||
    normalized.includes("selected")
  ) {
    return "is-done";
  }
  if (normalized.includes("needs action") || normalized.includes("needs funding") || normalized.includes("waiting")) return "is-next";
  if (normalized.includes("warning") || normalized.includes("partial")) return "is-warning";
  if (normalized.includes("blocked") || normalized.includes("disabled")) return "is-blocked";
  return "";
}

type RewardWizardStep = {
  label: string;
  status: string;
  detail: string;
  actionLabel?: string;
  targetId?: string;
  actionKey?: "refresh-snapshot" | "check-eligibility";
  disabledReason?: string;
};

function chunkItems<T>(items: T[], batchSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    chunks.push(items.slice(index, index + batchSize));
  }
  return chunks;
}

function clampEligibilityBatchSize(value: string | number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(25, parsed));
}

function buildEligibilityPublishPairs(snapshot: HolderSnapshot) {
  const seenNFTrees = new Set<string>();
  const pairs: Array<{ nftreeObjectId: string; ownerAddress: string }> = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  let excludedCount = 0;

  for (const nftree of snapshot.nftrees) {
    const nftreeObjectId = nftree.nftreeObjectId.toLowerCase();
    const ownerAddress = nftree.ownerAddress?.toLowerCase();

    if (!isSuiAddress(nftreeObjectId) || !ownerAddress || !isSuiAddress(ownerAddress)) {
      invalidCount += 1;
      continue;
    }

    if (shouldExcludeNFTreeOwnerFromRewards(ownerAddress)) {
      excludedCount += 1;
      continue;
    }

    if (seenNFTrees.has(nftreeObjectId)) {
      duplicateCount += 1;
      continue;
    }

    seenNFTrees.add(nftreeObjectId);
    pairs.push({ nftreeObjectId, ownerAddress });
  }

  return { pairs, duplicateCount, invalidCount, excludedCount };
}

function eligibilityPreflightStatusLabel(status?: CommunityEligibilityPreflightResult["status"]) {
  if (status === "already-published") return "Already published";
  if (status === "partially-published") return "Partially published";
  if (status === "owner-mismatch") return "Owner mismatch";
  if (status === "unavailable") return "Unavailable";
  if (status === "not-published") return "Not published";
  return "Checking";
}

function eligibilityPublishErrorMessage(message: string) {
  const abortCode = moveAbortCode(message);
  if (abortCode === 12) {
    return "Eligibility snapshot may already be finalized for this token and round. Refresh eligibility status. If the snapshot is finalized, open a new distribution round to publish a new holder snapshot.";
  }
  return message;
}

function resultDigest(result: unknown) {
  if (!result || typeof result !== "object") return undefined;
  const data = result as {
    Transaction?: { digest?: string };
    FailedTransaction?: { status?: { error?: string | null } };
    digest?: string;
  };
  if (data.FailedTransaction) throw new Error(data.FailedTransaction.status?.error || "Transaction failed");
  return data.Transaction?.digest ?? data.digest;
}

function moveAbortCode(message: string) {
  const match = message.match(/MoveAbort[\s\S]*,\s*(\d+)\)/);
  return match ? Number(match[1]) : undefined;
}

function statusFromError(error: unknown, actionLabel: string): TxStatus {
  const message = error instanceof Error ? error.message : "Wallet rejected or transaction failed.";
  const abortCode = moveAbortCode(message);
  const wrongSigner =
    message.includes("not signed by the correct sender") ||
    message.includes("given owner/signer address");

  if (actionLabel === "Open round" && wrongSigner) {
    return {
      label: "Wrong wallet for project action",
      detail: "Connect the authorized project wallet to open a distribution. This wallet can still contribute to the pool.",
      tone: "error",
    };
  }

  if (abortCode === 1) {
    return {
      label: "Project wallet required",
      detail: "This project action must be signed by the authorized project wallet.",
      tone: "error",
    };
  }
  if (abortCode === 4) {
    return {
      label: "Wrong NFTree object",
      detail: "That object is not the required NFTree collection type.",
      tone: "error",
    };
  }
  if (abortCode === 5) {
    return {
      label: "No active round",
      detail: "Open a reward round before holders claim.",
      tone: "error",
    };
  }
  if (abortCode === 6) {
    return {
      label: "Rewards already claimed for this distribution",
      detail:
        "This NFTree has already claimed every active reward asset in the current distribution. Check back when the next distribution opens.",
      tone: "error",
    };
  }
  if (abortCode === 7) {
    return {
      label: "Pool balance too low",
      detail: "Fund the pool before opening or claiming this reward amount.",
      tone: "error",
    };
  }

  return {
    label: `${actionLabel} not submitted`,
    detail: message,
    tone: "error",
  };
}

function formatSnapshotTime(value?: string) {
  if (!value) return "No snapshot yet";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalDateTimeInputValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function localDateTimeToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function snapshotSourceLabel(source: HolderSnapshotSource) {
  if (source === "auto-rpc") return "Auto RPC";
  if (source === "manual-import") return "Manual Import";
  if (source === "indexer-graphql") return "Indexer / GraphQL";
  return "Unavailable";
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function featuredSettingsFromToken(token: RegisteredRewardToken): FeaturedTokenSettings {
  return {
    tokenId: token.tokenId,
    displayName: token.name,
    symbol: token.symbol,
    projectName: token.projectName,
    decimals: token.decimals.toString(),
    logoUrl: token.logoUrl,
    projectUrl: token.projectUrl || "",
    xUrl: token.xUrl || "",
    telegramUrl: token.telegramUrl || "",
    chartUrl: token.chartUrl || "",
    notes: token.notes,
  };
}

function loadFeaturedTokenSettings(defaultToken: RegisteredRewardToken): FeaturedTokenSettings {
  if (typeof window === "undefined") return featuredSettingsFromToken(defaultToken);

  try {
    const saved = window.localStorage.getItem(FEATURED_TOKEN_SETTINGS_KEY);
    if (!saved) return featuredSettingsFromToken(defaultToken);

    const parsed = JSON.parse(saved) as Partial<FeaturedTokenSettings>;
    const selectedToken =
      REGISTERED_REWARD_TOKENS.find((token) => token.tokenId === parsed.tokenId && token.tokenId !== "tree" && token.tokenId !== "sui") ||
      defaultToken;

    return { ...featuredSettingsFromToken(selectedToken), ...parsed, tokenId: selectedToken.tokenId };
  } catch {
    return featuredSettingsFromToken(defaultToken);
  }
}

function applyFeaturedSettings(token: RegisteredRewardToken, settings: FeaturedTokenSettings): RegisteredRewardToken {
  return {
    ...token,
    name: settings.displayName || token.name,
    symbol: settings.symbol || token.symbol,
    projectName: settings.projectName || token.projectName,
    decimals: Number.parseInt(settings.decimals, 10) || token.decimals,
    logoUrl: settings.logoUrl,
    projectUrl: settings.projectUrl || undefined,
    xUrl: settings.xUrl || undefined,
    telegramUrl: settings.telegramUrl || undefined,
    chartUrl: settings.chartUrl || undefined,
    notes: settings.notes || token.notes,
    isClaimable: token.isClaimable,
    isDepositable: token.isDepositable,
    isFeatured: true,
    status: token.status,
  };
}

function sortCommunitySetupTokens(tokens: RegisteredRewardToken[]) {
  return [...tokens]
    .filter((token) => token.tokenId !== "sui")
    .sort((left, right) => {
      const leftConfigured = isCommunityRewardConfigured(left.tokenId);
      const rightConfigured = isCommunityRewardConfigured(right.tokenId);
      if (leftConfigured !== rightConfigured) return leftConfigured ? 1 : -1;
      return left.symbol.localeCompare(right.symbol);
    });
}

function defaultCommunitySetupTokenId(tokens: RegisteredRewardToken[]) {
  const communityTokens = sortCommunitySetupTokens(tokens);
  const priorityUnconfiguredToken = communityTokens.find((token) => !isCommunityRewardConfigured(token.tokenId));
  return priorityUnconfiguredToken?.tokenId || communityTokens[0]?.tokenId || "";
}

function formatCommunityTokenConfigBlock(config: CommunityRewardTokenConfig) {
  return `{
  tokenId: "${config.tokenId}",
  symbol: "${config.symbol}",
  coinType: "${config.coinType}",
  poolObjectId: "${config.poolObjectId}",
  poolInitialSharedVersion: ${config.poolInitialSharedVersion},
  eligibilityRegistryObjectId: "${config.eligibilityRegistryObjectId || "<ELIGIBILITY_REGISTRY_OBJECT_ID>"}",
  eligibilityRegistryInitialSharedVersion: ${config.eligibilityRegistryInitialSharedVersion || "<ELIGIBILITY_REGISTRY_INITIAL_SHARED_VERSION>"},
  ...COMMUNITY_FUNCTIONS,
},`;
}

function formatCommunityTokenSetupProcedure(token: RegisteredRewardToken) {
  return `# Create the shared CommunityTokenRewardPool<${token.symbol}> for the default NFTree type.
sui client call --package ${COMMUNITY_REWARDS_PACKAGE_ID} --module rewards --function create_default_community_token_pool --type-args "${token.coinType}" --args ${CONFIG.adminCapId} --gas-budget 50000000

# Save the created pool object ID and initial shared version from the transaction output.

# Create the EligibilityRegistry attached to that pool.
sui client call --package ${COMMUNITY_REWARDS_PACKAGE_ID} --module rewards --function create_community_token_eligibility_registry --type-args "${token.coinType}" --args ${CONFIG.adminCapId} <POOL_OBJECT_ID> --gas-budget 50000000

# Save the registry object ID and initial shared version, then add both objects to src/communityRewards.ts.`;
}

function mergeMetadataIntoSettings(
  settings: FeaturedTokenSettings,
  metadataResult: TokenMetadataResult,
): FeaturedTokenSettings {
  const metadata = metadataResult.metadata;
  return {
    ...settings,
    displayName: settings.displayName || metadata.name || "",
    symbol: settings.symbol || metadata.symbol || "",
    projectName: settings.projectName || metadata.name || settings.projectName,
    decimals: settings.decimals || metadata.decimals?.toString() || "",
    logoUrl: settings.logoUrl || metadata.logoUrl || "",
    projectUrl: settings.projectUrl || metadata.projectUrl || "",
    xUrl: settings.xUrl || metadata.xUrl || "",
    telegramUrl: settings.telegramUrl || metadata.telegramUrl || "",
    chartUrl: settings.chartUrl || metadata.chartUrl || "",
    notes: settings.notes || metadata.notes || "",
  };
}

type CachedTokenMetadata = {
  cachedAt: number;
  metadata: TokenMetadataDraft;
};

function readRegisteredTokenMetadataCache(): Record<string, CachedTokenMetadata> {
  if (typeof window === "undefined") return {};

  try {
    const saved = window.localStorage.getItem(REGISTERED_TOKEN_METADATA_CACHE_KEY);
    if (!saved) return {};
    return JSON.parse(saved) as Record<string, CachedTokenMetadata>;
  } catch {
    return {};
  }
}

function writeRegisteredTokenMetadataCache(cache: Record<string, CachedTokenMetadata>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(REGISTERED_TOKEN_METADATA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Metadata cache is helpful, not required for the claim page to function.
  }
}

function readTelegramAlertHistory(): TelegramAlertHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(TELEGRAM_ALERT_HISTORY_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as TelegramAlertHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeTelegramAlertHistory(history: TelegramAlertHistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TELEGRAM_ALERT_HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Alert history is a local UI convenience only.
  }
}

function readTelegramEligibilityRecords(): Record<string, TelegramEligibilityRecord> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(TELEGRAM_ELIGIBILITY_RECORD_KEY);
    if (!saved) return {};
    return JSON.parse(saved) as Record<string, TelegramEligibilityRecord>;
  } catch {
    return {};
  }
}

function writeTelegramEligibilityRecords(records: Record<string, TelegramEligibilityRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TELEGRAM_ELIGIBILITY_RECORD_KEY, JSON.stringify(records));
  } catch {
    // Eligibility publish records are local Project Tools hints only.
  }
}

function telegramEligibilityRecordKey(tokenId: string, round: bigint | string) {
  return `${tokenId}:${round.toString()}`;
}

function telegramAlertTypeLabel(type: TelegramAlertType) {
  if (type === "reward-live") return "Reward Distribution Live";
  if (type === "pool-funded") return "Community Pool Funded";
  return "Campaign Rewards Coming Soon";
}

function buildTelegramMessage(type: TelegramAlertType, assets: TelegramAlertAsset[], claimUrl: string) {
  const symbols = assets.length ? assets.map((asset) => `- ${asset.symbol}`).join("\n") : "- TreeDrop reward assets";
  if (type === "reward-live") {
    return `TreeDrop reward distribution is live!\n\nNFTree holders can now check rewards for:\n${symbols}\n\nClaim here:\n${claimUrl}\n\nOnly eligible NFTrees from the current distribution can claim.\n\nNo NFTree yet? Mint one for future reward drops: https://nftree.net/mint`;
  }
  if (type === "pool-funded") {
    return `Community reward pool funded!\n\n${assets[0]?.symbol || "Community token"} rewards have been added to TreeDrop.\nDistribution details will be announced when claims are live.\n\nFollow TreeDrop: ${claimUrl}`;
  }
  return `Campaign rewards are coming soon!\n\nTREE raid participants will be able to check eligibility when campaign exports are connected.\n\nTreeDrop: ${claimUrl}`;
}

function applyCachedTokenMetadata(
  tokens: RegisteredRewardToken[],
  cache: Record<string, CachedTokenMetadata>,
): RegisteredRewardToken[] {
  const now = Date.now();
  return tokens.map((token) => {
    const cached = cache[token.tokenId];
    if (!cached || now - cached.cachedAt > TOKEN_METADATA_CACHE_TTL_MS) return token;
    if (cached.metadata.decimals !== undefined && cached.metadata.decimals !== token.decimals) {
      console.warn(`Token decimal mismatch detected for ${token.symbol}. Ignoring stale cached decimals.`, {
        tokenId: token.tokenId,
        coinType: token.coinType,
        registryDecimals: token.decimals,
        cachedDecimals: cached.metadata.decimals,
      });
      const { decimals: _staleDecimals, ...safeMetadata } = cached.metadata;
      return applyMetadataToRegisteredToken(token, safeMetadata);
    }
    return applyMetadataToRegisteredToken(token, cached.metadata);
  });
}

async function fetchCoinObjectIds(owner: string, coinType: string, amountNeeded: bigint, signal?: AbortSignal) {
  const coins = await fetchRewardCoins(owner, coinType, signal);
  let collected = 0n;
  const ids: string[] = [];
  for (const coin of coins) {
    ids.push(coin.coinObjectId);
    collected += BigInt(coin.balance);
    if (collected >= amountNeeded) return ids;
  }
  throw new Error("Insufficient token balance for this contribution.");
}

async function fetchWalletCoinBalance(owner: string, coinType: string, signal?: AbortSignal) {
  return fetchRewardBalance(owner, coinType, signal);
}

function atomicToDecimalInput(amount: bigint, decimals: number) {
  if (amount <= 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionText}`;
}

function useRewardPool() {
  const [pool, setPool] = useState<RewardPoolState>(unavailablePoolState);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    setLoading(true);
    try {
      setPool(await fetchRewardPoolState(controller.signal));
    } catch {
      setPool(unavailablePoolState());
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pool, loading, refresh };
}

function useCommunityTokenPools(tokens: RegisteredRewardToken[]) {
  const [communityPools, setCommunityPools] = useState<CommunityTokenPoolState[]>([]);
  const [communityPoolsLoading, setCommunityPoolsLoading] = useState(false);

  const refreshCommunityPools = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    setCommunityPoolsLoading(true);
    try {
      setCommunityPools(await fetchAllCommunityTokenPoolStates(tokens, controller.signal));
    } catch {
      setCommunityPools([]);
    } finally {
      window.clearTimeout(timeout);
      setCommunityPoolsLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    void refreshCommunityPools();
  }, [refreshCommunityPools]);

  return { communityPools, communityPoolsLoading, refreshCommunityPools };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WalletIcon({ wallet }: { wallet: UiWallet }) {
  if (wallet.icon) {
    return <img src={wallet.icon} alt="" aria-hidden="true" />;
  }

  return <span aria-hidden="true">{wallet.name.slice(0, 1).toUpperCase()}</span>;
}

function TokenLogo({ token }: { token: RegisteredRewardToken }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [token.logoUrl]);

  if (token.logoUrl && !imageFailed) {
    return <img src={token.logoUrl} alt={`${token.symbol} logo`} onError={() => setImageFailed(true)} />;
  }

  return <span aria-hidden="true">{token.symbol.slice(0, 2)}</span>;
}

function FeaturedCommunityReward({ tokens }: { tokens: RegisteredRewardToken[] }) {
  return (
    <section className="featured-rewards" id="featured-rewards" aria-labelledby="featuredRewardsTitle">
      <div className="section-heading">
        <span>Featured Community Reward</span>
        <h2 id="featuredRewardsTitle">Featured Community Token</h2>
      </div>
      <p className="section-copy">
        Featured partners can introduce their project to NFTree holders while supporting community reward drops.
      </p>
      <div className="featured-project-grid">
        {tokens.map((token) => (
          <article className="featured-project-card" key={token.tokenId}>
            <div className="featured-project-topline">
              <span className="token-logo">
                <TokenLogo token={token} />
              </span>
              <div>
                <strong>{token.symbol}</strong>
                <span>{token.projectName}</span>
              </div>
              <em>Featured Partner</em>
            </div>
            <p>{token.notes}</p>
            <div className="featured-meta-grid">
              <span>
                <small>Network</small>
                Sui Mainnet
              </span>
              <span>
                <small>Reward type</small>
                {token.rewardType}
              </span>
            </div>
            <div className="featured-link-row" aria-label={`${token.symbol} links`}>
              {token.projectUrl ? (
                <a href={token.projectUrl} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
              {token.xUrl ? (
                <a href={token.xUrl} target="_blank" rel="noreferrer">
                  X
                </a>
              ) : null}
              {token.telegramUrl ? (
                <a href={token.telegramUrl} target="_blank" rel="noreferrer">
                  Telegram
                </a>
              ) : null}
              {token.chartUrl ? (
                <a href={token.chartUrl} target="_blank" rel="noreferrer">
                  Chart
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeaturedTokenSettingsPanel({
  tokens,
  settings,
  onSettingsChange,
  metadataStatus,
  isLoadingMetadata,
  onLoadMetadata,
}: {
  tokens: RegisteredRewardToken[];
  settings: FeaturedTokenSettings;
  onSettingsChange: (settings: FeaturedTokenSettings) => void;
  metadataStatus: string;
  isLoadingMetadata: boolean;
  onLoadMetadata: () => void;
}) {
  const selectedToken = tokens.find((token) => token.tokenId === settings.tokenId) || tokens[0];

  function updateField(field: keyof FeaturedTokenSettings, value: string) {
    onSettingsChange({ ...settings, [field]: value });
  }

  function selectToken(tokenId: string) {
    const token = tokens.find((item) => item.tokenId === tokenId) || selectedToken;
    onSettingsChange(featuredSettingsFromToken(token));
  }

  return (
    <section className="featured-settings protected-only-panel" aria-labelledby="featuredSettingsTitle">
      <div className="section-heading">
        <span>Project preview</span>
        <h2 id="featuredSettingsTitle">Featured Token Settings</h2>
      </div>
      <p className="section-copy">
        Preview only: these settings are saved in this browser. To change the public default for all visitors,
        update the registry/config, commit, and redeploy.
      </p>
      <div className="featured-settings-grid">
        <label className="field">
          <span>Featured token</span>
          <select value={settings.tokenId} onChange={(event) => selectToken(event.target.value)}>
            {tokens.map((token) => (
              <option key={token.tokenId} value={token.tokenId}>
                {formatTokenSelectLabel(token)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Display name</span>
          <input value={settings.displayName} onChange={(event) => updateField("displayName", event.target.value)} />
        </label>
        <label className="field">
          <span>Token symbol</span>
          <input value={settings.symbol} onChange={(event) => updateField("symbol", event.target.value)} />
        </label>
        <label className="field">
          <span>Project name</span>
          <input value={settings.projectName} onChange={(event) => updateField("projectName", event.target.value)} />
        </label>
        <label className="field">
          <span>Decimals</span>
          <input value={settings.decimals} onChange={(event) => updateField("decimals", event.target.value)} />
        </label>
        <label className="field">
          <span>Logo URL</span>
          <input value={settings.logoUrl} onChange={(event) => updateField("logoUrl", event.target.value)} />
        </label>
        <label className="field">
          <span>Website URL</span>
          <input value={settings.projectUrl} onChange={(event) => updateField("projectUrl", event.target.value)} />
        </label>
        <label className="field">
          <span>X/Twitter URL</span>
          <input value={settings.xUrl} onChange={(event) => updateField("xUrl", event.target.value)} />
        </label>
        <label className="field">
          <span>Telegram URL</span>
          <input value={settings.telegramUrl} onChange={(event) => updateField("telegramUrl", event.target.value)} />
        </label>
        <label className="field">
          <span>Chart URL</span>
          <input value={settings.chartUrl} onChange={(event) => updateField("chartUrl", event.target.value)} />
        </label>
        <label className="field featured-settings-notes">
          <span>Short description / notes</span>
          <textarea value={settings.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
        <div className="featured-settings-actions">
          <button className="secondary-action" type="button" onClick={onLoadMetadata} disabled={isLoadingMetadata}>
            {isLoadingMetadata ? "Loading metadata" : "Load metadata"}
          </button>
          <p>{metadataStatus}</p>
        </div>
      </div>
    </section>
  );
}

function CommunityPoolSetupPanel({
  tokens,
  onCopy,
}: {
  tokens: RegisteredRewardToken[];
  onCopy: (value: string, label: string) => void;
}) {
  const communityTokens = useMemo(() => sortCommunitySetupTokens(tokens), [tokens]);
  const unconfiguredTokens = useMemo(
    () => communityTokens.filter((token) => !isCommunityRewardConfigured(token.tokenId)),
    [communityTokens],
  );
  const [selectedTokenId, setSelectedTokenId] = useState(() => defaultCommunitySetupTokenId(tokens));

  useEffect(() => {
    if (!communityTokens.length) return;
    if (!communityTokens.some((token) => token.tokenId === selectedTokenId)) {
      setSelectedTokenId(defaultCommunitySetupTokenId(tokens));
    }
  }, [communityTokens, selectedTokenId, tokens]);

  const selectedToken = communityTokens.find((token) => token.tokenId === selectedTokenId) || communityTokens[0];
  const selectedConfig = selectedToken ? findCommunityRewardConfig(selectedToken.tokenId) : undefined;
  const selectedStatus = selectedConfig ? "Configured community pool" : "Not configured";
  const configuredCount = communityTokens.length - unconfiguredTokens.length;

  return (
    <section className="panel project-panel community-setup-panel" id="community-setup" aria-labelledby="communitySetupTitle">
      <div className="panel-head">
        <div>
          <span>Project setup</span>
          <h2 id="communitySetupTitle">Community Pool Setup</h2>
        </div>
        <span className="chip">
          {unconfiguredTokens.length
            ? `${unconfiguredTokens.length} setup required`
            : "All registered pools configured"}
        </span>
      </div>
      <p className="panel-helper">
        Registered tokens can participate after their CommunityTokenRewardPool and EligibilityRegistry are configured.
      </p>

      <div className="setup-overview-card">
        <strong>
          {unconfiguredTokens.length
            ? `${configuredCount} of ${communityTokens.length} community pools are configured.`
            : "All registered community pools are configured."}
        </strong>
        <p>
          Use the selector below to inspect any registered token pool, registry object, version, and config block.
        </p>
      </div>

      <label className="field">
        <span>Registered token</span>
        <select value={selectedToken?.tokenId || ""} onChange={(event) => setSelectedTokenId(event.target.value)}>
          {communityTokens.map((token) => (
            <option key={token.tokenId} value={token.tokenId}>
              {formatTokenSelectLabel(token)}
            </option>
          ))}
        </select>
      </label>

      {selectedToken ? (
        <>
          <div className="setup-status-grid">
            <span>
              <small>Token</small>
              <strong>{selectedToken.symbol}</strong>
            </span>
            <span>
              <small>Status</small>
              <strong>{selectedStatus}</strong>
            </span>
            <span>
              <small>Required action</small>
              <strong>
                {selectedConfig ? "Ready for funding" : "Create/configure CommunityTokenRewardPool<T>"}
              </strong>
            </span>
          </div>

          <label className="field">
            <span>Coin type</span>
            <textarea className="config-preview compact" readOnly value={selectedToken.coinType} />
          </label>

          {selectedConfig ? (
            <div className="setup-config-block">
              <div className="setup-status-grid">
                <span>
                  <small>Pool object</small>
                  <strong>{shortId(selectedConfig.poolObjectId)}</strong>
                </span>
                <span>
                  <small>Pool version</small>
                  <strong>{selectedConfig.poolInitialSharedVersion}</strong>
                </span>
                <span>
                  <small>Registry object</small>
                  <strong>{shortId(selectedConfig.eligibilityRegistryObjectId || "")}</strong>
                </span>
              </div>
              <label className="field">
                <span>Config block</span>
                <textarea className="config-preview" readOnly value={formatCommunityTokenConfigBlock(selectedConfig)} />
              </label>
              <div className="quick-row">
                <button
                  type="button"
                  onClick={() => onCopy(formatCommunityTokenConfigBlock(selectedConfig), `${selectedToken.symbol} config block`)}
                >
                  Copy config block
                </button>
                <button type="button" onClick={() => onCopy(selectedConfig.poolObjectId, `${selectedToken.symbol} pool ID`)}>
                  Copy pool ID
                </button>
              </div>
            </div>
          ) : (
            <div className="setup-required-card">
              <strong>Pool setup required before live contributions.</strong>
              <p>
                Pool must be created/configured using the project deployment/script flow, then added to
                src/communityRewards.ts.
              </p>
              <label className="field">
                <span>Project setup commands</span>
                <textarea className="config-preview" readOnly value={formatCommunityTokenSetupProcedure(selectedToken)} />
              </label>
              <button
                className="secondary-action"
                type="button"
                onClick={() => onCopy(formatCommunityTokenSetupProcedure(selectedToken), `${selectedToken.symbol} setup commands`)}
              >
                Copy setup commands
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="panel-helper">No registered community tokens are available for setup.</p>
      )}

      <p className="panel-helper">
        {configuredCount} of {communityTokens.length} registered community token pools are configured.
      </p>
    </section>
  );
}

function CommunityPoolSection({
  tokens,
  selectedToken,
  selectedTokenId,
  onTokenChange,
}: {
  tokens: RegisteredRewardToken[];
  selectedToken: RegisteredRewardToken;
  selectedTokenId: string;
  onTokenChange: (tokenId: string) => void;
}) {
  const selectedTokenLive = selectedToken.isDepositable && selectedToken.tokenId === "sui";
  const selectedTokenConfiguredCommunity = isCommunityRewardConfigured(selectedToken.tokenId);
  const selectedTokenStatusLabel = selectedTokenLive
    ? "Live contribution"
    : selectedTokenConfiguredCommunity
      ? "Configured community pool"
      : "Registered - pool not configured yet";
  const unconfiguredCommunityTokenCount = tokens.filter(
    (token) => token.tokenId !== "sui" && !isCommunityRewardConfigured(token.tokenId),
  ).length;

  return (
    <section className="community-pool" id="community-pool" aria-labelledby="communityPoolTitle">
      <div className="section-heading">
        <span>Community Pool</span>
        <h2 id="communityPoolTitle">Contribute to Community Pool</h2>
      </div>
      <div className="community-pool-card">
        <div>
          <strong>Projects can sponsor NFTree reward campaigns.</strong>
          <p>
            Supported community projects can help fund reward drops so NFTree holders benefit from
            community-supported rewards.
          </p>
          <p>
            Registered tokens can participate in TreeDrop reward campaigns after their community reward pool is
            configured. Configured pools can receive public contributions. Tokens without a configured pool need
            project setup before live funding is available.
          </p>
        </div>
        <div className="support-list" aria-label="Community pool support status">
          <span>Current supported contribution: SUI and configured community tokens</span>
          <span>
            {unconfiguredCommunityTokenCount
              ? `${unconfiguredCommunityTokenCount} registered community token${
                  unconfiguredCommunityTokenCount === 1 ? "" : "s"
                } still ${unconfiguredCommunityTokenCount === 1 ? "needs" : "need"} pool setup before live contributions.`
              : "Every registered community token has a configured community reward pool."}
          </span>
        </div>
      </div>
      <div className="community-contribution-selector" aria-label="Registered contribution token selector">
        <label className="field">
          <span>Choose a registered token</span>
          <select value={selectedTokenId} onChange={(event) => onTokenChange(event.target.value)}>
            {tokens.map((token) => (
              <option key={token.tokenId} value={token.tokenId}>
                {formatTokenSelectLabel(token)}
              </option>
            ))}
          </select>
        </label>
        <article className={`contribution-token-card ${selectedTokenLive || selectedTokenConfiguredCommunity ? "is-live" : "is-planned"}`}>
          <span className="token-logo">
            <TokenLogo token={selectedToken} />
          </span>
          <div>
            <strong>{selectedToken.symbol}</strong>
            <small>{selectedToken.name}</small>
          </div>
          <div className="contribution-token-status">
            <span>{selectedTokenStatusLabel}</span>
          <p>
            {selectedTokenLive
              ? "SUI contributions fund the live SUI RewardPool used by the current claim contract."
              : selectedTokenConfiguredCommunity
                ? "This registered token has a configured community reward pool and can receive token contributions."
                : "Registered with TreeDrop, but pool setup is required before live contributions."}
          </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function formatCampaignStatus(status: CampaignRewardConfig["status"]) {
  return status
    .split("-")
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function CampaignRewardsSection({
  campaigns,
  featuredTokens,
}: {
  campaigns: CampaignRewardConfig[];
  featuredTokens: RegisteredRewardToken[];
}) {
  return (
    <section className="campaign-rewards" aria-labelledby="campaignRewardsTitle">
      <div className="section-heading">
        <span>Campaign Rewards</span>
        <h2 id="campaignRewardsTitle">Campaign rewards</h2>
      </div>
      <div className="campaign-intro">
        <span className="chip">Coming soon</span>
        <p>
          Participated in a TREE raid or X campaign? Campaign rewards will appear here when TreeDrop campaign exports
          are connected.
        </p>
        <p>
          Campaign rewards are separate from standard NFTree holder distributions. Future campaigns may require
          campaign participation, TREE holdings, NFTree ownership, or other eligibility rules.
        </p>
      </div>

      <div className="campaign-card-grid">
        {campaigns.map((campaign) => {
          const featuredToken =
            featuredTokens.find((token) => token.tokenId === campaign.featuredTokenId) || featuredTokens[0];
          const partnerLabel = featuredToken ? `${featuredToken.name} (${featuredToken.symbol})` : campaign.featuredProject;

          return (
            <article className="campaign-card" key={campaign.campaignId}>
              <div className="campaign-card-head">
                <div>
                  <span>Sample campaign</span>
                  <h3>{campaign.title}</h3>
                </div>
                <em>{formatCampaignStatus(campaign.status)}</em>
              </div>
              <p>{campaign.description}</p>
              <div className="campaign-meta-grid">
                <span>
                  <small>Reward source</small>
                  Configured community reward pool
                </span>
                <span>
                  <small>Featured partner</small>
                  {partnerLabel}
                </span>
              </div>
              <div className="campaign-eligibility">
                <strong>Eligibility preview</strong>
                <ul>
                  <li>Campaign participant snapshot</li>
                  <li>Required TREE holding</li>
                  <li>NFTree holder check</li>
                  <li>One claim per eligible wallet/NFTree, depending on final campaign rules</li>
                </ul>
              </div>
              <button className="secondary-action" type="button" disabled>
                Campaign rewards coming soon
              </button>
            </article>
          );
        })}
      </div>

      <div className="campaign-flow" aria-label="Manual campaign reward flow">
        <strong>How campaign rewards will work</strong>
        <ol>
          <li>Campaign runs through Raidar.</li>
          <li>Participant snapshot is exported.</li>
          <li>TreeDrop checks wallet, TREE, and NFTree eligibility.</li>
          <li>Eligible wallets claim from a configured reward pool.</li>
        </ol>
      </div>
    </section>
  );
}

function CampaignSetupPreviewPanel({ campaigns }: { campaigns: CampaignRewardConfig[] }) {
  return (
    <section className="panel project-panel campaign-setup-preview" aria-labelledby="campaignSetupPreviewTitle">
      <div className="panel-head">
        <div>
          <span>Project planning</span>
          <h2 id="campaignSetupPreviewTitle">Campaign Setup Preview</h2>
        </div>
        <span className="chip">Preview only</span>
      </div>
      <p className="panel-helper">
        Future campaign rewards can use manual Raidar exports and TreeDrop eligibility checks. This preview does not
        upload snapshots, publish claims, or move funds.
      </p>
      <ol className="campaign-setup-list">
        <li>Export Raidar campaign snapshot</li>
        <li>Clean wallet list</li>
        <li>Select reward token/pool</li>
        <li>Set TREE/NFTree requirements</li>
        <li>Publish campaign claim window</li>
      </ol>
      <div className="setup-status-grid">
        <span>
          <small>Preview campaign</small>
          <strong>{campaigns[0]?.title || "Campaign rewards"}</strong>
        </span>
        <span>
          <small>Snapshot source</small>
          <strong>{campaigns[0]?.snapshotSource || "Raidar export"}</strong>
        </span>
        <span>
          <small>Claim status</small>
          <strong>Not live</strong>
        </span>
      </div>
    </section>
  );
}

function HolderSnapshotPanel({
  snapshot,
  snapshotSource,
  snapshotCutoffTime,
  isLoading,
  error,
  importText,
  resolvedOwnersImportText,
  tokens,
  suiPool,
  communityPools,
  onRefresh,
  onSnapshotCutoffTimeChange,
  onImportTextChange,
  onResolvedOwnersImportTextChange,
  onImportSnapshot,
  onImportResolvedOwners,
  onDownloadCsvTemplate,
  onCopyJson,
  onDownloadJson,
  onDownloadCsv,
  onDownloadUnresolvedCsv,
  publishState,
  onCheckEligibilityStatus,
  onPublishEligibility,
}: {
  snapshot: HolderSnapshot | null;
  snapshotSource: HolderSnapshotSource;
  snapshotCutoffTime: string;
  isLoading: boolean;
  error: string;
  importText: string;
  resolvedOwnersImportText: string;
  tokens: RegisteredRewardToken[];
  suiPool: RewardPoolState;
  communityPools: CommunityTokenPoolState[];
  onRefresh: () => void;
  onSnapshotCutoffTimeChange: (value: string) => void;
  onImportTextChange: (value: string) => void;
  onResolvedOwnersImportTextChange: (value: string) => void;
  onImportSnapshot: () => void;
  onImportResolvedOwners: () => void;
  onDownloadCsvTemplate: () => void;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  onDownloadCsv: () => void;
  onDownloadUnresolvedCsv: () => void;
  publishState: EligibilityPublishState;
  onCheckEligibilityStatus: (tokenId: string) => void;
  onPublishEligibility: (tokenId: string, batchSize: number) => void;
}) {
  const configuredTokens = useMemo(
    () => tokens.filter((token) => token.tokenId === "sui" || isCommunityRewardConfigured(token.tokenId)),
    [tokens],
  );
  const [distributionType, setDistributionType] = useState<"sui" | "community">("sui");
  const [selectedTokenId, setSelectedTokenId] = useState("tree");
  const [batchSize, setBatchSize] = useState("100");

  const communityTokens = configuredTokens.filter((token) => token.tokenId !== "sui");
  const selectedCommunityToken =
    communityTokens.find((token) => token.tokenId === selectedTokenId) || communityTokens[0];
  const selectedCommunityConfig = selectedCommunityToken
    ? findCommunityRewardConfig(selectedCommunityToken.tokenId)
    : undefined;
  const selectedCommunityPool = selectedCommunityToken
    ? communityPools.find((communityPool) => communityPool.tokenId === selectedCommunityToken.tokenId)
    : undefined;
  const selectedToken = distributionType === "sui" ? tokens.find((token) => token.tokenId === "sui") : selectedCommunityToken;
  const selectedPoolBalance =
    distributionType === "sui"
      ? formatSui(suiPool.vaultBalance, 4)
      : selectedCommunityToken && selectedCommunityPool?.source === "mainnet"
        ? `${formatTokenAmount(selectedCommunityPool.vaultBalance, selectedCommunityToken.decimals, 4)} ${selectedCommunityToken.symbol}`
        : "Pool unavailable";
  const selectedRound =
    distributionType === "sui"
      ? suiPool.currentRound.toString()
      : selectedCommunityPool?.source === "mainnet"
        ? selectedCommunityPool.currentRound.toString()
        : "Unavailable";
  const communityRegistryReady = Boolean(
    selectedCommunityConfig?.eligibilityRegistryObjectId &&
      selectedCommunityConfig.eligibilityRegistryInitialSharedVersion,
  );
  const selectedCommunityRoundOpen = Boolean(
    selectedCommunityPool?.source === "mainnet" && selectedCommunityPool.currentRound > 0n,
  );
  const selectedCommunityRoundKey =
    selectedCommunityPool?.source === "mainnet" ? selectedCommunityPool.currentRound.toString() : "";
  const normalizedBatchSize = clampEligibilityBatchSize(batchSize);
  const publishableEligibilityCount =
    distributionType === "community" && publishState.tokenId === selectedCommunityToken?.tokenId
      ? publishState.missingCount
      : snapshot?.eligibleNFTrees || 0;
  const publishBatchCount = snapshot
    ? Math.ceil(publishableEligibilityCount / normalizedBatchSize)
    : 0;
  const canPublishEligibility = Boolean(
    distributionType === "community" &&
      snapshot &&
      selectedCommunityToken &&
      communityRegistryReady &&
      selectedCommunityRoundOpen &&
      snapshot.snapshotTime &&
      snapshot.eligibleNFTrees > 0 &&
      publishState.tokenId === selectedCommunityToken.tokenId &&
      publishState.round === selectedCommunityRoundKey &&
      !publishState.isChecking &&
      !publishState.ownerMismatchCount &&
      !publishState.unavailableCount &&
      publishState.missingCount > 0 &&
      !publishState.isPublishing,
  );
  const estimatedMaxClaims = snapshot
    ? distributionType === "sui"
      ? suiPool.perNftreeMist > 0n
        ? (suiPool.vaultBalance / suiPool.perNftreeMist).toString()
        : "Not open"
      : selectedCommunityPool?.perNftreeAmount && selectedCommunityPool.perNftreeAmount > 0n
        ? (selectedCommunityPool.vaultBalance / selectedCommunityPool.perNftreeAmount).toString()
        : "Not open"
    : "Snapshot required";
  const activeSnapshotSource = snapshot?.source || snapshotSource;
  const unresolvedCount = snapshot?.unresolved.length || 0;
  const automaticSourceStatus = isLoading
    ? "Refreshing"
    : error
      ? /not configured|configured/i.test(error)
        ? "Not configured"
        : "Failed"
      : snapshot?.source === "indexer-graphql"
        ? "Ready"
        : "Ready";
  const automaticSourceUpdated = snapshot?.source === "indexer-graphql" ? formatSnapshotTime(snapshot.createdAt) : "--";

  useEffect(() => {
    if (
      distributionType !== "community" ||
      !snapshot ||
      !selectedCommunityToken ||
      !communityRegistryReady ||
      !selectedCommunityRoundOpen
    ) {
      return;
    }
    onCheckEligibilityStatus(selectedCommunityToken.tokenId);
  }, [
    communityRegistryReady,
    distributionType,
    onCheckEligibilityStatus,
    selectedCommunityRoundKey,
    selectedCommunityRoundOpen,
    selectedCommunityToken,
    snapshot,
  ]);

  return (
    <section className="panel project-panel holder-snapshot-panel" id="holder-snapshot" aria-labelledby="holderSnapshotTitle">
      <div className="panel-head">
        <div>
          <span>Project Tools</span>
          <h2 id="holderSnapshotTitle">Holder Snapshot</h2>
        </div>
        <span className="chip">{snapshot ? `${snapshot.eligibleNFTrees} eligible NFTrees` : "Snapshot needed"}</span>
      </div>
      <p className="panel-helper">Create a current NFTree holder snapshot for reward distribution eligibility.</p>

      <div className="snapshot-actions">
        <button className="primary-action" type="button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing Holder Snapshot" : "Refresh Holder Snapshot"}
        </button>
        <button type="button" onClick={onCopyJson} disabled={!snapshot}>
          Copy snapshot JSON
        </button>
        <button type="button" onClick={onDownloadJson} disabled={!snapshot}>
          Download snapshot JSON
        </button>
        <button type="button" onClick={onDownloadCsv} disabled={!snapshot}>
          Download holder CSV
        </button>
      </div>
      <p className="pool-balance-note">Refresh Holder Snapshot uses the configured snapshot data source.</p>

      <div className="snapshot-source-card" aria-label="Automatic snapshot source status">
        <span>
          <small>Automatic snapshot source</small>
          <strong>{automaticSourceStatus}</strong>
        </span>
        <span>
          <small>Last updated</small>
          <strong>{automaticSourceUpdated}</strong>
        </span>
      </div>

      {error ? <p className="pool-balance-note is-warning">{error}</p> : null}
      {snapshot?.warning ? <p className="pool-balance-note is-warning">{snapshot.warning}</p> : null}
      {unresolvedCount ? (
        <div className="snapshot-unresolved-card">
          <p>
            {formatInteger(unresolvedCount)} NFTree{unresolvedCount === 1 ? " has" : "s have"} unresolved owners and were excluded from
            eligibility export.
          </p>
          <button type="button" onClick={onDownloadUnresolvedCsv}>
            Download unresolved owners CSV
          </button>
        </div>
      ) : null}

      <div className="snapshot-summary-grid" aria-label="Holder snapshot summary">
        <span>
          <small>Snapshot source</small>
          <strong>{snapshotSourceLabel(activeSnapshotSource)}</strong>
        </span>
        <span>
          <small>Total NFTrees found</small>
          <strong>{snapshot ? formatInteger(snapshot.totalNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Total holder wallets</small>
          <strong>{snapshot ? formatInteger(snapshot.totalHolderWallets) : "--"}</strong>
        </span>
        <span>
          <small>Direct holders</small>
          <strong>{snapshot ? formatInteger(snapshot.directNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Resolved holders</small>
          <strong>{snapshot ? formatInteger(snapshot.resolvedNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Manually resolved holders</small>
          <strong>{snapshot ? formatInteger(snapshot.manualResolvedNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Unresolved owners</small>
          <strong>{snapshot ? formatInteger(snapshot.unresolvedNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Excluded project wallet NFTrees</small>
          <strong>{snapshot ? formatInteger(snapshot.excludedProjectWalletNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Eligible NFTrees</small>
          <strong>{snapshot ? formatInteger(snapshot.eligibleNFTrees) : "--"}</strong>
        </span>
        <span>
          <small>Eligible holder wallets</small>
          <strong>{snapshot ? formatInteger(snapshot.eligibleHolderWallets) : "--"}</strong>
        </span>
        <span>
          <small>Snapshot cutoff time</small>
          <strong>{formatSnapshotTime(snapshot?.snapshotTime)}</strong>
        </span>
      </div>

      <section className="snapshot-import-card" aria-labelledby="snapshotImportTitle">
        <div>
          <h3 id="snapshotImportTitle">Import Holder Snapshot</h3>
          <p>
            Paste JSON with a <code>nftrees</code> array, or CSV with <code>ownerAddress</code> and{" "}
            <code>nftreeObjectId</code> columns. Optional CSV columns: <code>nftreeLabel</code>,{" "}
            <code>version</code>, <code>digest</code>.
          </p>
        </div>
        <label className="field">
          <span>Snapshot cutoff time</span>
          <input
            type="datetime-local"
            value={snapshotCutoffTime}
            onChange={(event) => onSnapshotCutoffTimeChange(event.target.value)}
          />
          <small>Use the time the NFTree holder list was generated. This is the eligibility cutoff for this distribution.</small>
        </label>
        <label className="field">
          <span>Snapshot JSON or CSV</span>
          <textarea
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
            placeholder={`ownerAddress,nftreeObjectId\n0xOWNER_WALLET,0xNFTREE_OBJECT_ID`}
          />
        </label>
        <button className="secondary-action" type="button" onClick={onImportSnapshot} disabled={!importText.trim()}>
          Import Holder Snapshot
        </button>
        <button className="secondary-action" type="button" onClick={onDownloadCsvTemplate}>
          Download CSV template
        </button>
      </section>

      <section className="snapshot-import-card" aria-labelledby="resolvedOwnersImportTitle">
        <div>
          <h3 id="resolvedOwnersImportTitle">Resolve Unresolved Owners</h3>
          <p>
            Only import resolved owners when you have verified the final holder wallet. Unresolved NFTrees are excluded from
            eligibility until resolved.
          </p>
        </div>
        <div className="snapshot-source-card" aria-label="Unresolved owner resolution status">
          <span>
            <small>Unresolved owners</small>
            <strong>{snapshot ? formatInteger(unresolvedCount) : "--"}</strong>
          </span>
          <span>
            <small>Import format</small>
            <strong>nftreeObjectId, ownerAddress</strong>
          </span>
        </div>
        <button type="button" onClick={onDownloadUnresolvedCsv} disabled={!snapshot || !unresolvedCount}>
          Download unresolved owners CSV
        </button>
        <label className="field">
          <span>Resolved owners CSV</span>
          <textarea
            value={resolvedOwnersImportText}
            onChange={(event) => onResolvedOwnersImportTextChange(event.target.value)}
            placeholder={`nftreeObjectId,ownerAddress\n0xNFTREE_OBJECT_ID,0xFINAL_OWNER_WALLET`}
          />
          <small>Optional columns: notes, source.</small>
        </label>
        <button
          className="secondary-action"
          type="button"
          onClick={onImportResolvedOwners}
          disabled={!snapshot || !unresolvedCount || !resolvedOwnersImportText.trim()}
        >
          Import resolved owners
        </button>
      </section>

      <div className="snapshot-preview-grid">
        <section className="snapshot-preview-card" aria-labelledby="holderPreviewTitle">
          <h3 id="holderPreviewTitle">Eligible holders preview</h3>
          {snapshot?.holders.length ? (
            <div className="snapshot-table" role="table" aria-label="Eligible holder preview">
              {snapshot.holders.slice(0, 8).map((holder) => (
                <div role="row" key={holder.ownerAddress}>
                  <span role="cell">{shortId(holder.ownerAddress)}</span>
                  <span role="cell">{holder.nftreeCount} NFTree</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No holder snapshot loaded yet.</p>
          )}
        </section>

        <section className="snapshot-preview-card" aria-labelledby="distributionPreviewTitle">
          <h3 id="distributionPreviewTitle">Distribution Eligibility Preview</h3>
          <div className="distribution-type-toggle" role="group" aria-label="Snapshot distribution type">
            <button
              type="button"
              className={distributionType === "sui" ? "is-selected" : ""}
              onClick={() => setDistributionType("sui")}
            >
              SUI RewardPool
            </button>
            <button
              type="button"
              className={distributionType === "community" ? "is-selected" : ""}
              onClick={() => setDistributionType("community")}
            >
              Community Token Pool
            </button>
          </div>

          {distributionType === "community" ? (
            <label className="field">
              <span>Reward token / pool</span>
              <select value={selectedCommunityToken?.tokenId || ""} onChange={(event) => setSelectedTokenId(event.target.value)}>
                {communityTokens.map((token) => (
                  <option key={token.tokenId} value={token.tokenId}>
                    {formatTokenSelectLabel(token)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="setup-status-grid">
            <span>
              <small>Selected token</small>
              <strong>{selectedToken?.symbol || "SUI"}</strong>
            </span>
            <span>
              <small>Pool balance</small>
              <strong>{selectedPoolBalance}</strong>
            </span>
            <span>
              <small>Current round</small>
              <strong>{selectedRound}</strong>
            </span>
            <span>
              <small>Eligibility registry</small>
              <strong>
                {distributionType === "community"
                  ? shortId(selectedCommunityConfig?.eligibilityRegistryObjectId || "")
                  : "Claim-time NFTree ownership"}
              </strong>
            </span>
            <span>
              <small>Eligible NFTree count</small>
              <strong>{snapshot ? formatInteger(snapshot.eligibleNFTrees) : "--"}</strong>
            </span>
            <span>
              <small>Estimated max claims</small>
              <strong>{estimatedMaxClaims}</strong>
            </span>
          </div>

          <label className="field">
            <span>Batch size preview</span>
            <select value={batchSize} onChange={(event) => setBatchSize(event.target.value)}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          {distributionType === "sui" ? (
            <p className="pool-balance-note">
              SUI RewardPool verifies NFTree ownership at claim time and does not use this community-token eligibility registry.
            </p>
          ) : (
            <>
              {snapshot?.snapshotTime ? (
                <p className="pool-balance-note">
                  Publishing eligibility for snapshot cutoff: {formatSnapshotTime(snapshot.snapshotTime)}
                </p>
              ) : (
                <p className="pool-balance-note is-warning">Snapshot cutoff time is required before publishing eligibility.</p>
              )}
              <p className="pool-balance-note">
                Publishing eligibility for round {selectedCommunityRoundOpen ? selectedRound : "--"}. Batch size{" "}
                {normalizedBatchSize}; {publishBatchCount || 0} batch{publishBatchCount === 1 ? "" : "es"} expected.
              </p>
              {selectedCommunityToken ? (
                <div className="setup-status-grid" aria-label="Eligibility publishing status">
                  <span>
                    <small>Eligibility publishing status</small>
                    <strong>{eligibilityPreflightStatusLabel(publishState.preflightStatus)}</strong>
                  </span>
                  <span>
                    <small>{selectedCommunityToken.symbol} round</small>
                    <strong>{selectedRound}</strong>
                  </span>
                  <span>
                    <small>Snapshot eligible NFTrees</small>
                    <strong>{formatInteger(publishState.eligibleCount || snapshot?.eligibleNFTrees || 0)}</strong>
                  </span>
                  <span>
                    <small>Already published</small>
                    <strong>{formatInteger(publishState.alreadyPublishedCount)}</strong>
                  </span>
                  <span>
                    <small>Missing</small>
                    <strong>{formatInteger(publishState.missingCount)}</strong>
                  </span>
                  <span>
                    <small>Owner mismatch</small>
                    <strong>{formatInteger(publishState.ownerMismatchCount)}</strong>
                  </span>
                </div>
              ) : null}
              {publishState.isChecking ? (
                <p className="pool-balance-note">Checking existing eligibility before publishing.</p>
              ) : null}
              {publishState.preflightStatus === "snapshot-finalized" || publishState.preflightStatus === "snapshot-mismatch" ? (
                <p className="pool-balance-note is-warning">
                  Eligibility snapshot finalized for {selectedCommunityToken?.symbol || "this token"} round {selectedRound}.
                  Published count: {publishState.snapshotFinalizedCount ?? "--"}. Current snapshot count:{" "}
                  {snapshot?.eligibleNFTrees || 0}. To use a new holder snapshot, open a new distribution round.
                </p>
              ) : null}
              {publishState.preflightStatus === "already-published" ? (
                <p className="pool-balance-note">
                  Eligibility already published for {selectedCommunityToken?.symbol || "this token"} round {selectedRound}.
                </p>
              ) : null}
              {publishState.preflightStatus === "partially-published" ? (
                <p className="pool-balance-note">
                  Only missing eligibility rows will be published for {selectedCommunityToken?.symbol || "this token"}.
                </p>
              ) : null}
              {publishState.ownerMismatchCount ? (
                <p className="pool-balance-note is-warning">
                  Existing eligibility owner does not match current snapshot. Open a new distribution round or review the
                  snapshot before publishing.
                </p>
              ) : null}
              {publishState.unavailableCount ? (
                <p className="pool-balance-note is-warning">
                  Eligibility status unavailable. Refresh before publishing.
                </p>
              ) : null}
              {!selectedCommunityRoundOpen ? (
                <p className="pool-balance-note is-warning">Open a distribution before publishing eligibility for this pool.</p>
              ) : null}
              {!communityRegistryReady ? (
                <p className="pool-balance-note is-warning">This token pool is missing eligibility registry configuration.</p>
              ) : null}
              {publishState.progress ? <p className="pool-balance-note">{publishState.progress}</p> : null}
              {publishState.error ? <p className="pool-balance-note is-warning">{publishState.error}</p> : null}
              {publishState.lastPublishedCount ? (
                <p className="pool-balance-note">Last published count: {formatInteger(publishState.lastPublishedCount)} NFTrees.</p>
              ) : null}
              {publishState.digests.length ? (
                <div className="snapshot-table" role="table" aria-label="Eligibility publish transaction digests">
                  {publishState.digests.slice(-4).map((digest, index) => (
                    <div role="row" key={`${digest}-${index}`}>
                      <span role="cell">Digest</span>
                      <span role="cell">{shortId(digest)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                className="secondary-action"
                type="button"
                disabled={!canPublishEligibility}
                onClick={() => selectedCommunityToken && onPublishEligibility(selectedCommunityToken.tokenId, normalizedBatchSize)}
              >
                  {publishState.isPublishing
                  ? "Publishing eligibility"
                  : publishState.preflightStatus === "already-published" ||
                      publishState.preflightStatus === "snapshot-finalized" ||
                      publishState.preflightStatus === "snapshot-mismatch"
                    ? `Eligibility finalized for ${selectedCommunityToken?.symbol || "token"} round ${selectedRound}`
                    : publishState.preflightStatus === "partially-published"
                      ? `Publish missing eligibility for ${selectedCommunityToken?.symbol || "token"}`
                      : `Publish Eligibility for ${selectedCommunityToken?.symbol || "token"}`}
              </button>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function TelegramAlertsPanel({
  alertType,
  onAlertTypeChange,
  assets,
  message,
  onMessageChange,
  imageUrl,
  onImageUrlChange,
  onUseDefaultImage,
  onClearImage,
  serviceStatus,
  confirmationChecked,
  onConfirmationChange,
  confirmationDisabled,
  confirmationStatusText,
  canSend,
  sendStatus,
  history,
  onSend,
}: {
  alertType: TelegramAlertType;
  onAlertTypeChange: (value: TelegramAlertType) => void;
  assets: TelegramAlertAsset[];
  message: string;
  onMessageChange: (value: string) => void;
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  onUseDefaultImage: () => void;
  onClearImage: () => void;
  serviceStatus: TelegramServiceStatus;
  confirmationChecked: boolean;
  onConfirmationChange: (checked: boolean) => void;
  confirmationDisabled: boolean;
  confirmationStatusText: string;
  canSend: boolean;
  sendStatus: TxStatus;
  history: TelegramAlertHistoryItem[];
  onSend: () => void;
}) {
  const claimReadyAssets = assets.filter((asset) => asset.isClaimReady);
  const openButNotReadyAssets = assets.filter((asset) => asset.isOpen && !asset.isClaimReady);
  const includedAssets = alertType === "reward-live" ? claimReadyAssets : assets;

  return (
    <section className="panel project-panel telegram-alert-panel" id="telegram-alerts" aria-labelledby="telegramAlertTitle">
      <div className="panel-head">
        <div>
          <span>Project Tools</span>
          <h2 id="telegramAlertTitle">Telegram Alerts</h2>
        </div>
        <span className="chip">Protected project controls</span>
      </div>
      <p className="panel-helper">
        Send TreeDrop reward updates to the configured Telegram topic. Reward Distribution Live alerts unlock only after
        rewards are claim-ready.
      </p>

      <div className="setup-status-grid telegram-readiness-grid">
        <span>
          <small>Telegram service</small>
          <strong>{serviceStatus.isChecking ? "Checking" : serviceStatus.isConfigured ? "Configured" : "Not configured"}</strong>
        </span>
        <span>
          <small>Claim-ready assets</small>
          <strong>{claimReadyAssets.length ? claimReadyAssets.map((asset) => asset.symbol).join(", ") : "None yet"}</strong>
        </span>
        <span>
          <small>Open but waiting</small>
          <strong>{openButNotReadyAssets.length ? openButNotReadyAssets.map((asset) => asset.symbol).join(", ") : "None"}</strong>
        </span>
      </div>
      {!serviceStatus.isConfigured ? <p className="pool-balance-note is-warning">{serviceStatus.message}</p> : null}
      {alertType === "reward-live" && openButNotReadyAssets.length ? (
        <p className="pool-balance-note is-warning">
          Publish eligibility before sending claim-live alert.
        </p>
      ) : null}

      <label className="field">
        <span>Alert type</span>
        <select value={alertType} onChange={(event) => onAlertTypeChange(event.target.value as TelegramAlertType)}>
          <option value="reward-live">Reward Distribution Live</option>
          <option value="pool-funded">Community Pool Funded</option>
          <option value="campaign-coming-soon">Campaign Rewards Coming Soon</option>
        </select>
      </label>

      <section className="snapshot-preview-card telegram-assets-card" aria-labelledby="telegramAssetsTitle">
        <h3 id="telegramAssetsTitle">Active reward assets</h3>
        {assets.length ? (
          <div className="snapshot-table telegram-assets-table" role="table" aria-label="Telegram alert asset readiness">
            {assets.map((asset) => (
              <div role="row" key={asset.tokenId}>
                <span role="cell">{asset.symbol}</span>
                <span role="cell">{asset.eligibilityLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>No active reward assets are open right now.</p>
        )}
      </section>

      <label className="field">
        <span>Message preview</span>
        <textarea value={message} onChange={(event) => onMessageChange(event.target.value)} />
      </label>
      <label className="field">
        <span>Alert image URL or Telegram file_id</span>
        <input
          value={imageUrl}
          onChange={(event) => onImageUrlChange(event.target.value)}
          placeholder="Optional image URL or Telegram file_id"
        />
      </label>
      <div className="telegram-image-actions">
        <button className="secondary-action" type="button" onClick={onUseDefaultImage}>
          Use default TreeDrop image
        </button>
        <button className="secondary-action" type="button" onClick={onClearImage} disabled={!imageUrl.trim()}>
          Clear image
        </button>
      </div>
      {imageUrl.trim() === TELEGRAM_DEFAULT_IMAGE_URL ? (
        <figure className="telegram-image-preview">
          <img src={TELEGRAM_DEFAULT_IMAGE_URL} alt="Default TreeDrop Telegram alert preview" />
          <figcaption>Default TreeDrop alert image</figcaption>
        </figure>
      ) : null}
      <p className="pool-balance-note">
        Included reward assets: {includedAssets.length ? includedAssets.map((asset) => asset.symbol).join(", ") : "None"}. Claim URL: https://treedrop.xyz.
        {imageUrl.trim() ? " This alert will be sent as a Telegram photo with caption." : " This alert will be sent as text only."}
      </p>

      <label className="telegram-confirm-row">
        <input
          type="checkbox"
          checked={confirmationChecked}
          disabled={confirmationDisabled}
          onChange={(event) => onConfirmationChange(event.target.checked)}
        />
        <span>I confirm this alert is ready to send.</span>
      </label>
      <p className={`pool-balance-note ${confirmationDisabled ? "is-warning" : ""}`}>{confirmationStatusText}</p>
      <p className="pool-balance-note">
        Recent send history is stored in this browser only. It does not prevent duplicate Telegram alerts globally.
      </p>

      <button className="primary-action" type="button" disabled={!canSend} onClick={onSend}>
        Send Telegram Alert
      </button>
      {sendStatus.tone !== "idle" ? <p className={`panel-note ${sendStatus.tone}`}>{sendStatus.detail}</p> : null}

      <section className="snapshot-preview-card telegram-history-card" aria-labelledby="telegramHistoryTitle">
        <h3 id="telegramHistoryTitle">Recent local alert sends</h3>
        {history.length ? (
          <div className="snapshot-table" role="table" aria-label="Recent Telegram alert sends">
            {history.map((item) => (
              <div role="row" key={item.id}>
                <span role="cell">{telegramAlertTypeLabel(item.alertType)}</span>
                <span role="cell">{new Date(item.sentAt).toLocaleString()} - {item.assets.join(", ") || "No assets"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>No local Telegram alert history yet.</p>
        )}
      </section>
    </section>
  );
}
function RegisteredRewardTokens({ tokens }: { tokens: RegisteredRewardToken[] }) {
  return (
    <section className="registered-tokens" id="registered-tokens" aria-labelledby="registeredTokensTitle">
      <div className="section-heading">
        <span>Registered Reward Tokens</span>
        <h2 id="registeredTokensTitle">Tokens registered with TreeDrop</h2>
      </div>
      <p className="section-copy">
        This list shows approved tokens in the TreeDrop ecosystem registry. Live contribution status appears in
        Community Pool, and live claim assets appear in the Claim and Drop Details sections.
      </p>
      <div className="token-registry-list">
        {tokens.map((token) => (
          <article className="token-registry-card compact-token-card" key={token.tokenId}>
            <div className="token-registry-head">
              <span className="token-logo">
                <TokenLogo token={token} />
              </span>
              <div>
                <strong>{token.symbol}</strong>
                <small>{token.name}</small>
              </div>
            </div>
            <div className="token-role-row">
              {token.tokenId === "tree" ? <span className="is-host">TREE Ecosystem</span> : null}
              {token.isFeatured ? <span className="is-featured">Featured Partner</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const sponsorOnly = new URLSearchParams(window.location.search).has("sponsor");
  const account = useCurrentAccount();
  const wallet = useCurrentWallet();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const network = useCurrentNetwork();
  const dAppKit = useDAppKit();
  const { pool, loading, refresh } = useRewardPool();
  const [fundAmount, setFundAmount] = useState("0.1");
  const [roundAmount, setRoundAmount] = useState("0.01");
  const [nftreeObjectId, setNftreeObjectId] = useState("");
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [ownedNFTrees, setOwnedNFTrees] = useState<OwnedNFTree[]>([]);
  const [nftreeLoading, setNftreeLoading] = useState(false);
  const [suiClaimStatusLoading, setSuiClaimStatusLoading] = useState(false);
  const [communityClaimStatusLoading, setCommunityClaimStatusLoading] = useState(false);
  const [communityEligibilityStatusLoading, setCommunityEligibilityStatusLoading] = useState(false);
  const [suiClaimStatusError, setSuiClaimStatusError] = useState("");
  const [communityClaimStatusError, setCommunityClaimStatusError] = useState("");
  const [communityEligibilityStatusError, setCommunityEligibilityStatusError] = useState("");
  const [claimStatusRefreshNonce, setClaimStatusRefreshNonce] = useState(0);
  const [claimedNFTreeIds, setClaimedNFTreeIds] = useState<Set<string>>(new Set());
  const [claimedCommunityNFTreeIds, setClaimedCommunityNFTreeIds] = useState<Record<string, Set<string>>>({});
  const [communityEligibilityByTokenId, setCommunityEligibilityByTokenId] = useState<Record<string, CommunityEligibilityState>>({});
  const [claimAllProgress, setClaimAllProgress] = useState("");
  const [claimAllActive, setClaimAllActive] = useState(false);
  const [nftreeScanError, setNftreeScanError] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>(EMPTY_STATUS);
  const [displayRewardTokens, setDisplayRewardTokens] = useState<RegisteredRewardToken[]>(REGISTERED_REWARD_TOKENS);
  const [selectedContributionTokenId, setSelectedContributionTokenId] = useState("sui");
  const [selectedWalletBalance, setSelectedWalletBalance] = useState<bigint | null>(null);
  const [selectedWalletBalanceLoading, setSelectedWalletBalanceLoading] = useState(false);
  const [selectedWalletBalanceError, setSelectedWalletBalanceError] = useState("");
  const [balanceRefreshNonce, setBalanceRefreshNonce] = useState(0);
  const [distributionType, setDistributionType] = useState<"sui" | "community">("sui");
  const [selectedDistributionTokenId, setSelectedDistributionTokenId] = useState("tree");
  const [communityRoundAmount, setCommunityRoundAmount] = useState("1");
  const [metadataStatus, setMetadataStatus] = useState(
    "Metadata loads from the local preview, TreeDrop registry, Sui coin metadata, then fallback badges. Noodles enrichment needs a backend proxy.",
  );
  const [metadataLoading, setMetadataLoading] = useState(false);
  const featuredTokenOptions = useMemo(
    () => REGISTERED_REWARD_TOKENS.filter((token) => token.isActive && token.tokenId !== "tree" && token.tokenId !== "sui"),
    [],
  );
  const defaultFeaturedToken = FEATURED_REWARD_TOKENS[0] || featuredTokenOptions[0] || REGISTERED_REWARD_TOKENS[0]!;
  const [featuredSettings, setFeaturedSettings] = useState<FeaturedTokenSettings>(() =>
    loadFeaturedTokenSettings(defaultFeaturedToken),
  );
  const adminFeaturedPreviewToken = useMemo(() => {
    const selectedToken =
      featuredTokenOptions.find((token) => token.tokenId === featuredSettings.tokenId) || defaultFeaturedToken;
    return applyFeaturedSettings(selectedToken, featuredSettings);
  }, [defaultFeaturedToken, featuredSettings, featuredTokenOptions]);
  const publicFeaturedTokens = useMemo(
    () => displayRewardTokens.filter((token) => token.isFeatured && token.isActive),
    [displayRewardTokens],
  );
  const { communityPools, communityPoolsLoading, refreshCommunityPools } = useCommunityTokenPools(displayRewardTokens);
  const [holderSnapshot, setHolderSnapshot] = useState<HolderSnapshot | null>(null);
  const [holderSnapshotSource, setHolderSnapshotSource] = useState<HolderSnapshotSource>("unavailable");
  const [holderSnapshotCutoffTime, setHolderSnapshotCutoffTime] = useState(() => toLocalDateTimeInputValue());
  const [holderSnapshotImportText, setHolderSnapshotImportText] = useState("");
  const [resolvedOwnersImportText, setResolvedOwnersImportText] = useState("");
  const [holderSnapshotLoading, setHolderSnapshotLoading] = useState(false);
  const [holderSnapshotError, setHolderSnapshotError] = useState("");
  const [eligibilityPublishState, setEligibilityPublishState] =
    useState<EligibilityPublishState>(emptyEligibilityPublishState);
  const [telegramAlertType, setTelegramAlertType] = useState<TelegramAlertType>("reward-live");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramImageUrl, setTelegramImageUrl] = useState("");
  const [telegramConfirmationChecked, setTelegramConfirmationChecked] = useState(false);
  const [telegramSendStatus, setTelegramSendStatus] = useState<TxStatus>({
    label: "Telegram ready",
    detail: "Choose an alert type and confirm before sending.",
    tone: "idle",
  });
  const [telegramServiceStatus, setTelegramServiceStatus] = useState<TelegramServiceStatus>({
    isChecking: false,
    isConfigured: false,
    message: "Telegram alert service status has not been checked yet.",
  });
  const [telegramAlertHistory, setTelegramAlertHistory] = useState<TelegramAlertHistoryItem[]>(() => readTelegramAlertHistory());
  const [telegramEligibilityRecords, setTelegramEligibilityRecords] = useState<Record<string, TelegramEligibilityRecord>>(() =>
    readTelegramEligibilityRecords(),
  );

  useEffect(() => {
    writeTelegramAlertHistory(telegramAlertHistory);
  }, [telegramAlertHistory]);

  useEffect(() => {
    writeTelegramEligibilityRecords(telegramEligibilityRecords);
  }, [telegramEligibilityRecords]);



  useEffect(() => {
    const controller = new AbortController();
    const cache = readRegisteredTokenMetadataCache();
    setDisplayRewardTokens(applyCachedTokenMetadata(REGISTERED_REWARD_TOKENS, cache));

    const now = Date.now();
    const tokensNeedingMetadata = REGISTERED_REWARD_TOKENS.filter((token) => {
      const cached = cache[token.tokenId];
      const staleDecimals = cached?.metadata.decimals !== undefined && cached.metadata.decimals !== token.decimals;
      if (staleDecimals) return true;
      return !cached || now - cached.cachedAt > TOKEN_METADATA_CACHE_TTL_MS;
    });

    if (!tokensNeedingMetadata.length) return () => controller.abort();

    void Promise.allSettled(
      tokensNeedingMetadata.map(async (token) => {
        const result = await hydrateRegisteredTokenMetadata(token, controller.signal);
        const hydrated = applyMetadataToRegisteredToken(token, result.metadata);

        console.debug("[TreeDrop token metadata]", {
          tokenId: token.tokenId,
          symbol: token.symbol,
          registryDecimals: token.decimals,
          metadataDecimals: result.metadata.decimals,
          decimalsSource: result.metadata.decimals !== undefined ? "sui" : "registry",
          hasRegistryLogo: result.diagnostics?.hasRegistryLogo ?? Boolean(token.logoUrl),
          hasSuiIconUrl: result.diagnostics?.hasSuiIconUrl ?? Boolean(result.metadata.logoUrl),
          logoSource: result.diagnostics?.logoSource ?? (result.metadata.logoUrl ? "sui" : "fallback"),
        });
        if (result.metadata.decimals !== undefined && result.metadata.decimals !== token.decimals) {
          console.warn(`Token decimal mismatch detected for ${token.symbol}. Using on-chain metadata decimals.`, {
            symbol: token.symbol,
            coinType: token.coinType,
            registryDecimals: token.decimals,
            metadataDecimals: result.metadata.decimals,
          });
        }

        return { tokenId: token.tokenId, metadata: result.metadata, hydrated };
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;

      const nextCache = { ...readRegisteredTokenMetadataCache() };
      const hydratedById = new Map<string, RegisteredRewardToken>();

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        nextCache[result.value.tokenId] = {
          cachedAt: Date.now(),
          metadata: result.value.metadata,
        };
        hydratedById.set(result.value.tokenId, result.value.hydrated);
      }

      writeRegisteredTokenMetadataCache(nextCache);
      setDisplayRewardTokens((current) =>
        current.map((token) => hydratedById.get(token.tokenId) || applyMetadataToRegisteredToken(token, nextCache[token.tokenId]?.metadata || {})),
      );
    });

    return () => controller.abort();
  }, []);

  const loadFeaturedMetadata = useCallback(async () => {
    const selectedToken =
      featuredTokenOptions.find((token) => token.tokenId === featuredSettings.tokenId) || defaultFeaturedToken;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    setMetadataLoading(true);
    setMetadataStatus("Loading registry and Sui coin metadata...");
    try {
      const result = await hydrateRegisteredTokenMetadata(selectedToken, controller.signal);
      setFeaturedSettings((current) => mergeMetadataIntoSettings(current, result));
      setMetadataStatus(result.message);
    } catch {
      setMetadataStatus("Metadata lookup failed. The preview is still using registry values and fallback badges.");
    } finally {
      window.clearTimeout(timeout);
      setMetadataLoading(false);
    }
  }, [defaultFeaturedToken, featuredSettings.tokenId, featuredTokenOptions]);

  useEffect(() => {
    if (!account?.address) {
      setOwnedNFTrees([]);
      setNftreeObjectId("");
      setClaimedNFTreeIds(new Set());
      setClaimedCommunityNFTreeIds({});
      setNftreeScanError("");
      setNftreeLoading(false);
      setSuiClaimStatusLoading(false);
      setCommunityClaimStatusLoading(false);
      setSuiClaimStatusError("");
      setCommunityClaimStatusError("");
      return;
    }

    const controller = new AbortController();
    setNftreeLoading(true);
    setNftreeScanError("");

    fetchOwnedNFTrees(account.address, controller.signal)
      .then((items) => {
        setOwnedNFTrees(items);
        setNftreeObjectId((current) => current.trim() || items[0]?.objectId || "");
        if (!items.length) setNftreeScanError("No NFTree objects found in this wallet.");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setOwnedNFTrees([]);
        setNftreeScanError(error instanceof Error ? error.message : "NFTree scan failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setNftreeLoading(false);
      });

    return () => controller.abort();
  }, [account?.address]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEATURED_TOKEN_SETTINGS_KEY, JSON.stringify(featuredSettings));
  }, [featuredSettings]);

  useEffect(() => {
    if (
      !account?.address ||
      isRewardExcludedWallet(account.address) ||
      !ownedNFTrees.length ||
      pool.currentRound <= 0n ||
      pool.perNftreeMist <= 0n
    ) {
      setClaimedNFTreeIds(new Set());
      setSuiClaimStatusLoading(false);
      setSuiClaimStatusError("");
      return;
    }

    if (!pool.claimedTableId) {
      console.error("[TreeDrop claim status] SUI claimed table ID unavailable", {
        poolId: CONFIG.poolId,
        currentRound: pool.currentRound.toString(),
        perNftreeMist: pool.perNftreeMist.toString(),
      });
      setClaimedNFTreeIds(new Set());
      setSuiClaimStatusLoading(false);
      setSuiClaimStatusError("SUI claim status unavailable. Refresh or try again before claiming.");
      return;
    }

    const controller = new AbortController();
    setSuiClaimStatusLoading(true);
    setSuiClaimStatusError("");
    fetchClaimedNFTrees(
      pool.claimedTableId,
      pool.currentRound,
      ownedNFTrees.map((nftree) => nftree.objectId),
      controller.signal,
    )
      .then(setClaimedNFTreeIds)
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[TreeDrop claim status] SUI claimed status fetch failed", {
          claimedTableId: pool.claimedTableId,
          currentRound: pool.currentRound.toString(),
          nftreeObjectIds: ownedNFTrees.map((nftree) => nftree.objectId),
          error,
        });
        setClaimedNFTreeIds(new Set());
        setSuiClaimStatusError("SUI claim status unavailable. Refresh or try again before claiming.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSuiClaimStatusLoading(false);
      });

    return () => controller.abort();
  }, [account?.address, claimStatusRefreshNonce, ownedNFTrees, pool.claimedTableId, pool.currentRound, pool.perNftreeMist]);

  useEffect(() => {
    const activeCommunityPools = getActiveCommunityDropAssets(communityPools);
    if (
      !account?.address ||
      isRewardExcludedWallet(account.address) ||
      !ownedNFTrees.length ||
      !activeCommunityPools.length
    ) {
      setClaimedCommunityNFTreeIds({});
      setCommunityClaimStatusLoading(false);
      setCommunityClaimStatusError("");
      return;
    }

    const missingClaimTable = activeCommunityPools.find((communityPool) => !communityPool.claimedTableId);
    if (missingClaimTable) {
      console.error("[TreeDrop claim status] community claimed table ID unavailable", {
        tokenId: missingClaimTable.tokenId,
        symbol: missingClaimTable.symbol,
        poolObjectId: missingClaimTable.poolObjectId,
        currentRound: missingClaimTable.currentRound.toString(),
        perNftreeAmount: missingClaimTable.perNftreeAmount.toString(),
      });
      setClaimedCommunityNFTreeIds({});
      setCommunityClaimStatusLoading(false);
      setCommunityClaimStatusError(
        `${missingClaimTable.symbol} claim status unavailable. Refresh or try again before claiming.`,
      );
      return;
    }

    const controller = new AbortController();
    setCommunityClaimStatusLoading(true);
    setCommunityClaimStatusError("");
    void Promise.all(
      activeCommunityPools.map(async (communityPool) => {
        const claimed = await fetchClaimedCommunityNFTrees(
          communityPool.claimedTableId,
          communityPool.currentRound,
          ownedNFTrees.map((nftree) => nftree.objectId),
          controller.signal,
        );
        return [communityPool.tokenId, claimed] as const;
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        setClaimedCommunityNFTreeIds(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[TreeDrop claim status] community claimed status fetch failed", {
            activeCommunityPools: activeCommunityPools.map((communityPool) => ({
              tokenId: communityPool.tokenId,
              symbol: communityPool.symbol,
              claimedTableId: communityPool.claimedTableId,
              currentRound: communityPool.currentRound.toString(),
            })),
            nftreeObjectIds: ownedNFTrees.map((nftree) => nftree.objectId),
            error,
          });
          setClaimedCommunityNFTreeIds({});
          setCommunityClaimStatusError("Community reward claim status unavailable. Refresh or try again before claiming.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCommunityClaimStatusLoading(false);
      });

    return () => controller.abort();
  }, [account?.address, claimStatusRefreshNonce, communityPools, ownedNFTrees]);

  useEffect(() => {
    const activeCommunityPools = getActiveCommunityDropAssets(communityPools);
    if (
      !account?.address ||
      isRewardExcludedWallet(account.address) ||
      !ownedNFTrees.length ||
      !activeCommunityPools.length
    ) {
      setCommunityEligibilityByTokenId({});
      setCommunityEligibilityStatusLoading(false);
      setCommunityEligibilityStatusError("");
      return;
    }

    const missingRegistry = activeCommunityPools.find((communityPool) => {
      const config = findCommunityRewardConfig(communityPool.tokenId);
      return !config?.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion;
    });
    if (missingRegistry) {
      console.error("[TreeDrop eligibility status] registry unavailable", {
        tokenId: missingRegistry.tokenId,
        symbol: missingRegistry.symbol,
        poolObjectId: missingRegistry.poolObjectId,
        currentRound: missingRegistry.currentRound.toString(),
      });
      setCommunityEligibilityByTokenId({});
      setCommunityEligibilityStatusLoading(false);
      setCommunityEligibilityStatusError(`${missingRegistry.symbol} eligibility status unavailable. Refresh or try again before claiming.`);
      return;
    }

    const controller = new AbortController();
    const nftreeObjectIds = ownedNFTrees.map((nftree) => nftree.objectId);
    setCommunityEligibilityStatusLoading(true);
    setCommunityEligibilityStatusError("");
    void Promise.all(
      activeCommunityPools.map(async (communityPool) => {
        const config = findCommunityRewardConfig(communityPool.tokenId);
        if (!config) throw new Error(`${communityPool.symbol} community reward config is missing.`);
        const result = await fetchCommunityEligibilityForNFTrees(
          config,
          communityPool.currentRound,
          nftreeObjectIds,
          account.address,
          controller.signal,
        );
        return [
          communityPool.tokenId,
          {
            eligibleNFTreeIds: result.eligibleNFTreeIds,
            ownerMismatchByNFTreeId: result.ownerMismatchByNFTreeId,
          },
        ] as const;
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        const next = Object.fromEntries(entries);
        console.info("[TreeDrop claimability] community eligibility loaded", {
          connectedWallet: account.address,
          activeAssets: activeCommunityPools.map((communityPool) => ({
            tokenId: communityPool.tokenId,
            symbol: communityPool.symbol,
            currentRound: communityPool.currentRound.toString(),
            eligibilityRegistryObjectId: communityPool.eligibilityRegistryObjectId,
            claimedTableId: communityPool.claimedTableId,
            eligibleNFTrees: next[communityPool.tokenId]?.eligibleNFTreeIds.size || 0,
          })),
          nftreeObjectIds,
        });
        setCommunityEligibilityByTokenId(next);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[TreeDrop eligibility status] community eligibility fetch failed", {
            activeCommunityPools: activeCommunityPools.map((communityPool) => ({
              tokenId: communityPool.tokenId,
              symbol: communityPool.symbol,
              eligibilityRegistryObjectId: communityPool.eligibilityRegistryObjectId,
              currentRound: communityPool.currentRound.toString(),
            })),
            nftreeObjectIds,
            error,
          });
          setCommunityEligibilityByTokenId({});
          setCommunityEligibilityStatusError("Community reward eligibility status unavailable. Refresh or try again before claiming.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCommunityEligibilityStatusLoading(false);
      });

    return () => controller.abort();
  }, [account?.address, claimStatusRefreshNonce, communityPools, ownedNFTrees]);

  const fundAmountMist = useMemo(() => parseSuiToMist(fundAmount), [fundAmount]);
  const roundAmountMist = useMemo(() => parseSuiToMist(roundAmount), [roundAmount]);
  const connected = Boolean(account?.address);
  const connectedAddress = account?.address || "";
  const isAdminWallet = connectedAddress.toLowerCase() === CONFIG.adminAddress.toLowerCase();
  const showAdminTools = connected && isAdminWallet;
  useEffect(() => {
    if (!showAdminTools || !TELEGRAM_ALERTS_ENABLED) return;
    const controller = new AbortController();
    setTelegramServiceStatus({
      isChecking: true,
      isConfigured: false,
      message: "Checking Telegram alert service configuration.",
    });
    fetch("/.netlify/functions/send-telegram-alert", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { configured?: boolean; message?: string };
        if (!response.ok) throw new Error(payload.message || "Telegram alert service status unavailable.");
        setTelegramServiceStatus({
          isChecking: false,
          isConfigured: Boolean(payload.configured),
          message: payload.message || (payload.configured ? "Telegram alert service is configured." : "Telegram alert service is not configured."),
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setTelegramServiceStatus({
          isChecking: false,
          isConfigured: false,
          message: error instanceof Error ? error.message : "Telegram alert service is not configured.",
        });
      });
    return () => controller.abort();
  }, [showAdminTools]);
  const rewardExcludedWallet = isRewardExcludedWallet(connectedAddress);
  const activeRound = pool.currentRound > 0n && pool.perNftreeMist > 0n;
  const activeCommunityDropAssets = getActiveCommunityDropAssets(communityPools);
  const configuredCommunityPoolByTokenId = new Map(communityPools.map((communityPool) => [communityPool.tokenId, communityPool]));
  const communityPoolByTokenId = new Map(activeCommunityDropAssets.map((communityPool) => [communityPool.tokenId, communityPool]));
  const activeCommunityTokenIds = new Set(activeCommunityDropAssets.map((communityPool) => communityPool.tokenId));
  const roundHasFunds = roundAmountMist > 0n && pool.vaultBalance >= roundAmountMist;
  const validNftreeObject = isSuiAddress(nftreeObjectId);
  const selectedContributionToken =
    displayRewardTokens.find((token) => token.tokenId === selectedContributionTokenId) ||
    displayRewardTokens.find((token) => token.tokenId === "sui") ||
    REGISTERED_REWARD_TOKENS[0]!;
  const selectedContributionIsLiveSui =
    selectedContributionToken.tokenId === "sui" && selectedContributionToken.isDepositable;
  const selectedContributionCommunityConfig = findCommunityRewardConfig(selectedContributionToken.tokenId);
  const selectedContributionIsConfiguredCommunityToken = Boolean(selectedContributionCommunityConfig);
  const selectedContributionCommunityPool = configuredCommunityPoolByTokenId.get(selectedContributionToken.tokenId);
  const selectedContributionPoolBalance = selectedContributionIsLiveSui
    ? formatSui(pool.vaultBalance, 4)
    : selectedContributionCommunityPool?.source === "mainnet"
      ? `${formatTokenAmount(selectedContributionCommunityPool.vaultBalance, selectedContributionToken.decimals, 4)} ${
          selectedContributionToken.symbol
        }`
      : selectedContributionIsConfiguredCommunityToken
        ? "Pool balance unavailable"
        : "";
  const fundAmountAtomic = useMemo(
    () =>
      selectedContributionIsLiveSui
        ? fundAmountMist
        : parseTokenAmountToAtomic(fundAmount, selectedContributionToken.decimals),
    [fundAmount, fundAmountMist, selectedContributionIsLiveSui, selectedContributionToken.decimals],
  );
  const selectedWalletBalanceLabel = !connected
    ? "Connect wallet to view balance."
    : selectedWalletBalanceLoading
      ? "Reading wallet balance..."
      : selectedWalletBalanceError
        ? "Balance unavailable"
        : selectedWalletBalance === null
          ? "Balance unavailable"
          : selectedContributionIsLiveSui
            ? formatSui(selectedWalletBalance, 4)
            : `${formatTokenAmount(selectedWalletBalance, selectedContributionToken.decimals, 4)} ${selectedContributionToken.symbol}`;
  const maxContributionAtomic =
    selectedWalletBalance === null
      ? 0n
      : selectedContributionIsLiveSui
        ? selectedWalletBalance > SUI_GAS_RESERVE_MIST
          ? selectedWalletBalance - SUI_GAS_RESERVE_MIST
          : 0n
        : selectedWalletBalance;
  const contributionAmountExceedsBalance =
    selectedWalletBalance !== null && fundAmountAtomic > maxContributionAtomic;
  const contributionAmountInvalid = fundAmountAtomic <= 0n;
  const contributionValidationMessage = !connected
    ? "Connect wallet to contribute."
    : selectedWalletBalanceError
      ? "Balance unavailable. Refresh or try again before contributing."
      : contributionAmountInvalid
        ? "Enter an amount greater than 0."
        : contributionAmountExceedsBalance
          ? selectedContributionIsLiveSui
            ? "Insufficient SUI balance after reserving 0.05 SUI for gas."
            : `Insufficient ${selectedContributionToken.symbol} balance.`
          : selectedContributionIsLiveSui
            ? "Max keeps 0.05 SUI available for gas."
            : "Ready to contribute from your wallet balance.";
  const setFundAmountPercent = useCallback(
    (percent: number) => {
      if (maxContributionAtomic <= 0n) {
        setFundAmount("0");
        return;
      }
      const amount = (maxContributionAtomic * BigInt(percent)) / 100n;
      setFundAmount(atomicToDecimalInput(amount, selectedContributionToken.decimals));
    },
    [maxContributionAtomic, selectedContributionToken.decimals],
  );
  const configuredCommunityDistributionTokens = displayRewardTokens.filter((token) =>
    COMMUNITY_REWARD_TOKEN_CONFIGS.some((config) => config.tokenId === token.tokenId),
  );
  const selectedDistributionToken =
    configuredCommunityDistributionTokens.find((token) => token.tokenId === selectedDistributionTokenId) ||
    configuredCommunityDistributionTokens[0];
  const selectedDistributionConfig = selectedDistributionToken
    ? findCommunityRewardConfig(selectedDistributionToken.tokenId)
    : undefined;
  const selectedDistributionPool = selectedDistributionToken
    ? configuredCommunityPoolByTokenId.get(selectedDistributionToken.tokenId)
    : undefined;
  const communityRoundAmountAtomic = selectedDistributionToken
    ? parseTokenAmountToAtomic(communityRoundAmount, selectedDistributionToken.decimals)
    : 0n;
  const communityDistributionHasConfig = Boolean(
    selectedDistributionConfig?.eligibilityRegistryObjectId &&
      selectedDistributionConfig?.eligibilityRegistryInitialSharedVersion &&
      selectedDistributionPool?.source === "mainnet",
  );
  const communityDistributionPoolBalance = selectedDistributionPool?.vaultBalance || 0n;
  const evenSplitEligibleCount = holderSnapshot?.eligibleNFTrees || 0;
  const canShowCommunityEvenSplit = Boolean(
    connected &&
      isAdminWallet &&
      distributionType === "community" &&
      selectedDistributionToken &&
      communityDistributionHasConfig &&
      holderSnapshot &&
      evenSplitEligibleCount > 0 &&
      communityDistributionPoolBalance > 0n,
  );
  const evenSplitPerNftreeAtomic =
    canShowCommunityEvenSplit && evenSplitEligibleCount > 0
      ? communityDistributionPoolBalance / BigInt(evenSplitEligibleCount)
      : 0n;
  const evenSplitLeftoverAtomic =
    canShowCommunityEvenSplit && evenSplitEligibleCount > 0
      ? communityDistributionPoolBalance % BigInt(evenSplitEligibleCount)
      : 0n;
  const canUseCommunityEvenSplit = canShowCommunityEvenSplit && evenSplitPerNftreeAtomic > 0n;
  const communityDistributionExceedsPool =
    communityRoundAmountAtomic > 0n &&
    selectedDistributionPool?.source === "mainnet" &&
    communityDistributionPoolBalance > 0n &&
    communityRoundAmountAtomic > communityDistributionPoolBalance;
  const fundedCommunityRound = Boolean(selectedDistributionPool && selectedDistributionPool.currentRound > 0n &&
    selectedDistributionPool.perNftreeAmount > 0n && selectedDistributionPool.vaultBalance > 0n);
  const canOpenCommunityRound =
    connected &&
    isAdminWallet &&
    communityDistributionHasConfig &&
    communityRoundAmountAtomic > 0n &&
    communityDistributionPoolBalance > 0n &&
    !communityDistributionExceedsPool && !fundedCommunityRound;

  useEffect(() => {
    if (!account?.address) {
      setSelectedWalletBalance(null);
      setSelectedWalletBalanceLoading(false);
      setSelectedWalletBalanceError("");
      return;
    }

    const controller = new AbortController();
    setSelectedWalletBalanceLoading(true);
    setSelectedWalletBalanceError("");

    fetchWalletCoinBalance(account.address, selectedContributionToken.coinType, controller.signal)
      .then((balance) => {
        if (controller.signal.aborted) return;
        const registryToken = REGISTERED_REWARD_TOKENS.find((token) => token.tokenId === selectedContributionToken.tokenId);
        const formattedBalance =
          selectedContributionToken.tokenId === "sui"
            ? formatSui(balance, 4)
            : `${formatTokenAmount(balance, selectedContributionToken.decimals, 4)} ${selectedContributionToken.symbol}`;
        console.debug("[TreeDrop contribution balance]", {
          symbol: selectedContributionToken.symbol,
          coinType: selectedContributionToken.coinType,
          registryDecimals: registryToken?.decimals,
          metadataDecimals: selectedContributionToken.decimals,
          rawBalance: balance.toString(),
          formattedBalance,
          decimalsSource:
            registryToken && registryToken.decimals !== selectedContributionToken.decimals ? "metadata" : "registry",
        });
        if (registryToken && registryToken.decimals !== selectedContributionToken.decimals) {
          console.warn(`Token decimal mismatch detected for ${selectedContributionToken.symbol}. Using on-chain metadata decimals.`, {
            symbol: selectedContributionToken.symbol,
            coinType: selectedContributionToken.coinType,
            registryDecimals: registryToken.decimals,
            metadataDecimals: selectedContributionToken.decimals,
          });
        }
        setSelectedWalletBalance(balance);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[TreeDrop contribution balance] Wallet balance lookup failed", {
          owner: account.address,
          tokenId: selectedContributionToken.tokenId,
          symbol: selectedContributionToken.symbol,
          coinType: selectedContributionToken.coinType,
          error,
        });
        setSelectedWalletBalance(null);
        setSelectedWalletBalanceError("Balance unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSelectedWalletBalanceLoading(false);
      });

    return () => controller.abort();
  }, [account?.address, balanceRefreshNonce, selectedContributionToken.coinType, selectedContributionToken.symbol, selectedContributionToken.tokenId]);
  const suiDropRewardToken =
    displayRewardTokens.find((token) => token.tokenId === "sui") ||
    REGISTERED_REWARD_TOKENS.find((token) => token.tokenId === "sui") ||
    REGISTERED_REWARD_TOKENS[0]!;
  const communityDropRewardTokens = activeCommunityDropAssets
    .map((communityPool) => communityPool.token)
    .filter((token): token is RegisteredRewardToken => Boolean(token));
  const currentDropRewardAssets = activeRound
    ? [suiDropRewardToken, ...communityDropRewardTokens]
    : [...communityDropRewardTokens];
  const claimUrl = "https://tree-token.xyz/rewards/";
  const telegramAlertAssets = useMemo<TelegramAlertAsset[]>(() => {
    const assets: TelegramAlertAsset[] = [];
    if (activeRound) {
      const isClaimReady = pool.currentRound > 0n && pool.perNftreeMist > 0n && pool.vaultBalance > 0n;
      assets.push({
        tokenId: "sui",
        symbol: "SUI",
        perNftreeLabel: formatSui(pool.perNftreeMist, 4),
        poolBalanceLabel: formatSui(pool.vaultBalance, 4),
        eligibilityLabel: isClaimReady ? "Claim-ready" : "Waiting for funded round",
        isOpen: pool.currentRound > 0n,
        isClaimReady,
      });
    }

    for (const communityPool of activeCommunityDropAssets) {
      const token = communityPool.token || displayRewardTokens.find((item) => item.tokenId === communityPool.tokenId);
      const key = telegramEligibilityRecordKey(communityPool.tokenId, communityPool.currentRound);
      const publishRecord = telegramEligibilityRecords[key];
      const selectedTokenFinalized =
        communityPool.tokenId === selectedDistributionToken?.tokenId &&
        communityPool.currentRound.toString() === eligibilityPublishState.round &&
        (eligibilityPublishState.preflightStatus === "snapshot-finalized" ||
          eligibilityPublishState.preflightStatus === "snapshot-mismatch" ||
          eligibilityPublishState.preflightStatus === "already-published");
      const eligibleCount =
        publishRecord?.eligibleCount ||
        (selectedTokenFinalized
          ? eligibilityPublishState.snapshotFinalizedCount || eligibilityPublishState.eligibleCount || holderSnapshot?.eligibleNFTrees || 0
          : 0);
      const isOpen = communityPool.currentRound > 0n && communityPool.perNftreeAmount > 0n && communityPool.vaultBalance > 0n;
      const isClaimReady = isOpen && eligibleCount > 0;
      assets.push({
        tokenId: communityPool.tokenId,
        symbol: communityPool.symbol,
        perNftreeLabel: token
          ? `${formatTokenAmount(communityPool.perNftreeAmount, token.decimals, 6)} ${communityPool.symbol}`
          : communityPool.perNftreeAmount.toString(),
        poolBalanceLabel: token
          ? `${formatTokenAmount(communityPool.vaultBalance, token.decimals, 4)} ${communityPool.symbol}`
          : communityPool.vaultBalance.toString(),
        eligibilityLabel: isClaimReady
          ? `Claim-ready for ${formatInteger(eligibleCount)} eligible NFTrees`
          : "Eligibility must be published before claim-live alerts",
        isOpen,
        isClaimReady,
        warning: isOpen && !isClaimReady ? "Publish eligibility before sending claim-live alert." : undefined,
      });
    }

    return assets;
  }, [
    activeCommunityDropAssets,
    activeRound,
    displayRewardTokens,
    eligibilityPublishState.eligibleCount,
    eligibilityPublishState.preflightStatus,
    eligibilityPublishState.round,
    eligibilityPublishState.snapshotFinalizedCount,
    holderSnapshot?.eligibleNFTrees,
    pool.currentRound,
    pool.perNftreeMist,
    pool.vaultBalance,
    selectedDistributionToken?.tokenId,
    telegramEligibilityRecords,
  ]);
  const telegramClaimReadyAssets = useMemo(
    () => telegramAlertAssets.filter((asset) => asset.isClaimReady),
    [telegramAlertAssets],
  );
  const telegramOpenButNotReadyAssets = useMemo(
    () => telegramAlertAssets.filter((asset) => asset.isOpen && !asset.isClaimReady),
    [telegramAlertAssets],
  );
  useEffect(() => {
    const includedAssets = telegramAlertType === "reward-live" ? telegramClaimReadyAssets : telegramAlertAssets;
    setTelegramMessage(buildTelegramMessage(telegramAlertType, includedAssets, claimUrl));
    setTelegramConfirmationChecked(false);
  }, [claimUrl, telegramAlertAssets, telegramAlertType, telegramClaimReadyAssets]);

  const futureDropRewardTokens = displayRewardTokens.filter(
    (token) => !token.isClaimable && !activeCommunityDropAssets.some((communityPool) => communityPool.tokenId === token.tokenId),
  );
  const selectedNFTreeKey = nftreeObjectId.trim().toLowerCase();
  const claimStatusLoading = suiClaimStatusLoading || communityClaimStatusLoading || communityEligibilityStatusLoading;
  const claimStatusUnavailable = Boolean(suiClaimStatusError || communityClaimStatusError || communityEligibilityStatusError);
  const claimStatusReady =
    connected &&
    !nftreeLoading &&
    !loading &&
    !communityPoolsLoading &&
    !claimStatusLoading &&
    !claimStatusUnavailable;
  const selectedSuiClaimed = activeRound && claimedNFTreeIds.has(selectedNFTreeKey);
  const selectedSuiAssetStatus: AssetClaimabilityStatus = !activeRound
    ? "not eligible"
    : claimStatusLoading
      ? "checking"
      : suiClaimStatusError
        ? "claim status unavailable"
        : selectedSuiClaimed
          ? "already claimed"
          : validNftreeObject && !rewardExcludedWallet
            ? "claimable"
            : "not eligible";
  const communityAssetStatusByTokenId = useMemo(() => {
    const statuses: Record<string, AssetClaimabilityStatus> = {};
    for (const communityPool of activeCommunityDropAssets) {
      const key = selectedNFTreeKey;
      const eligibility = communityEligibilityByTokenId[communityPool.tokenId];
      if (communityClaimStatusLoading || communityEligibilityStatusLoading) {
        statuses[communityPool.tokenId] = "checking";
      } else if (communityClaimStatusError || communityEligibilityStatusError) {
        statuses[communityPool.tokenId] = "claim status unavailable";
      } else if (claimedCommunityNFTreeIds[communityPool.tokenId]?.has(key)) {
        statuses[communityPool.tokenId] = "already claimed";
      } else if (!eligibility) {
        statuses[communityPool.tokenId] = "eligibility unknown";
      } else if (eligibility.eligibleNFTreeIds.has(key)) {
        statuses[communityPool.tokenId] = "claimable";
      } else {
        statuses[communityPool.tokenId] = "not eligible";
      }
    }
    if (activeCommunityDropAssets.length) {
      console.info("[TreeDrop claimability] selected NFTree asset statuses", {
        selectedNFTreeId: selectedNFTreeKey,
        connectedWallet: connectedAddress,
        activeAssets: activeCommunityDropAssets.map((communityPool) => ({
          tokenId: communityPool.tokenId,
          symbol: communityPool.symbol,
          currentRound: communityPool.currentRound.toString(),
          eligibilityRegistryObjectId: communityPool.eligibilityRegistryObjectId,
          claimedTableId: communityPool.claimedTableId,
          status: statuses[communityPool.tokenId],
          eligibilityOwner:
            communityEligibilityByTokenId[communityPool.tokenId]?.ownerMismatchByNFTreeId[selectedNFTreeKey],
        })),
      });
    }
    return statuses;
  }, [
    activeCommunityDropAssets,
    claimedCommunityNFTreeIds,
    communityClaimStatusError,
    communityClaimStatusLoading,
    communityEligibilityByTokenId,
    communityEligibilityStatusError,
    communityEligibilityStatusLoading,
    connectedAddress,
    selectedNFTreeKey,
  ]);
  const selectedClaimableCommunityPools = activeCommunityDropAssets.filter(
    (communityPool) => communityAssetStatusByTokenId[communityPool.tokenId] === "claimable",
  );
  const selectedActiveAssetStatuses = [
    ...(activeRound ? [selectedSuiAssetStatus] : []),
    ...activeCommunityDropAssets.map((communityPool) => communityAssetStatusByTokenId[communityPool.tokenId]),
  ].filter(Boolean) as AssetClaimabilityStatus[];
  const selectedAllActiveAssetsClaimed =
    claimStatusReady &&
    selectedActiveAssetStatuses.length > 0 &&
    selectedActiveAssetStatuses.every((status) => status === "already claimed");
  const selectedHasNotEligibleAssets = selectedActiveAssetStatuses.some((status) => status === "not eligible");
  const selectedHasClaimableReward =
    claimStatusReady &&
    !rewardExcludedWallet &&
    validNftreeObject &&
    (selectedSuiAssetStatus === "claimable" || selectedClaimableCommunityPools.length > 0);
  const selectedNFTreeClaimed =
    claimStatusReady &&
    !rewardExcludedWallet &&
    validNftreeObject &&
    currentDropRewardAssets.length > 0 &&
    selectedAllActiveAssetsClaimed;
  const nftreeHasClaimableReward = useCallback(
    (objectId: string) => {
      if (!claimStatusReady || rewardExcludedWallet) return false;
      const key = objectId.toLowerCase();
      if (activeRound && !claimedNFTreeIds.has(key)) return true;
      return activeCommunityDropAssets.some((communityPool) => {
        if (claimedCommunityNFTreeIds[communityPool.tokenId]?.has(key)) return false;
        return communityEligibilityByTokenId[communityPool.tokenId]?.eligibleNFTreeIds.has(key) || false;
      });
    },
    [
      activeCommunityDropAssets,
      activeRound,
      claimStatusReady,
      claimedCommunityNFTreeIds,
      claimedNFTreeIds,
      communityEligibilityByTokenId,
      rewardExcludedWallet,
    ],
  );
  const nftreeHasClaimedEveryActiveAsset = useCallback(
    (objectId: string) => {
      if (!claimStatusReady || rewardExcludedWallet) return false;
      const key = objectId.toLowerCase();
      const statuses: AssetClaimabilityStatus[] = [];
      if (activeRound) statuses.push(claimedNFTreeIds.has(key) ? "already claimed" : "claimable");
      for (const communityPool of activeCommunityDropAssets) {
        if (claimedCommunityNFTreeIds[communityPool.tokenId]?.has(key)) {
          statuses.push("already claimed");
        } else if (communityEligibilityByTokenId[communityPool.tokenId]?.eligibleNFTreeIds.has(key)) {
          statuses.push("claimable");
        } else {
          statuses.push("not eligible");
        }
      }
      return statuses.length > 0 && statuses.every((status) => status === "already claimed");
    },
    [
      activeCommunityDropAssets,
      activeRound,
      claimStatusReady,
      claimedCommunityNFTreeIds,
      claimedNFTreeIds,
      communityEligibilityByTokenId,
      rewardExcludedWallet,
    ],
  );
  const eligibleClaimableNFTrees = filterRewardEligibleNFTrees(
    ownedNFTrees.filter((nftree) => isSuiAddress(nftree.objectId) && nftreeHasClaimableReward(nftree.objectId)),
    connectedAddress,
  );
  const rewardEligibleDetectedNFTrees = filterRewardEligibleNFTrees(
    ownedNFTrees.filter((nftree) => isSuiAddress(nftree.objectId)),
    connectedAddress,
  );
  const allDetectedNFTreesClaimed =
    claimStatusReady &&
    currentDropRewardAssets.length > 0 &&
    rewardEligibleDetectedNFTrees.length > 0 &&
    rewardEligibleDetectedNFTrees.every((nftree) => nftreeHasClaimedEveryActiveAsset(nftree.objectId));
  const detectedNFTreeCount = ownedNFTrees.length;
  const eligibleNFTreeCount = eligibleClaimableNFTrees.length;
  const canFund =
    connected &&
    fundAmountAtomic > 0n &&
    !selectedWalletBalanceLoading &&
    !selectedWalletBalanceError &&
    selectedWalletBalance !== null &&
    !contributionAmountExceedsBalance &&
    (selectedContributionIsLiveSui || selectedContributionIsConfiguredCommunityToken);
  const fundedSuiRound = pool.source === "mainnet" && pool.currentRound > 0n && pool.perNftreeMist > 0n && pool.vaultBalance > 0n;
  const canOpenRound = connected && isAdminWallet && roundHasFunds && !fundedSuiRound;
  const canClaim =
    claimStatusReady &&
    connected &&
    !rewardExcludedWallet &&
    validNftreeObject &&
    selectedHasClaimableReward &&
    !selectedNFTreeClaimed &&
    !claimAllActive;
  const canClaimAll =
    claimStatusReady &&
    connected &&
    !rewardExcludedWallet &&
    currentDropRewardAssets.length > 0 &&
    eligibleNFTreeCount >= 2 &&
    !claimAllActive;
  const claimCountLabel =
    connected && detectedNFTreeCount
      ? rewardExcludedWallet || (claimStatusReady && currentDropRewardAssets.length > 0)
        ? `${eligibleNFTreeCount} eligible / ${detectedNFTreeCount} detected`
        : `${detectedNFTreeCount} detected`
      : "";
  const connectedWalletLabel = connected ? shortId(connectedAddress) : "Not connected";
  const walletRole = !connected ? "Choose wallet" : isAdminWallet ? "Project/operator wallet" : "NFTree holder wallet";
  const claimWasSuccessful = txStatus.tone === "success" && txStatus.label === "Claim submitted";
  const claimAllWasSuccessful = txStatus.tone === "success" && txStatus.label === "All eligible rewards submitted";
  const claimFailed = txStatus.tone === "error" && txStatus.label.toLowerCase().includes("claim");
  const alreadyClaimed =
    selectedNFTreeClaimed ||
    (txStatus.tone === "error" && txStatus.label === "Rewards already claimed for this distribution");
  const checkingClaim = nftreeLoading || claimStatusLoading || (connected && (loading || communityPoolsLoading));
  const claimState = !connected
    ? {
        tone: "idle",
        label: "Connect your wallet",
        detail: "Choose the wallet that holds your NFTree. TreeDrop will look for your NFTree automatically.",
      }
    : rewardExcludedWallet
      ? {
          tone: "idle",
          label: "Project wallet excluded from reward eligibility",
          detail:
            "This wallet is reserved for project operations and does not qualify for NFTree holder reward distributions.",
        }
    : checkingClaim
      ? {
          tone: "pending",
          label: "Checking claim status",
          detail: "TreeDrop is checking your NFTrees and reading which reward assets are already claimed.",
        }
    : claimStatusUnavailable
      ? {
          tone: "error",
          label: "Claim status unavailable",
          detail: `${suiClaimStatusError || communityClaimStatusError || communityEligibilityStatusError} Refresh or try again before claiming.`,
        }
        : claimAllWasSuccessful
          ? {
              tone: "success",
              label: "Claim complete",
              detail: "All eligible NFTree rewards have been submitted.",
            }
        : claimWasSuccessful
        ? {
            tone: "success",
            label: "Claim submitted",
            detail: "Your reward claim was submitted. This NFTree cannot claim this distribution again.",
          }
        : alreadyClaimed
          ? {
              tone: "success",
              label: "Rewards already claimed for this distribution",
              detail:
                "This NFTree has already claimed every active reward asset in the current distribution. Check back when the next distribution opens.",
            }
          : claimStatusReady && currentDropRewardAssets.length > 0 && !selectedHasClaimableReward && selectedHasNotEligibleAssets
            ? {
                tone: "idle",
                label: "No claimable rewards for this NFTree",
                detail: "This NFTree is not eligible for one or more active reward assets in the current distribution.",
              }
          : claimFailed
            ? {
                tone: "error",
                label: "Claim failed",
                detail: "The wallet could not submit this claim. Try another detected NFTree or check the message below.",
              }
            : !ownedNFTrees.length
              ? {
                  tone: "error",
                  label: "No NFTree found",
                  detail: "This wallet does not currently show an NFTree. Connect the wallet that holds your NFTree.",
                }
              : currentDropRewardAssets.length === 0
                ? {
                    tone: "idle",
                    label: "No reward ready",
                    detail: "Your NFTree was found, but there is no active reward drop to claim right now.",
                  }
                : {
                    tone: "success",
                    label: "Reward available",
                    detail: `${eligibleNFTreeCount} eligible NFTree${eligibleNFTreeCount === 1 ? "" : "s"} found for the current drop.`,
                  };
  const nextStep = !connected
    ? {
        label: "Connect wallet",
        detail: "TreeDrop checks rewards from the wallet that holds your NFTree.",
      }
    : !isAdminWallet
      ? {
          label: activeRound ? "Check reward" : "No active drop",
          detail: activeRound ? "Select your NFTree and claim if eligible." : "Your NFTree can claim when the next drop opens.",
        }
      : !activeRound && pool.vaultBalance > 0n
        ? {
          label: "Open the next round",
            detail: `Project wallet connected. The pool has ${formatSui(pool.vaultBalance)} available.`,
          }
        : activeRound
          ? {
              label: "Round is claimable",
              detail: `NFTree holders can claim ${formatSui(pool.perNftreeMist, 4)} each.`,
            }
          : {
              label: "Fund before opening",
              detail: "Add SUI to the pool, then open a distribution from the project wallet.",
            };
  const openRoundLabel = !connected
    ? "Connect project wallet"
    : !isAdminWallet
      ? "Project wallet required"
      : fundedSuiRound
        ? "Existing round still holds funds"
        : !roundHasFunds
        ? "Fund pool first"
        : `Open distribution at ${formatSui(roundAmountMist, 4)}`;
  const openCommunityRoundLabel = !selectedDistributionToken
    ? "Select a community token"
    : !communityDistributionHasConfig
      ? "Missing project configuration"
      : fundedCommunityRound
        ? "Existing round still holds funds"
        : communityRoundAmountAtomic <= 0n
        ? "Enter reward amount"
        : communityDistributionPoolBalance <= 0n
          ? "Fund pool first"
          : communityDistributionExceedsPool
            ? "Amount exceeds pool balance"
            : `Open ${selectedDistributionToken.symbol} Distribution`;
  const selectedWorkflowToken = distributionType === "sui" ? displayRewardTokens.find((token) => token.tokenId === "sui") : selectedDistributionToken;
  const communityDistributionOpen =
    Boolean(selectedDistributionPool?.source === "mainnet" && selectedDistributionPool.currentRound > 0n && selectedDistributionPool.perNftreeAmount > 0n);
  const communityDistributionRound = selectedDistributionPool?.source === "mainnet" ? selectedDistributionPool.currentRound.toString() : "";
  const communitySnapshotUnresolvedCount = holderSnapshot?.unresolvedNFTrees || holderSnapshot?.unresolved.length || 0;
  const communityEligibilityMatchesSelectedRound =
    eligibilityPublishState.tokenId === selectedDistributionToken?.tokenId &&
    eligibilityPublishState.round === communityDistributionRound;
  const communityEligibilityFinalized =
    communityEligibilityMatchesSelectedRound &&
    (eligibilityPublishState.preflightStatus === "snapshot-finalized" ||
      eligibilityPublishState.preflightStatus === "snapshot-mismatch" ||
      eligibilityPublishState.preflightStatus === "already-published");
  const communityEligibilityBlocked =
    communityEligibilityMatchesSelectedRound &&
    (eligibilityPublishState.preflightStatus === "owner-mismatch" || eligibilityPublishState.preflightStatus === "unavailable");
  const communityEligibilityPartial =
    communityEligibilityMatchesSelectedRound && eligibilityPublishState.preflightStatus === "partially-published";
  const communityEligibleCount =
    (communityEligibilityFinalized
      ? eligibilityPublishState.snapshotFinalizedCount || eligibilityPublishState.eligibleCount || holderSnapshot?.eligibleNFTrees
      : holderSnapshot?.eligibleNFTrees) || 0;
  const workflowSuiClaimReady = activeRound && pool.perNftreeMist > 0n && pool.vaultBalance > 0n;
  const workflowCommunityClaimReady = Boolean(
    selectedDistributionToken &&
      communityDistributionPoolBalance > 0n &&
      communityDistributionOpen &&
      communityEligibilityFinalized &&
      communityEligibleCount > 0,
  );
  const workflowPoolBalanceLabel = distributionType === "sui"
    ? formatSui(pool.vaultBalance, 4)
    : selectedDistributionToken
      ? `${formatTokenAmount(communityDistributionPoolBalance, selectedDistributionToken.decimals, 4)} ${selectedDistributionToken.symbol}`
      : "--";
  const workflowRoundLabel = distributionType === "sui"
    ? (activeRound ? "Open" : "Not open")
    : selectedDistributionPool?.source === "mainnet"
      ? selectedDistributionPool.currentRound.toString()
      : "Unavailable";
  const workflowRewardPerNftreeLabel = distributionType === "sui"
    ? formatSui(pool.perNftreeMist, 4)
    : selectedDistributionToken && selectedDistributionPool?.source === "mainnet"
      ? `${formatTokenAmount(selectedDistributionPool.perNftreeAmount, selectedDistributionToken.decimals, 6)} ${selectedDistributionToken.symbol}`
      : "--";
  const workflowEligibilityStatus = distributionType === "sui"
    ? "Not required for SUI"
    : communityEligibilityFinalized
      ? "Eligibility finalized"
      : communityEligibilityPartial
        ? "Partially published"
        : communityEligibilityBlocked
          ? "Blocked"
          : communityDistributionOpen && holderSnapshot
            ? "Waiting on eligibility"
            : "Waiting";
  const workflowClaimReady = distributionType === "sui"
    ? workflowSuiClaimReady
    : workflowCommunityClaimReady;
  const workflowAlertStatus = workflowClaimReady ? "Needs action" : "Blocked";
  const workflowNextAction: RewardWizardStep = distributionType === "sui"
    ? pool.vaultBalance <= 0n
      ? {
          label: "Fund Pool",
          status: "Needs action",
          detail: "Add SUI before opening a distribution.",
          actionLabel: "Fund SUI pool",
          targetId: "community-pool",
        }
      : !activeRound || pool.perNftreeMist <= 0n
        ? {
            label: "Open Distribution",
            status: "Needs action",
            detail: "Set the SUI reward per NFTree and open the round from the project wallet.",
            actionLabel: "Open SUI distribution",
            targetId: "round",
          }
        : workflowSuiClaimReady
          ? {
              label: "Alert Holders",
              status: "Needs action",
              detail: "The SUI distribution is claim-ready. Send the live alert or monitor claims.",
              actionLabel: "Send claim-ready Telegram alert",
              targetId: "telegram-alerts",
            }
          : {
              label: "Monitor Claims",
              status: "Monitor claims",
              detail: "No action required.",
              actionLabel: "Monitor claims",
              targetId: "drop-details",
            }
    : !selectedDistributionToken
      ? {
          label: "Select Token",
          status: "Needs action",
          detail: "Choose the community token for this distribution.",
          actionLabel: "Select token",
          targetId: "project-tools",
        }
      : communityDistributionPoolBalance <= 0n
        ? {
            label: "Fund Pool",
            status: "Needs action",
            detail: `Add ${selectedDistributionToken.symbol} before opening a distribution.`,
            actionLabel: `Fund ${selectedDistributionToken.symbol} pool`,
            targetId: "community-pool",
          }
        : !communityDistributionOpen
          ? {
              label: "Open Distribution",
              status: "Needs action",
              detail: `Set the ${selectedDistributionToken.symbol} reward per NFTree and open the round.`,
              actionLabel: `Open ${selectedDistributionToken.symbol} distribution`,
              targetId: "round",
            }
          : !holderSnapshot
            ? {
                label: "Holder Snapshot",
                status: "Needs action",
                detail: "Refresh or import a holder snapshot before publishing eligibility.",
                actionLabel: "Refresh holder snapshot",
                targetId: "holder-snapshot",
                actionKey: "refresh-snapshot",
              }
            : communitySnapshotUnresolvedCount > 0
              ? {
                  label: "Resolve Owners",
                  status: "Warning",
                  detail: "Unresolved owners are excluded unless resolved.",
                  actionLabel: "Resolve unresolved owners",
                  targetId: "holder-snapshot",
                }
              : communityEligibilityBlocked
                ? {
                    label: "Publish Eligibility",
                    status: "Blocked",
                    detail: "Review the eligibility preflight issue before publishing.",
                    actionLabel: "Review eligibility issue",
                    targetId: "holder-snapshot",
                  }
                : !communityEligibilityFinalized
                  ? {
                      label: "Publish Eligibility",
                      status: "Needs action",
                      detail: communityEligibilityPartial
                        ? "Publish the missing eligibility rows for this round."
                        : "Publish the finalized holder snapshot to the eligibility registry.",
                      actionLabel: communityEligibilityPartial
                        ? `Publish missing ${selectedDistributionToken.symbol} eligibility`
                        : `Publish ${selectedDistributionToken.symbol} eligibility`,
                      targetId: "holder-snapshot",
                      actionKey: "check-eligibility",
                    }
                  : workflowCommunityClaimReady
                    ? {
                        label: "Alert Holders",
                        status: "Needs action",
                        detail: `${selectedDistributionToken.symbol} is claim-ready for ${formatInteger(communityEligibleCount)} eligible NFTrees.`,
                        actionLabel: "Send claim-ready Telegram alert",
                        targetId: "telegram-alerts",
                      }
                    : {
                        label: "Monitor Claims",
                        status: "Monitor claims",
                        detail: "No action required.",
                        actionLabel: "Monitor claims",
                        targetId: "drop-details",
                      };
  const workflowNextStep = workflowNextAction.actionLabel || "No action required";
  const workflowSteps: RewardWizardStep[] = distributionType === "sui"
    ? [
        {
          label: "Select SUI RewardPool",
          status: "Complete",
          detail: "SUI RewardPool is selected.",
          actionLabel: "Review SUI RewardPool",
          targetId: "project-tools",
        },
        {
          label: "Fund Pool",
          status: pool.vaultBalance > 0n ? "Complete" : "Needs action",
          detail: pool.vaultBalance > 0n ? "SUI pool has a balance." : "Add SUI before opening a distribution.",
          actionLabel: "Fund SUI pool",
          targetId: "community-pool",
        },
        {
          label: "Open Distribution",
          status: activeRound && pool.perNftreeMist > 0n ? "Complete" : pool.vaultBalance > 0n ? "Needs action" : "Blocked",
          detail: activeRound && pool.perNftreeMist > 0n
            ? "SUI distribution is open."
            : "Open a funded SUI round with reward per NFTree.",
          actionLabel: "Open SUI distribution",
          targetId: "round",
          disabledReason: pool.vaultBalance <= 0n ? "Fund SUI pool first." : undefined,
        },
        {
          label: "Claim Ready",
          status: workflowSuiClaimReady ? "Claim-ready" : "Waiting",
          detail: workflowSuiClaimReady
            ? "NFTree ownership is checked at claim time."
            : "SUI requires a funded open round with reward per NFTree.",
        },
        {
          label: "Alert Holders",
          status: workflowSuiClaimReady ? "Needs action" : "Blocked",
          detail: workflowSuiClaimReady
            ? "Reward Distribution Live alert can be sent."
            : "SUI must be claim-ready before a live alert.",
          actionLabel: "Send claim-ready Telegram alert",
          targetId: "telegram-alerts",
          disabledReason: workflowSuiClaimReady ? undefined : "SUI distribution is not claim-ready.",
        },
        {
          label: "Monitor Claims",
          status: activeRound ? "Monitor claims" : "Waiting",
          detail: activeRound ? `${formatInteger(pool.totalClaims)} SUI claims recorded.` : "Monitoring starts after a round opens.",
          actionLabel: "Monitor claims",
          targetId: "drop-details",
        },
      ]
    : [
        {
          label: "Select Token",
          status: selectedDistributionToken ? "Complete" : "Needs action",
          detail: selectedDistributionToken
            ? `${selectedDistributionToken.symbol} is selected.`
            : "Choose a configured community token.",
          actionLabel: "Select token",
          targetId: "project-tools",
        },
        {
          label: "Fund Pool",
          status: communityDistributionPoolBalance > 0n ? "Complete" : "Needs action",
          detail: selectedDistributionToken
            ? communityDistributionPoolBalance > 0n
              ? `${selectedDistributionToken.symbol} pool is funded.`
              : `Add ${selectedDistributionToken.symbol} before opening a distribution.`
            : "Select a token before funding.",
          actionLabel: selectedDistributionToken ? `Fund ${selectedDistributionToken.symbol} pool` : "Fund pool",
          targetId: "community-pool",
        },
        {
          label: "Open Distribution",
          status: communityDistributionOpen ? "Complete" : communityDistributionPoolBalance > 0n ? "Needs action" : "Blocked",
          detail: communityDistributionOpen
            ? `${selectedDistributionToken?.symbol || "Token"} round ${workflowRoundLabel} is open.`
            : "Open the token distribution after funding the pool.",
          actionLabel: selectedDistributionToken ? `Open ${selectedDistributionToken.symbol} distribution` : "Open distribution",
          targetId: "round",
          disabledReason: communityDistributionPoolBalance <= 0n ? "Fund the selected pool first." : undefined,
        },
        {
          label: "Holder Snapshot",
          status: holderSnapshot ? "Complete" : communityDistributionOpen ? "Needs action" : "Waiting",
          detail: holderSnapshot
            ? `${formatInteger(holderSnapshot.eligibleNFTrees)} eligible NFTrees in the current snapshot.`
            : "Refresh or import a holder snapshot after opening the distribution.",
          actionLabel: "Refresh holder snapshot",
          targetId: "holder-snapshot",
          actionKey: "refresh-snapshot",
          disabledReason: communityDistributionOpen ? undefined : "Open a distribution first.",
        },
        {
          label: "Resolve Owners",
          status: !holderSnapshot ? "Waiting" : communitySnapshotUnresolvedCount > 0 ? "Warning" : "Complete",
          detail: !holderSnapshot
            ? "Owner resolution starts after a holder snapshot exists."
            : communitySnapshotUnresolvedCount > 0
              ? `${formatInteger(communitySnapshotUnresolvedCount)} unresolved owners are excluded unless resolved.`
              : "No unresolved owners remain.",
          actionLabel: "Resolve unresolved owners",
          targetId: "holder-snapshot",
        },
        {
          label: "Publish Eligibility",
          status: communityEligibilityFinalized
            ? "Complete"
            : !holderSnapshot
              ? "Blocked"
              : communityEligibilityBlocked
                ? "Blocked"
                : "Needs action",
          detail: communityEligibilityFinalized
            ? `Eligibility snapshot finalized for ${selectedDistributionToken?.symbol || "token"} round ${workflowRoundLabel}.`
            : !holderSnapshot
              ? "Holder snapshot is required before publishing eligibility."
              : communityEligibilityBlocked
                ? "Eligibility preflight found an owner mismatch or unavailable read."
                : "Publish eligibility before holders can claim this community token.",
          actionLabel: selectedDistributionToken ? `Publish ${selectedDistributionToken.symbol} eligibility` : "Publish eligibility",
          targetId: "holder-snapshot",
          actionKey: "check-eligibility",
          disabledReason: communityEligibilityFinalized
            ? "Eligibility is already finalized for this round."
            : !holderSnapshot
              ? "Refresh or import a holder snapshot first."
              : communityEligibilityBlocked
                ? "Resolve the preflight issue first."
                : undefined,
        },
        {
          label: "Claim Ready",
          status: workflowCommunityClaimReady ? "Claim-ready" : "Waiting",
          detail: workflowCommunityClaimReady
            ? `${selectedDistributionToken?.symbol || "Token"} is claim-ready.`
            : "Community token claims require funding, an open round, finalized eligibility, and eligible NFTrees.",
        },
        {
          label: "Alert Holders",
          status: workflowAlertStatus,
          detail: workflowCommunityClaimReady
            ? "Reward Distribution Live alert can be sent."
            : "Publish eligibility before sending claim-live alert.",
          actionLabel: "Send claim-ready Telegram alert",
          targetId: "telegram-alerts",
          disabledReason: workflowCommunityClaimReady ? undefined : "Selected community token is not claim-ready.",
        },
        {
          label: "Monitor Claims",
          status: communityDistributionOpen ? "Monitor claims" : "Waiting",
          detail: communityDistributionOpen
            ? `${formatInteger(selectedDistributionPool?.totalClaims || 0n)} ${selectedDistributionToken?.symbol || "token"} claims recorded.`
            : "Monitoring starts after the distribution opens.",
          actionLabel: "Monitor claims",
          targetId: "drop-details",
        },
      ];
  const claimLabel = !connected
    ? "Connect wallet first"
    : rewardExcludedWallet
      ? "Rewards not available for this wallet"
    : checkingClaim
      ? "Checking claim status"
    : claimStatusUnavailable
      ? "Refresh claim status"
    : currentDropRewardAssets.length === 0
      ? "No reward drop open"
    : selectedNFTreeClaimed
        ? "Rewards already claimed"
    : !selectedHasClaimableReward && claimStatusReady
      ? "No claimable rewards"
        : !validNftreeObject
      ? "Select NFTree"
        : currentDropRewardAssets.length > 1
          ? "Claim Current Drop Rewards"
          : currentDropRewardAssets[0]?.tokenId === "sui"
            ? `Claim ${formatSui(pool.perNftreeMist, 4)} reward`
            : `Claim ${currentDropRewardAssets[0]?.symbol || "reward"}`;
  const connectLabel = connection.isConnecting
    ? "Connecting"
    : wallet
      ? `${wallet.name}: ${shortId(account?.address || "")}`
      : wallets.length
        ? "Choose wallet"
        : "No Sui wallet found";

  useEffect(() => {
    if (wallet) setWalletPickerOpen(false);
  }, [wallet]);

  const execute = useCallback(
    async (label: string, transactionFactory: () => ReturnType<typeof buildFundPoolTransaction>) => {
      setTxStatus({ label, detail: "Waiting for wallet signature.", tone: "pending" });
      try {
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: transactionFactory(),
          network: CONFIG.network,
        });
        const digest = resultDigest(result);
        setTxStatus({
          label: "Transaction submitted",
          detail: digest ? `Digest: ${digest}` : "Wallet returned success.",
          digest,
          tone: "success",
        });
        void refresh();
      } catch (error) {
        setTxStatus(statusFromError(error, label));
      }
    },
    [dAppKit, refresh],
  );

  const submitClaim = useCallback(
    async (objectId: string, label = "Claim reward") => {
      setTxStatus({ label, detail: "Waiting for wallet signature.", tone: "pending" });
      try {
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: buildClaimTransaction(objectId),
          network: CONFIG.network,
        });
        const digest = resultDigest(result);
        setClaimedNFTreeIds((current) => new Set(current).add(objectId.toLowerCase()));
        setTxStatus({
          label: "Claim submitted",
          detail: "Your reward claim was submitted. This NFTree cannot claim this distribution again.",
          digest,
          tone: "success",
        });
        void refresh();
        return digest;
      } catch (error) {
        const status = statusFromError(error, label);
        if (status.label === "Rewards already claimed for this distribution") {
          setClaimedNFTreeIds((current) => new Set(current).add(objectId.toLowerCase()));
          void refresh();
        }
        setTxStatus(status);
        throw error;
      }
    },
    [dAppKit, refresh],
  );

  const submitCommunityClaim = useCallback(
    async (communityPool: CommunityTokenPoolState, objectId: string, label = `Claim ${communityPool.symbol} reward`) => {
      const config = findCommunityRewardConfig(communityPool.tokenId);
      if (!config?.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion) {
        throw new Error(`${communityPool.symbol} community token claim config is missing.`);
      }

      setTxStatus({ label, detail: "Waiting for wallet signature.", tone: "pending" });
      try {
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: buildClaimCommunityTokenSnapshotTransaction(config, objectId),
          network: CONFIG.network,
        });
        const digest = resultDigest(result);
        setClaimedCommunityNFTreeIds((current) => ({
          ...current,
          [communityPool.tokenId]: new Set(current[communityPool.tokenId] || []).add(objectId.toLowerCase()),
        }));
        setTxStatus({
          label: "Claim submitted",
          detail: `Your ${communityPool.symbol} reward claim was submitted. This NFTree cannot claim that distribution again.`,
          digest,
          tone: "success",
        });
        void refreshCommunityPools();
        return digest;
      } catch (error) {
        const status = statusFromError(error, label);
        if (status.label === "Rewards already claimed for this distribution") {
          setClaimedCommunityNFTreeIds((current) => ({
            ...current,
            [communityPool.tokenId]: new Set(current[communityPool.tokenId] || []).add(objectId.toLowerCase()),
          }));
          void refreshCommunityPools();
        } else {
          const message = error instanceof Error ? error.message : "";
          if (/eligib|not eligible|dynamic field|not found|does not exist/i.test(message)) {
            setCommunityEligibilityByTokenId((current) => {
              const currentState = current[communityPool.tokenId];
              if (!currentState) return current;
              const nextEligible = new Set(currentState.eligibleNFTreeIds);
              nextEligible.delete(objectId.toLowerCase());
              return {
                ...current,
                [communityPool.tokenId]: {
                  ...currentState,
                  eligibleNFTreeIds: nextEligible,
                },
              };
            });
            setTxStatus({
              label: `${communityPool.symbol} claim failed`,
              detail: `This NFTree is not eligible for ${communityPool.symbol} in the current distribution.`,
              tone: "error",
            });
            throw error;
          }
        }
        setTxStatus(status);
        throw error;
      }
    },
    [dAppKit, refreshCommunityPools],
  );

  const handleFund = useCallback(() => {
    if (!selectedContributionIsLiveSui && !selectedContributionCommunityConfig) {
      setTxStatus({
        tone: "idle",
        label: "Pool setup required",
        detail: isAdminWallet
          ? "Pool setup required before live contributions."
          : "Registered - pool not configured yet. Pool setup is required before live contributions.",
      });
      return;
    }

    if (selectedContributionIsLiveSui) {
      void execute("Fund SUI RewardPool", () => buildFundPoolTransaction(fundAmountMist)).then(() => {
        setBalanceRefreshNonce((current) => current + 1);
      });
      return;
    }

    if (!account?.address || !selectedContributionCommunityConfig) return;

    setTxStatus({
      label: `Fund ${selectedContributionToken.symbol} Community Pool`,
      detail: "Finding token coins in your wallet.",
      tone: "pending",
    });
    void fetchCoinObjectIds(account.address, selectedContributionCommunityConfig.coinType, fundAmountAtomic)
      .then((coinObjectIds) =>
        execute(`Fund ${selectedContributionToken.symbol} Community Pool`, () =>
          buildFundCommunityTokenPoolTransaction(selectedContributionCommunityConfig, fundAmountAtomic, coinObjectIds),
        ),
      )
      .then(() => {
        setBalanceRefreshNonce((current) => current + 1);
        void refreshCommunityPools();
      })
      .catch((error) => {
        setTxStatus(statusFromError(error, `Fund ${selectedContributionToken.symbol} Community Pool`));
      });
  }, [
    account?.address,
    execute,
    fundAmountAtomic,
    fundAmountMist,
    refreshCommunityPools,
    isAdminWallet,
    selectedContributionCommunityConfig,
    selectedContributionIsLiveSui,
    selectedContributionToken.symbol,
  ]);

  const handleOpenRound = useCallback(() => {
    if (!canOpenRound) return;
    void execute("Open round", () => buildOpenRoundTransaction(roundAmountMist));
  }, [canOpenRound, execute, roundAmountMist]);

  const handleOpenCommunityRound = useCallback(() => {
    if (!selectedDistributionConfig || !selectedDistributionToken || !canOpenCommunityRound) return;
    void execute(`Open ${selectedDistributionToken.symbol} Distribution`, () =>
      buildOpenCommunityTokenRoundTransaction(selectedDistributionConfig, communityRoundAmountAtomic),
    ).then(() => {
      void refreshCommunityPools();
    });
  }, [
    canOpenCommunityRound,
    communityRoundAmountAtomic,
    execute,
    refreshCommunityPools,
    selectedDistributionConfig,
    selectedDistributionToken,
  ]);

  const handleUseCommunityEvenSplit = useCallback(() => {
    if (!selectedDistributionToken || evenSplitPerNftreeAtomic <= 0n) return;
    setCommunityRoundAmount(atomicToDecimalInput(evenSplitPerNftreeAtomic, selectedDistributionToken.decimals));
  }, [evenSplitPerNftreeAtomic, selectedDistributionToken]);

  const handleClaim = useCallback(() => {
    const objectId = nftreeObjectId.trim();
    if (rewardExcludedWallet || !objectId || selectedNFTreeClaimed || !selectedHasClaimableReward) return;

    void (async () => {
      const submitted: string[] = [];
      try {
        if (activeRound && !selectedSuiClaimed) {
          await submitClaim(objectId, "Claim SUI reward");
          submitted.push("SUI");
        }

        for (const communityPool of selectedClaimableCommunityPools) {
          await submitCommunityClaim(communityPool, objectId, `Claim ${communityPool.symbol} reward`);
          submitted.push(communityPool.symbol);
        }

        if (submitted.length > 1) {
          setTxStatus({
            label: "Claim submitted",
            detail: `Submitted ${submitted.join(", ")} reward claims for this NFTree.`,
            tone: "success",
          });
        }
      } catch {
        // Each submit helper has already set a specific user-facing error.
      }
    })();
  }, [
    activeRound,
    nftreeObjectId,
    rewardExcludedWallet,
    selectedClaimableCommunityPools,
    selectedHasClaimableReward,
    selectedNFTreeClaimed,
    selectedSuiClaimed,
    submitClaim,
    submitCommunityClaim,
  ]);

  const handleClaimAll = useCallback(async () => {
    if (rewardExcludedWallet) return;
    const claimableNFTrees = eligibleClaimableNFTrees;
    if (claimableNFTrees.length <= 1) return;

    setClaimAllActive(true);
    setClaimAllProgress(`Claiming 1 of ${claimableNFTrees.length}`);
    try {
      for (let index = 0; index < claimableNFTrees.length; index += 1) {
        const nftree = claimableNFTrees[index];
        setClaimAllProgress(`Claiming ${index + 1} of ${claimableNFTrees.length}`);
        try {
          const nftreeKey = nftree.objectId.toLowerCase();
          if (activeRound && !claimedNFTreeIds.has(nftreeKey)) {
            await submitClaim(nftree.objectId, `Claiming SUI for ${index + 1} of ${claimableNFTrees.length}`);
          }
          for (const communityPool of activeCommunityDropAssets) {
            if (claimedCommunityNFTreeIds[communityPool.tokenId]?.has(nftreeKey)) continue;
            if (!communityEligibilityByTokenId[communityPool.tokenId]?.eligibleNFTreeIds.has(nftreeKey)) continue;
            await submitCommunityClaim(
              communityPool,
              nftree.objectId,
              `Claiming ${communityPool.symbol} for ${index + 1} of ${claimableNFTrees.length}`,
            );
          }
        } catch {
          setClaimAllProgress("");
          setTxStatus((current) => ({
            ...current,
            label:
              current.label === "Rewards already claimed for this distribution" ? current.label : "Claim All stopped",
            detail:
              current.label === "Rewards already claimed for this distribution"
                ? `NFTree ${shortId(nftree.objectId)} has already claimed every active reward asset in this distribution. The remaining NFTrees were not submitted.`
                : `Claim failed for NFTree ${shortId(nftree.objectId)}. The remaining NFTrees were not submitted.`,
            tone: "error",
          }));
          return;
        }
      }

      setClaimAllProgress("");
      setTxStatus({
        label: "All eligible rewards submitted",
        detail: "All eligible NFTree rewards have been submitted.",
        tone: "success",
      });
      void refresh();
      void refreshCommunityPools();
    } finally {
      setClaimAllActive(false);
    }
  }, [
    activeCommunityDropAssets,
    activeRound,
    claimedCommunityNFTreeIds,
    claimedNFTreeIds,
    communityEligibilityByTokenId,
    eligibleClaimableNFTrees,
    rewardExcludedWallet,
    refresh,
    refreshCommunityPools,
    submitClaim,
    submitCommunityClaim,
  ]);

  const telegramRewardLiveBlocked =
    telegramAlertType === "reward-live" && telegramClaimReadyAssets.length === 0;
  const telegramPoolFundedBlocked = telegramAlertType === "pool-funded" && telegramAlertAssets.length === 0;
  const telegramPhotoCaptionTooLong = Boolean(telegramImageUrl.trim() && telegramMessage.length > 1024);
  const telegramConfirmationDisabled = Boolean(
    !showAdminTools ||
      telegramServiceStatus.isChecking ||
      !telegramServiceStatus.isConfigured ||
      !telegramMessage.trim() ||
      telegramRewardLiveBlocked ||
      telegramPoolFundedBlocked ||
      telegramPhotoCaptionTooLong,
  );
  const telegramConfirmationStatusText = !showAdminTools
    ? "Connect the authorized project wallet to prepare Telegram alerts."
    : telegramServiceStatus.isChecking
      ? "Checking Telegram service configuration."
      : !telegramServiceStatus.isConfigured
        ? "Telegram service is not configured."
        : !telegramMessage.trim()
          ? "Message text is required before confirming."
          : telegramPhotoCaptionTooLong
            ? "Telegram photo captions must be 1,024 characters or fewer."
            : telegramRewardLiveBlocked
              ? "This alert type is blocked until rewards are claim-ready. Publish eligibility first."
              : telegramPoolFundedBlocked
                ? "Community Pool Funded alerts need at least one active reward asset."
                : "Ready to confirm alert.";
  const canSendTelegramAlert = Boolean(
    TELEGRAM_ALERTS_ENABLED && showAdminTools &&
      telegramServiceStatus.isConfigured &&
      !telegramServiceStatus.isChecking &&
      telegramConfirmationChecked &&
      telegramMessage.trim() &&
      !telegramConfirmationDisabled,
  );

  const sendTelegramAlert = useCallback(async () => {
    if (!canSendTelegramAlert) return;
    const includedAssets = telegramAlertType === "reward-live" ? telegramClaimReadyAssets : telegramAlertAssets;
    const assetSymbols = includedAssets.map((asset) => asset.symbol);
    const photo = telegramImageUrl.trim();
    setTelegramSendStatus({
      label: "Sending Telegram alert",
      detail: "Sending the alert through the protected Netlify Function.",
      tone: "pending",
    });

    try {
      const response = await fetch("/.netlify/functions/send-telegram-alert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alertType: telegramAlertType,
          message: telegramMessage,
          photo: photo || undefined,
          assets: assetSymbols,
          claimUrl,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; sentAt?: string };
      if (!response.ok) throw new Error(payload.error || "Telegram alert failed.");
      const sentAt = payload.sentAt || new Date().toISOString();
      setTelegramAlertHistory((current) => [
        {
          id: `${telegramAlertType}-${sentAt}`,
          alertType: telegramAlertType,
          sentAt,
          assets: assetSymbols,
          status: "sent" as const,
        },
        ...current,
      ].slice(0, 8));
      setTelegramConfirmationChecked(false);
      setTelegramSendStatus({
        label: "Telegram alert sent",
        detail: `Sent ${telegramAlertTypeLabel(telegramAlertType)} alert${assetSymbols.length ? ` for ${assetSymbols.join(", ")}` : ""}${photo ? " with image." : "."}`,
        tone: "success",
      });
    } catch (error) {
      const sentAt = new Date().toISOString();
      setTelegramAlertHistory((current) => [
        {
          id: `${telegramAlertType}-${sentAt}`,
          alertType: telegramAlertType,
          sentAt,
          assets: assetSymbols,
          status: "failed" as const,
        },
        ...current,
      ].slice(0, 8));
      setTelegramSendStatus({
        label: "Telegram alert failed",
        detail: error instanceof Error ? error.message : "Telegram alert could not be sent.",
        tone: "error",
      });
    }
  }, [
    canSendTelegramAlert,
    claimUrl,
    telegramAlertAssets,
    telegramAlertType,
    telegramClaimReadyAssets,
    telegramImageUrl,
    telegramMessage,
  ]);

  const copy = useCallback((value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    setTxStatus({ label: `${label} copied`, detail: value, tone: "success" });
  }, []);

  const snapshotJson = useMemo(() => (holderSnapshot ? JSON.stringify(holderSnapshot, null, 2) : ""), [holderSnapshot]);

  const refreshHolderSnapshot = useCallback(async () => {
    if (!showAdminTools) return;
    setHolderSnapshotLoading(true);
    setHolderSnapshotError("");
    setHolderSnapshotSource("indexer-graphql");
    setTxStatus({
      label: "Refreshing holder snapshot",
      detail: "Reading current NFTree holders from the automatic snapshot source.",
      tone: "pending",
    });

    try {
      const snapshot = await fetchHolderSnapshot({
        excludedWallets: REWARD_EXCLUDED_WALLET_ADDRESSES,
      });
      setHolderSnapshot(snapshot);
      setHolderSnapshotSource(snapshot.source);
      setHolderSnapshotCutoffTime(toLocalDateTimeInputValue(new Date(snapshot.snapshotTime)));
      setTxStatus({
        label: "Holder snapshot ready",
        detail: `${formatInteger(snapshot.eligibleNFTrees)} eligible NFTrees across ${formatInteger(
          snapshot.eligibleHolderWallets,
        )} holder wallets.`,
        tone: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Holder snapshot could not be loaded from the current RPC endpoint.";
      const isUnavailable = /snapshot data source unavailable|method not found/i.test(message);
      setHolderSnapshotSource("unavailable");
      setHolderSnapshotError(
        isUnavailable
          ? "Snapshot data source unavailable. This snapshot source could not query all NFTrees by type. Use a supported indexer, GraphQL endpoint, or manual snapshot import."
          : `${message} Use manual snapshot import if the automatic source cannot query all NFTrees by type.`,
      );
      setTxStatus({
        label: "Holder snapshot unavailable",
        detail: isUnavailable ? "Automatic snapshot source unavailable. Use manual import." : message,
        tone: "error",
      });
    } finally {
      setHolderSnapshotLoading(false);
    }
  }, [showAdminTools]);

  const importHolderSnapshot = useCallback(() => {
    if (!showAdminTools) return;
    try {
      const snapshotTime = localDateTimeToIso(holderSnapshotCutoffTime);
      if (!snapshotTime) throw new Error("Set a valid snapshot cutoff time before importing a holder snapshot.");
      const snapshot = parseHolderSnapshotImport(
        holderSnapshotImportText,
        REWARD_EXCLUDED_WALLET_ADDRESSES,
        snapshotTime,
      );
      setHolderSnapshot(snapshot);
      setHolderSnapshotCutoffTime(toLocalDateTimeInputValue(new Date(snapshot.snapshotTime)));
      setHolderSnapshotSource("manual-import");
      setHolderSnapshotError("");
      setTxStatus({
        label: "Holder snapshot imported",
        detail: `${formatInteger(snapshot.eligibleNFTrees)} eligible NFTrees across ${formatInteger(
          snapshot.eligibleHolderWallets,
        )} holder wallets.`,
        tone: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Holder snapshot import failed.";
      setHolderSnapshotSource("unavailable");
      setHolderSnapshotError(message);
      setTxStatus({
        label: "Holder snapshot import failed",
        detail: message,
        tone: "error",
      });
    }
  }, [holderSnapshotCutoffTime, holderSnapshotImportText, showAdminTools]);

  const importResolvedOwners = useCallback(() => {
    if (!showAdminTools || !holderSnapshot) return;
    try {
      const snapshot = applyResolvedOwnersImport({
        snapshot: holderSnapshot,
        input: resolvedOwnersImportText,
        excludedWallets: REWARD_EXCLUDED_WALLET_ADDRESSES,
      });
      setHolderSnapshot(snapshot);
      setHolderSnapshotSource(snapshot.source);
      setResolvedOwnersImportText("");
      setHolderSnapshotError("");
      setTxStatus({
        label: "Resolved owners imported",
        detail: `${formatInteger(snapshot.manualResolvedNFTrees)} manually resolved NFTrees are now included in eligibility. ${formatInteger(
          snapshot.unresolvedNFTrees,
        )} unresolved owner records remain.`,
        tone: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resolved owners import failed.";
      setHolderSnapshotError(message);
      setTxStatus({
        label: "Resolved owners import failed",
        detail: message,
        tone: "error",
      });
    }
  }, [holderSnapshot, resolvedOwnersImportText, showAdminTools]);

  const downloadHolderSnapshotCsvTemplate = useCallback(() => {
    downloadTextFile(
      "treedrop-holder-snapshot-template.csv",
      "ownerAddress,nftreeObjectId\n0xOWNER_WALLET,0xNFTREE_OBJECT_ID\n",
      "text/csv",
    );
    setTxStatus({
      label: "Holder snapshot CSV template downloaded",
      detail: "Required columns: ownerAddress, nftreeObjectId. Optional columns: nftreeLabel, version, digest.",
      tone: "success",
    });
  }, []);

  const copyHolderSnapshotJson = useCallback(() => {
    if (!snapshotJson) return;
    copy(snapshotJson, "Holder snapshot JSON");
  }, [copy, snapshotJson]);

  const downloadHolderSnapshotJson = useCallback(() => {
    if (!holderSnapshot || !snapshotJson) return;
    downloadTextFile(`${holderSnapshot.snapshotId}.json`, snapshotJson, "application/json");
    setTxStatus({
      label: "Holder snapshot JSON downloaded",
      detail: holderSnapshot.snapshotId,
      tone: "success",
    });
  }, [holderSnapshot, snapshotJson]);

  const downloadHolderSnapshotCsv = useCallback(() => {
    if (!holderSnapshot) return;
    downloadTextFile(`${holderSnapshot.snapshotId}-holders.csv`, snapshotToCsv(holderSnapshot), "text/csv");
    setTxStatus({
      label: "Holder snapshot CSV downloaded",
      detail: holderSnapshot.snapshotId,
      tone: "success",
    });
  }, [holderSnapshot]);

  const downloadUnresolvedOwnersCsv = useCallback(() => {
    if (!holderSnapshot || !holderSnapshot.unresolved.length) return;
    downloadTextFile(`${holderSnapshot.snapshotId}-unresolved-owners.csv`, unresolvedOwnersToCsv(holderSnapshot), "text/csv");
    setTxStatus({
      label: "Unresolved owners CSV downloaded",
      detail: `${formatInteger(holderSnapshot.unresolved.length)} unresolved NFTree owner records.`,
      tone: "success",
    });
  }, [holderSnapshot]);

  const checkCommunityEligibilityPublishStatus = useCallback(
    async (tokenId: string) => {
      if (!showAdminTools || !holderSnapshot) {
        setEligibilityPublishState(emptyEligibilityPublishState());
        return;
      }
      const config = findCommunityRewardConfig(tokenId);
      const poolState = communityPools.find((communityPool) => communityPool.tokenId === tokenId);
      if (!config?.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion || !poolState || poolState.source !== "mainnet" || poolState.currentRound <= 0n) {
        setEligibilityPublishState({
          ...emptyEligibilityPublishState(),
          tokenId,
          round: poolState?.currentRound?.toString(),
          preflightStatus: "unavailable",
          error: "Eligibility status unavailable. Refresh before publishing.",
        });
        return;
      }

      const { pairs } = buildEligibilityPublishPairs(holderSnapshot);
      if (!pairs.length) {
        setEligibilityPublishState({
          ...emptyEligibilityPublishState(),
          tokenId,
          round: poolState.currentRound.toString(),
          preflightStatus: "not-published",
          error: "Holder snapshot has no eligible NFTree/owner pairs to publish.",
        });
        return;
      }

      setEligibilityPublishState((current) => ({
        ...current,
        isChecking: true,
        tokenId,
        round: poolState.currentRound.toString(),
        eligibleCount: pairs.length,
        error: "",
      }));

      const controller = new AbortController();
      try {
        const result = await fetchCommunityEligibilityPreflight(config, poolState.currentRound, pairs, controller.signal);
        setEligibilityPublishState((current) => ({
          ...current,
          isChecking: false,
          tokenId,
          round: poolState.currentRound.toString(),
          preflightStatus: result.status,
          eligibleCount: pairs.length,
          alreadyPublishedCount: result.publishedPairs.length,
          missingCount: result.missingPairs.length,
          ownerMismatchCount: result.ownerMismatchPairs.length,
          unavailableCount: result.unavailablePairs.length,
          missingPairs: result.missingPairs,
          ownerMismatchPairs: result.ownerMismatchPairs,
          error:
            result.status === "unavailable"
              ? "Eligibility status unavailable. Refresh before publishing."
              : result.status === "owner-mismatch"
                ? "Existing eligibility owner does not match current snapshot. Open a new distribution round or review the snapshot before publishing."
                : "",
        }));
      } catch (error) {
        setEligibilityPublishState((current) => ({
          ...current,
          isChecking: false,
          tokenId,
          round: poolState.currentRound.toString(),
          preflightStatus: "unavailable",
          eligibleCount: pairs.length,
          unavailableCount: pairs.length,
          missingPairs: [],
          error: error instanceof Error ? error.message : "Eligibility status unavailable. Refresh before publishing.",
        }));
      }
    },
    [communityPools, holderSnapshot, showAdminTools],
  );

  const publishCommunityEligibility = useCallback(
    async (tokenId: string, requestedBatchSize: number) => {
      if (!showAdminTools || !holderSnapshot) return;
      const config = findCommunityRewardConfig(tokenId);
      const poolState = communityPools.find((communityPool) => communityPool.tokenId === tokenId);
      const batchSize = clampEligibilityBatchSize(requestedBatchSize);

      setEligibilityPublishState({
        ...eligibilityPublishState,
        isPublishing: true,
        isChecking: false,
        progress: "Preparing holder snapshot eligibility.",
        error: "",
        digests: [],
        lastPublishedCount: 0,
      });

      try {
        if (!config?.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion) {
          throw new Error("Selected community token is missing eligibility registry configuration.");
        }
        if (!poolState || poolState.source !== "mainnet") {
          throw new Error("Selected community token pool state is unavailable.");
        }
        if (poolState.currentRound <= 0n) {
          throw new Error("Open a distribution before publishing eligibility for this pool.");
        }
        if (!holderSnapshot.snapshotTime) {
          throw new Error("Set or import a snapshot cutoff time before publishing eligibility.");
        }

        const { pairs, duplicateCount, invalidCount, excludedCount } = buildEligibilityPublishPairs(holderSnapshot);
        if (!pairs.length) throw new Error("Holder snapshot has no eligible NFTree/owner pairs to publish.");
        if (eligibilityPublishState.tokenId !== tokenId || eligibilityPublishState.round !== poolState.currentRound.toString()) {
          throw new Error("Refresh eligibility status before publishing this token and round.");
        }
        if (eligibilityPublishState.isChecking) {
          throw new Error("Eligibility status is still loading. Wait for the check to finish before publishing.");
        }
        if (eligibilityPublishState.unavailableCount) {
          throw new Error("Eligibility status unavailable. Refresh before publishing.");
        }
        if (
          eligibilityPublishState.preflightStatus === "snapshot-finalized" ||
          eligibilityPublishState.preflightStatus === "snapshot-mismatch"
        ) {
          throw new Error(
            "Eligibility snapshot is finalized for this token and round. Open a new distribution round to publish a new holder snapshot.",
          );
        }
        if (eligibilityPublishState.ownerMismatchCount) {
          throw new Error(
            "Existing eligibility owner does not match current snapshot. Open a new distribution round or review the snapshot before publishing.",
          );
        }
        if (eligibilityPublishState.preflightStatus === "already-published" || !eligibilityPublishState.missingPairs.length) {
          throw new Error(`Eligibility already published for ${config.symbol} round ${poolState.currentRound.toString()}.`);
        }

        const pairsToPublish = eligibilityPublishState.missingPairs;
        const batches = chunkItems(pairsToPublish, batchSize);
        const digests: string[] = [];
        const validationNote = [
          duplicateCount ? `${duplicateCount} duplicate NFTree ID${duplicateCount === 1 ? "" : "s"} removed` : "",
          invalidCount ? `${invalidCount} invalid pair${invalidCount === 1 ? "" : "s"} skipped` : "",
          excludedCount ? `${excludedCount} excluded project-wallet NFTree${excludedCount === 1 ? "" : "s"} skipped` : "",
        ]
          .filter(Boolean)
          .join("; ");

        for (let index = 0; index < batches.length; index += 1) {
          const batch = batches[index]!;
          const progress = `Publishing batch ${index + 1} of ${batches.length}`;
          setEligibilityPublishState((current) => ({ ...current, progress, digests }));
          setTxStatus({
            label: progress,
            detail: `Publishing eligibility for snapshot cutoff: ${formatSnapshotTime(holderSnapshot.snapshotTime)}. ${
              config.symbol
            } round ${poolState.currentRound.toString()}, ${batch.length} missing NFTrees.`,
            tone: "pending",
          });

          const result = await dAppKit.signAndExecuteTransaction({
            transaction: buildAddCommunityTokenRoundEligibilityTransaction(
              config,
              batch.map((pair) => pair.nftreeObjectId),
              batch.map((pair) => pair.ownerAddress),
            ),
            network: CONFIG.network,
          });
          const digest = resultDigest(result);
          if (digest) digests.push(digest);
        }

        setEligibilityPublishState({
          ...eligibilityPublishState,
          isPublishing: false,
          isChecking: false,
          progress: `Eligibility published for ${pairs.length} NFTrees.`,
          error: "",
          digests,
          lastPublishedCount: pairsToPublish.length,
          preflightStatus: "already-published",
          alreadyPublishedCount: pairs.length,
          missingCount: 0,
          ownerMismatchCount: 0,
          unavailableCount: 0,
          missingPairs: [],
        });
        setTelegramEligibilityRecords((current) => ({
          ...current,
          [telegramEligibilityRecordKey(config.tokenId, poolState.currentRound)]: {
            tokenId: config.tokenId,
            round: poolState.currentRound.toString(),
            eligibleCount: pairs.length,
            snapshotTime: holderSnapshot.snapshotTime,
            updatedAt: new Date().toISOString(),
          },
        }));
        setTxStatus({
          label: "Eligibility published",
          detail: `${config.symbol} eligibility published for ${pairsToPublish.length} missing NFTrees.${
            validationNote ? ` ${validationNote}.` : ""
          }`,
          digest: digests.at(-1),
          tone: "success",
        });
        void refreshCommunityPools();
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "Eligibility publishing failed.";
        const message = eligibilityPublishErrorMessage(rawMessage);
        setEligibilityPublishState((current) => ({
          ...current,
          isPublishing: false,
          progress: current.progress.startsWith("Publishing batch")
            ? `Eligibility publishing stopped at ${current.progress.toLowerCase().replace("publishing ", "")}.`
            : current.progress,
          error: message,
        }));
        setTxStatus({
          label: "Eligibility publishing stopped",
          detail: message,
          tone: "error",
        });
      }
    },
    [communityPools, dAppKit, eligibilityPublishState, holderSnapshot, refreshCommunityPools, showAdminTools, setTelegramEligibilityRecords],
  );

  const handleWizardNextAction = useCallback(() => {
    if (workflowNextAction.targetId === "telegram-alerts") setTelegramAlertType("reward-live");
    if (workflowNextAction.actionKey === "refresh-snapshot") {
      refreshHolderSnapshot();
    }
    if (workflowNextAction.actionKey === "check-eligibility" && selectedDistributionToken) {
      void checkCommunityEligibilityPublishStatus(selectedDistributionToken.tokenId);
    }

    window.requestAnimationFrame(() => {
      if (!workflowNextAction.targetId) return;
      document.getElementById(workflowNextAction.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [
    checkCommunityEligibilityPublishStatus,
    refreshHolderSnapshot,
    selectedDistributionToken,
    workflowNextAction.actionKey,
    workflowNextAction.targetId,
  ]);

  const connectWallet = useCallback(
    async (walletToConnect: UiWallet) => {
      setTxStatus({ label: "Connecting wallet", detail: `Opening ${walletToConnect.name}.`, tone: "pending" });
      try {
        await dAppKit.connectWallet({ wallet: walletToConnect });
        setWalletPickerOpen(false);
        setTxStatus({ label: "Wallet connected", detail: walletToConnect.name, tone: "success" });
      } catch (error) {
        setTxStatus({
          label: "Wallet not connected",
          detail: error instanceof Error ? error.message : "The wallet connection was cancelled.",
          tone: "error",
        });
      }
    },
    [dAppKit],
  );

  const disconnectWallet = useCallback(async () => {
    await dAppKit.disconnectWallet();
    setTxStatus({ label: "Wallet disconnected", detail: "Choose a wallet when you are ready.", tone: "idle" });
  }, [dAppKit]);

  return (
    <div className={`app-shell${sponsorOnly ? " rewards-sponsor" : ""}`}>
      <header className="topbar">
        <a className="brand" href="/rewards/" aria-label="NFTree Rewards home">
          <span className="brand-mark" aria-hidden="true">
            <img src={CONFIG.tokenLogoUrl} alt="" />
          </span>
          <span>
            <strong>NFTree Rewards</strong>
            <small>NFTree holder rewards</small>
          </span>
        </a>

        <nav aria-label="Primary">
          <a href="/">TREE Home</a>
          <a href="/rewards/">Back to Rewards</a>
          {!sponsorOnly && <a href="#claim">Claim</a>}
          <a href="#community-rewards">Rewards</a>
          <a href="#community-pool">Community Pool</a>
          <a href="#registered-tokens">Tokens</a>
          <a href="#drop-details">Drop Details</a>
          {showAdminTools ? <a href="#project-tools">Project Tools</a> : null}
        </nav>

        <div className="wallet-zone">
          <span className="network-pill">
            <span className={`status-light ${pool.source === "mainnet" ? "is-live" : ""}`} aria-hidden="true" />
            {loading ? "Reading pool" : pool.source === "mainnet" ? "Mainnet live" : "Pool read pending"}
          </span>
          <div className="wallet-picker">
            <button
              className="wallet-picker-trigger"
              type="button"
              aria-expanded={walletPickerOpen}
              aria-haspopup="menu"
              onClick={() => setWalletPickerOpen((open) => !open)}
              disabled={connection.isConnecting || (!wallet && !wallets.length)}
            >
              {wallet ? (
                <span className="wallet-trigger-icon">
                  <WalletIcon wallet={wallet} />
                </span>
              ) : null}
              <span>{connectLabel}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {walletPickerOpen ? (
              <div className="wallet-menu" role="menu">
                {wallet ? (
                  <button className="wallet-row disconnect" type="button" role="menuitem" onClick={disconnectWallet}>
                    <span className="wallet-row-icon" aria-hidden="true">-</span>
                    <span>
                      <strong>Disconnect {wallet.name}</strong>
                      <small>{shortId(account?.address || "")}</small>
                    </span>
                  </button>
                ) : null}

                {wallets.map((availableWallet) => (
                  <button
                    className="wallet-row"
                    key={`${availableWallet.name}-${availableWallet.icon || "wallet"}`}
                    type="button"
                    role="menuitem"
                    onClick={() => void connectWallet(availableWallet)}
                  >
                    <span className="wallet-row-icon">
                      <WalletIcon wallet={availableWallet} />
                    </span>
                    <span>
                      <strong>{availableWallet.name}</strong>
                      <small>{availableWallet.accounts.length} account source</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="dashboard-section claim-dashboard" aria-label="Claim Dashboard">
        <section className="hero">
          <div className="hero-copy">
            <h1>Claim NFTree Holder Rewards</h1>
            <p>
              Connect the wallet that holds your NFTree. TreeDrop will check if you have a
              reward available to claim.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#claim">Check My Rewards</a>
              <a className="quiet-link" href="#how-it-works">How it works</a>
            </div>
          </div>

          <section className="panel claim-panel hero-claim-card" id="claim" aria-labelledby="claimTitle">
            <div className="panel-head">
              <div>
                <span>Reward check</span>
                <h2 id="claimTitle">Check and claim</h2>
              </div>
              <span className="chip">{nftreeLoading ? "Checking" : `${ownedNFTrees.length} NFTree`}</span>
            </div>

            <div className={`claim-status-card ${claimState.tone}`}>
              <span>Reward status</span>
              <strong>{claimState.label}</strong>
              <p>{claimState.detail}</p>
            </div>

            <section className="claim-drop-rewards" aria-labelledby="claimDropRewardsTitle">
              <div className="claim-drop-rewards-head">
                <span>Current Drop Rewards</span>
                <strong id="claimDropRewardsTitle">
                  {currentDropRewardAssets.length ? "Available now" : "No active reward assets"}
                </strong>
              </div>
              {currentDropRewardAssets.length ? (
                <div className="claim-drop-reward-list">
                  {currentDropRewardAssets.map((token) => {
                    const communityPool = communityPoolByTokenId.get(token.tokenId);
                    const assetStatus =
                      token.tokenId === "sui"
                        ? selectedSuiAssetStatus
                        : communityAssetStatusByTokenId[token.tokenId] || "eligibility unknown";
                    return (
                      <article className="claim-drop-reward-item" key={token.tokenId}>
                        <span className="token-logo">
                          <TokenLogo token={token} />
                        </span>
                        <div>
                          <strong>{token.symbol}</strong>
                          <small>
                            {token.tokenId === "sui"
                              ? `${formatSui(pool.perNftreeMist, 4)} per NFTree`
                              : `${formatTokenAmount(communityPool?.perNftreeAmount || 0n, token.decimals, 6)} ${token.symbol} per NFTree`}
                          </small>
                        </div>
                        <em>{assetStatusLabel(assetStatus)}</em>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p>No active reward drop is open right now.</p>
              )}
              <p>
                Only funded, active reward assets appear here.
              </p>
              {currentDropRewardAssets.length > 1 ? (
                <p>Multiple reward assets may require multiple wallet confirmations.</p>
              ) : null}
            </section>

            {ownedNFTrees.length ? (
              <label className="field">
                <span>Detected NFTree</span>
                <select value={nftreeObjectId} onChange={(event) => setNftreeObjectId(event.target.value)}>
                  {ownedNFTrees.map((nftree) => (
                    <option key={nftree.objectId} value={nftree.objectId}>
                      {shortId(nftree.label)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {claimCountLabel ? <p className="claim-count-note">{claimCountLabel}</p> : null}

            <div className="claim-actions">
              <button className="primary-action claim-cta" type="button" disabled={!canClaim} onClick={handleClaim}>
                {claimLabel}
              </button>
              {canClaimAll ? (
                <button
                  className="secondary-action claim-all-cta"
                  type="button"
                  disabled={claimAllActive}
                  onClick={() => void handleClaimAll()}
                >
                  Claim All Eligible {eligibleNFTreeCount} NFTrees
                </button>
              ) : null}
              {claimStatusUnavailable ? (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => {
                    void refresh();
                    void refreshCommunityPools();
                    setClaimStatusRefreshNonce((nonce) => nonce + 1);
                  }}
                >
                  Refresh claim status
                </button>
              ) : null}
            </div>

            {claimAllProgress ? <p className="panel-note progress-note">{claimAllProgress}</p> : null}
            {rewardExcludedWallet && detectedNFTreeCount > 0 ? (
              <p className="panel-note">
                Project wallet NFTrees are detected but excluded from holder reward eligibility.
              </p>
            ) : null}
            {!rewardExcludedWallet &&
            claimStatusReady &&
            currentDropRewardAssets.length > 0 &&
            detectedNFTreeCount > 0 &&
            eligibleNFTreeCount === 0 &&
            allDetectedNFTreesClaimed ? (
              <p className="panel-note">All detected NFTrees have already claimed this distribution.</p>
            ) : null}

            {txStatus.tone === "error" ? <p className="panel-note">{txStatus.detail}</p> : null}
            {nftreeScanError && !ownedNFTrees.length ? <p className="panel-note">{nftreeScanError}</p> : null}

            <p className="ecosystem-line">
              TreeDrop is the NFTree holder rewards page for the TREE community on Sui.
            </p>
          </section>
        </section>

        <section className="guidance-band" aria-label="Current wallet status">
          <article className="guide-card primary-guide">
            <span>Next step</span>
            <strong>{nextStep.label}</strong>
            <p>{nextStep.detail}</p>
          </article>
          <article className="guide-card">
            <span>Connected wallet</span>
            <strong>{connectedWalletLabel}</strong>
            <p>{walletRole}</p>
          </article>
          {showAdminTools ? (
            <article className="guide-card project-guide-card">
              <span>Project Tools</span>
              <strong>Unlocked</strong>
              <p>Operator controls are available for this wallet.</p>
            </article>
          ) : (
            <article className="guide-card">
              <span>Community Participation</span>
              <strong>Support NFTree reward campaigns</strong>
              <p>Projects and holders can contribute to supported reward pools.</p>
            </article>
          )}
        </section>
        </section>

        <section className="how-it-works" id="how-it-works" aria-labelledby="howTitle">
          <div className="section-heading">
            <span>How it works</span>
            <h2 id="howTitle">Three quick steps</h2>
          </div>
          <div className="steps-grid">
            <article>
              <span>1</span>
              <strong>Hold NFTree</strong>
              <p>Rewards are for NFTree holders.</p>
            </article>
            <article>
              <span>2</span>
              <strong>Connect Wallet</strong>
              <p>Use the wallet that holds your NFTree.</p>
            </article>
            <article>
              <span>3</span>
              <strong>Claim Drop</strong>
              <p>If a reward is open, claim it here.</p>
            </article>
          </div>
        </section>

        <section className="dashboard-section rewards-dashboard" id="community-rewards" aria-labelledby="rewardsDashboardTitle">
          <div className="dashboard-heading">
            <span>Rewards Dashboard</span>
            <h2 id="rewardsDashboardTitle">Reward programs</h2>
          </div>

        <section className="community-rewards" aria-labelledby="communityTitle">
          <div className="section-heading">
            <span>Community rewards</span>
            <h2 id="communityTitle">TREE ecosystem drops</h2>
          </div>
          <p className="section-copy">
            NFTree holders are part of the TREE ecosystem. TreeDrop lets eligible NFTree holders
            check and claim active reward drops from the wallet that holds their NFTree.
          </p>
          <div className="community-grid">
            <article>
              <strong>TREE Ecosystem</strong>
              <p>NFTrees are part of the TREE community on Sui.</p>
            </article>
            <article>
              <strong>NFTree Holder Rewards</strong>
              <p>Connect the wallet that holds your NFTree to check active drops.</p>
            </article>
            <article>
              <strong>Community Tokens</strong>
              <p>
                Community projects can support NFTree holders through configured reward campaigns.
              </p>
            </article>
          </div>
        </section>

        <FeaturedCommunityReward tokens={showAdminTools ? [adminFeaturedPreviewToken] : publicFeaturedTokens} />

        <CampaignRewardsSection
          campaigns={SAMPLE_CAMPAIGN_REWARDS}
          featuredTokens={showAdminTools ? [adminFeaturedPreviewToken] : publicFeaturedTokens}
        />
        </section>

        <section className="dashboard-section community-pool-dashboard" aria-label="Community Pool Dashboard">
        <CommunityPoolSection
          tokens={displayRewardTokens}
          selectedToken={selectedContributionToken}
          selectedTokenId={selectedContributionToken.tokenId}
          onTokenChange={setSelectedContributionTokenId}
        />

          <section className="workspace public-workspace contribution-workspace" aria-label="Community pool contribution controls">
            <section className="panel action-panel" id="fund" aria-labelledby="fundTitle">
            <div className="panel-head">
              <div>
                <span>Community Participation</span>
                <h2 id="fundTitle">Support NFTree reward campaigns</h2>
              </div>
              <span className="chip">
                {selectedContributionIsLiveSui
                  ? "Live SUI deposit"
                  : selectedContributionIsConfiguredCommunityToken
                    ? "Configured pool"
                    : "Pool setup required"}
              </span>
            </div>
            <p className="panel-helper">
              {selectedContributionIsLiveSui
                ? "Add SUI to the live SUI RewardPool for NFTree holder drops."
                : selectedContributionIsConfiguredCommunityToken
                  ? `Add ${selectedContributionToken.symbol} to its configured community reward pool.`
                  : "Registered - pool not configured yet. Pool setup required before live contributions."}
            </p>

            <div className="selected-contribution-card">
              <span className="token-logo">
                <TokenLogo token={selectedContributionToken} />
              </span>
              <div>
                <strong>{selectedContributionToken.symbol}</strong>
                <small>{selectedContributionToken.name}</small>
              </div>
              <span>
                {selectedContributionIsLiveSui
                  ? "Live SUI funding enabled"
                  : selectedContributionIsConfiguredCommunityToken
                    ? "Community pool funding enabled"
                  : "Pool setup required before live contributions"}
              </span>
            </div>
            {selectedContributionPoolBalance ? (
              <p className="pool-balance-note">Pool balance: {selectedContributionPoolBalance}</p>
            ) : (
              <p className="pool-balance-note">
                This token is registered with TreeDrop, but its community reward pool has not been configured yet.
                Contact the TreeDrop project team to activate this token pool.
              </p>
            )}
            <p className="pool-balance-note">Your wallet balance: {selectedWalletBalanceLabel}</p>

            {selectedContributionIsLiveSui || selectedContributionIsConfiguredCommunityToken ? (
              <>
                <label className="field">
                  <span>{selectedContributionToken.symbol} to add</span>
                  <input value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} inputMode="decimal" />
                </label>

                <div className="quick-row percent-row">
                  {[25, 50, 75].map((percent) => (
                    <button key={percent} type="button" onClick={() => setFundAmountPercent(percent)} disabled={!connected || maxContributionAtomic <= 0n}>
                      {percent}%
                    </button>
                  ))}
                  <button type="button" onClick={() => setFundAmountPercent(100)} disabled={!connected || maxContributionAtomic <= 0n}>
                    Max
                  </button>
                </div>
                <p className={`pool-balance-note ${contributionAmountExceedsBalance || selectedWalletBalanceError ? "is-warning" : ""}`}>
                  {contributionValidationMessage}
                </p>
              </>
            ) : null}

            <button className="primary-action" type="button" disabled={!canFund} onClick={handleFund}>
              {selectedContributionIsLiveSui
                ? connected
                  ? `Fund SUI RewardPool: ${formatSui(fundAmountMist, 4)}`
                  : "Connect wallet to fund SUI"
                : selectedContributionIsConfiguredCommunityToken
                  ? connected
                    ? `Fund ${fundAmount || "0"} ${selectedContributionToken.symbol} Community Pool`
                    : `Connect wallet to fund ${selectedContributionToken.symbol}`
                  : "Pool setup required"}
            </button>
            </section>
          </section>
        </section>

        {showAdminTools ? (
          <section className="dashboard-section project-tools-dashboard" id="project-tools" aria-label="Project Tools">
            <div className="dashboard-heading">
              <span>Project Tools</span>
              <h2>Distribution Workflow</h2>
            </div>
            <p className="panel-helper">Funded legacy claim rounds remain available to their holders. To create a new routine distribution without replacing those claims, <a href="/rewards/?manage=1">open Manage Rewards</a>.</p>
            <section className="panel project-workflow-panel reward-wizard-panel" aria-labelledby="projectWorkflowTitle">
              <div className="panel-head">
                <div>
                  <span>Protected project controls</span>
                  <h3 id="projectWorkflowTitle">Reward Distribution Wizard</h3>
                </div>
                <span className="chip">{distributionType === "sui" ? "SUI RewardPool" : "Community Token Pool"}</span>
              </div>
              <p className="panel-helper">
                Follow the next required action, then use the detail sections below only when a step needs input.
              </p>
              <div className="workflow-controls">
                <label className="field">
                  <span>Distribution type</span>
                  <select value={distributionType} onChange={(event) => setDistributionType(event.target.value as "sui" | "community")}>
                    <option value="sui">SUI RewardPool</option>
                    <option value="community">Community Token Pool</option>
                  </select>
                </label>
                {distributionType === "community" ? (
                  <label className="field">
                    <span>Community token</span>
                    <select value={selectedDistributionToken?.tokenId || ""} onChange={(event) => setSelectedDistributionTokenId(event.target.value)}>
                      {configuredCommunityDistributionTokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {formatTokenSelectLabel(token)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="selected-token-state-card">
                <div>
                  <span>Selected token summary</span>
                  <strong>{distributionType === "sui" ? "SUI RewardPool" : selectedDistributionToken?.symbol || "Community token"}</strong>
                  <p>{distributionType === "sui" ? "SUI claims use live NFTree ownership and do not need a holder snapshot." : "Community token drops require a holder snapshot and published eligibility before holders can claim."}</p>
                </div>
                <div className="workflow-state-grid">
                  <span><small>Pool balance</small><strong>{workflowPoolBalanceLabel}</strong></span>
                  <span><small>Current round</small><strong>{workflowRoundLabel}</strong></span>
                  <span><small>Reward per NFTree</small><strong>{workflowRewardPerNftreeLabel}</strong></span>
                  <span><small>Eligibility registry</small><strong>{workflowEligibilityStatus}</strong></span>
                  <span><small>Claim-ready status</small><strong>{workflowClaimReady ? "Claim-ready" : "Waiting"}</strong></span>
                  <span><small>Next required step</small><strong>{workflowNextStep}</strong></span>
                </div>
              </div>
              <div className={`wizard-next-action ${workflowStepClass(workflowNextAction.status)}`}>
                <div>
                  <span>Next required action</span>
                  <strong>{workflowNextAction.actionLabel || "No action required"}</strong>
                  <p>{workflowNextAction.detail}</p>
                </div>
                <button className="primary-action" type="button" onClick={handleWizardNextAction}>
                  {workflowNextAction.actionLabel || "No action required"}
                </button>
              </div>
              <div className="wizard-step-grid" aria-label="Reward Distribution Wizard steps">
                {workflowSteps.map((step, index) => (
                  <article className={`wizard-step-card ${workflowStepClass(step.status)}`} key={step.label}>
                    <div className="wizard-step-card-head">
                      <span>{index + 1}</span>
                      <small>{step.status}</small>
                    </div>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                    {step.disabledReason ? <em>{step.disabledReason}</em> : null}
                    {step.actionLabel && step.targetId ? (
                      <button
                        type="button"
                        onClick={() => document.getElementById(step.targetId || "")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        {step.actionLabel}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
            <details className="project-details wizard-details">
              <summary>Advanced Pool Setup</summary>
              <CommunityPoolSetupPanel tokens={displayRewardTokens} onCopy={copy} />
            </details>
            <details className="project-details wizard-details">
              <summary>Holder Snapshot Details</summary>
              <HolderSnapshotPanel
                snapshot={holderSnapshot}
                snapshotSource={holderSnapshotSource}
                snapshotCutoffTime={holderSnapshotCutoffTime}
                isLoading={holderSnapshotLoading}
                error={holderSnapshotError}
                importText={holderSnapshotImportText}
                resolvedOwnersImportText={resolvedOwnersImportText}
                tokens={displayRewardTokens}
                suiPool={pool}
                communityPools={communityPools}
                onRefresh={refreshHolderSnapshot}
                onSnapshotCutoffTimeChange={setHolderSnapshotCutoffTime}
                onImportTextChange={setHolderSnapshotImportText}
                onResolvedOwnersImportTextChange={setResolvedOwnersImportText}
                onImportSnapshot={importHolderSnapshot}
                onImportResolvedOwners={importResolvedOwners}
                onDownloadCsvTemplate={downloadHolderSnapshotCsvTemplate}
                onCopyJson={copyHolderSnapshotJson}
                onDownloadJson={downloadHolderSnapshotJson}
                onDownloadCsv={downloadHolderSnapshotCsv}
                onDownloadUnresolvedCsv={downloadUnresolvedOwnersCsv}
                publishState={eligibilityPublishState}
                onCheckEligibilityStatus={checkCommunityEligibilityPublishStatus}
                onPublishEligibility={publishCommunityEligibility}
              />
            </details>
            <details className="project-details wizard-details">
              <summary>Eligibility Details</summary>
              <section className="panel project-panel eligibility-detail-panel" aria-labelledby="eligibilityDetailsTitle">
                <div className="panel-head">
                  <div>
                    <span>Project Tools</span>
                    <h2 id="eligibilityDetailsTitle">Eligibility Details</h2>
                  </div>
                  <span className="chip">{workflowEligibilityStatus}</span>
                </div>
                <p className="panel-helper">
                  Community token eligibility is published from the holder snapshot tools. SUI RewardPool does not use eligibility publishing.
                </p>
                <div className="setup-status-grid">
                  <span>
                    <small>Selected token</small>
                    <strong>{distributionType === "sui" ? "SUI RewardPool" : selectedDistributionToken?.symbol || "--"}</strong>
                  </span>
                  <span>
                    <small>Eligibility status</small>
                    <strong>{workflowEligibilityStatus}</strong>
                  </span>
                  <span>
                    <small>Eligible NFTrees</small>
                    <strong>{distributionType === "sui" ? "Not required for SUI" : formatInteger(communityEligibleCount)}</strong>
                  </span>
                </div>
                {distributionType === "community" && !communityEligibilityFinalized ? (
                  <p className="pool-balance-note is-warning">Publish eligibility before sending claim-live alert.</p>
                ) : null}
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => document.getElementById("holder-snapshot")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Open holder snapshot and eligibility tools
                </button>
              </section>
            </details>
            <details className="project-details wizard-details" hidden={!TELEGRAM_ALERTS_ENABLED}>
              <summary>Telegram Alert Details</summary>
              <TelegramAlertsPanel
                alertType={telegramAlertType}
                onAlertTypeChange={setTelegramAlertType}
                assets={telegramAlertAssets}
                message={telegramMessage}
                onMessageChange={setTelegramMessage}
                imageUrl={telegramImageUrl}
                onImageUrlChange={setTelegramImageUrl}
                onUseDefaultImage={() => setTelegramImageUrl(TELEGRAM_DEFAULT_IMAGE_URL)}
                onClearImage={() => setTelegramImageUrl("")}
                serviceStatus={telegramServiceStatus}
                confirmationChecked={telegramConfirmationChecked}
                onConfirmationChange={setTelegramConfirmationChecked}
                confirmationDisabled={telegramConfirmationDisabled}
                confirmationStatusText={telegramConfirmationStatusText}
                canSend={canSendTelegramAlert}
                sendStatus={telegramSendStatus}
                history={telegramAlertHistory}
                onSend={() => void sendTelegramAlert()}
              />
            </details>
            <details className="project-details wizard-details">
              <summary>Technical Config</summary>
              <FeaturedTokenSettingsPanel
                tokens={featuredTokenOptions}
                settings={featuredSettings}
                onSettingsChange={setFeaturedSettings}
                metadataStatus={metadataStatus}
                isLoadingMetadata={metadataLoading}
                onLoadMetadata={loadFeaturedMetadata}
              />
              <CampaignSetupPreviewPanel campaigns={SAMPLE_CAMPAIGN_REWARDS} />
            </details>
            <section className="workspace has-project-tools project-tools-workspace" aria-label="Protected project controls">
              <section className="panel project-panel" id="round" aria-labelledby="roundTitle">
              <div className="panel-head">
                <div>
                  <span>Project action</span>
                  <h2 id="roundTitle">Open Distribution</h2>
                </div>
                <span className="chip">Project wallet ready</span>
              </div>
              <p className="panel-helper">Creates the claimable reward amount for NFTree holders.</p>

              <div className="distribution-type-toggle" role="group" aria-label="Distribution type">
                <button
                  type="button"
                  className={distributionType === "sui" ? "is-selected" : ""}
                  onClick={() => setDistributionType("sui")}
                >
                  SUI RewardPool
                </button>
                <button
                  type="button"
                  className={distributionType === "community" ? "is-selected" : ""}
                  onClick={() => setDistributionType("community")}
                >
                  Community Token Pool
                </button>
              </div>

              {distributionType === "sui" ? (
                <>
                  <label className="field">
                    <span>SUI reward per NFTree</span>
                    <input value={roundAmount} onChange={(event) => setRoundAmount(event.target.value)} inputMode="decimal" />
                  </label>

                  <div className="quick-row">
                    {["0.01", "0.05", "0.1", "1"].map((amount) => (
                      <button key={amount} type="button" onClick={() => setRoundAmount(amount)}>
                        {amount} SUI
                      </button>
                    ))}
                  </div>

                  <button className="secondary-action" type="button" disabled={!canOpenRound} onClick={handleOpenRound}>
                    {openRoundLabel}
                  </button>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Community token</span>
                    <select value={selectedDistributionToken?.tokenId || ""} onChange={(event) => setSelectedDistributionTokenId(event.target.value)}>
                      {configuredCommunityDistributionTokens.map((token) => (
                        <option key={token.tokenId} value={token.tokenId}>
                          {formatTokenSelectLabel(token)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedDistributionToken ? (
                    <div className="selected-contribution-card distribution-token-card">
                      <span className="token-logo">
                        <TokenLogo token={selectedDistributionToken} />
                      </span>
                      <div>
                        <strong>{selectedDistributionToken.symbol}</strong>
                        <small>{selectedDistributionToken.name}</small>
                      </div>
                      <span>
                        {selectedDistributionPool?.source === "mainnet"
                          ? `Round ${selectedDistributionPool.currentRound.toString()}`
                          : "Pool read pending"}
                      </span>
                    </div>
                  ) : null}

                  <div className="distribution-stats-grid">
                    <Stat
                      label="Pool balance"
                      value={
                        selectedDistributionToken
                          ? `${formatTokenAmount(communityDistributionPoolBalance, selectedDistributionToken.decimals, 4)} ${
                              selectedDistributionToken.symbol
                            }`
                          : "--"
                      }
                    />
                    <Stat
                      label="Current per NFTree"
                      value={
                        selectedDistributionToken && selectedDistributionPool
                          ? `${formatTokenAmount(selectedDistributionPool.perNftreeAmount, selectedDistributionToken.decimals, 6)} ${
                              selectedDistributionToken.symbol
                            }`
                          : "--"
                      }
                    />
                  </div>

                  {canShowCommunityEvenSplit && selectedDistributionToken ? (
                    <section className="even-split-card" aria-label="Even Split calculator">
                      <div className="even-split-head">
                        <span>Even Split</span>
                        <strong>
                          {formatTokenAmount(evenSplitPerNftreeAtomic, selectedDistributionToken.decimals, 6)}{" "}
                          {selectedDistributionToken.symbol}
                        </strong>
                      </div>
                      <div className="even-split-grid">
                        <Stat
                          label="Pool balance"
                          value={`${formatTokenAmount(communityDistributionPoolBalance, selectedDistributionToken.decimals, 4)} ${
                            selectedDistributionToken.symbol
                          }`}
                        />
                        <Stat label="Eligible NFTrees" value={formatInteger(evenSplitEligibleCount)} />
                        <Stat
                          label="Even reward per NFTree"
                          value={`${formatTokenAmount(evenSplitPerNftreeAtomic, selectedDistributionToken.decimals, 6)} ${
                            selectedDistributionToken.symbol
                          }`}
                        />
                        <Stat
                          label="Estimated leftover in pool"
                          value={`${formatTokenAmount(evenSplitLeftoverAtomic, selectedDistributionToken.decimals, 6)} ${
                            selectedDistributionToken.symbol
                          }`}
                        />
                      </div>
                      <p className={`pool-balance-note ${evenSplitPerNftreeAtomic <= 0n ? "is-warning" : ""}`}>
                        {evenSplitPerNftreeAtomic <= 0n
                          ? "Pool balance is too small to distribute across the current eligible NFTree count."
                          : "Rounded down in atomic units so the total payout cannot exceed the pool balance."}
                      </p>
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={!canUseCommunityEvenSplit}
                        onClick={handleUseCommunityEvenSplit}
                      >
                        Use Even Split
                      </button>
                    </section>
                  ) : null}

                  <label className="field">
                    <span>{selectedDistributionToken?.symbol || "Token"} reward per NFTree</span>
                    <input value={communityRoundAmount} onChange={(event) => setCommunityRoundAmount(event.target.value)} inputMode="decimal" />
                  </label>

                  <div className="quick-row">
                    {["1", "10", "100", "1000"].map((amount) => (
                      <button key={amount} type="button" onClick={() => setCommunityRoundAmount(amount)}>
                        {amount} {selectedDistributionToken?.symbol || ""}
                      </button>
                    ))}
                  </div>

                  <p className={`pool-balance-note ${communityDistributionExceedsPool || !communityDistributionHasConfig ? "is-warning" : ""}`}>
                    {!communityDistributionHasConfig
                      ? "Missing configured pool or eligibility registry for this token."
                      : communityDistributionExceedsPool
                        ? "Reward per NFTree is higher than the current pool balance."
                        : "Open this token distribution after confirming the holder snapshot is ready."}
                  </p>

                  <button className="secondary-action" type="button" disabled={!canOpenCommunityRound} onClick={handleOpenCommunityRound}>
                    {openCommunityRoundLabel}
                  </button>
                </>
              )}
              </section>
              <article className="id-panel project-capability-panel">
                <span>Project capability</span>
                <button type="button" onClick={() => copy(CONFIG.adminCapId, "Project capability ID")}>
                  {shortId(CONFIG.adminCapId)}
                </button>
              </article>
            </section>
          </section>
        ) : null}

        <section className="dashboard-section token-dashboard" aria-label="Token Dashboard">
          <div className="dashboard-heading">
            <span>Token Dashboard</span>
            <h2>Registered reward tokens</h2>
          </div>
          <RegisteredRewardTokens tokens={displayRewardTokens} />
        </section>

        <section className="dashboard-section drop-details-dashboard" aria-label="Drop Details and Technical Dashboard">
        <section className="drop-details" id="drop-details" aria-labelledby="dropTitle">
          <div className="section-heading">
            <span>Drop details</span>
            <h2 id="dropTitle">Current reward drop</h2>
          </div>
          <aside className="pool-card" aria-label="Current reward drop details">
            <div className="pool-card-head">
              <span>Current drop status</span>
              <button
                type="button"
                onClick={() => {
                  void refresh();
                  void refreshCommunityPools();
                }}
                aria-label="Refresh reward drop details"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12a9 9 0 0 1-15.5 6.2" />
                  <path d="M3 12A9 9 0 0 1 18.5 5.8" />
                  <path d="M18.5 2v3.8H15" />
                  <path d="M5.5 22v-3.8H9" />
                </svg>
              </button>
            </div>
            <strong>{currentDropRewardAssets.length ? "Open" : "Not open"}</strong>
            <div className="pool-stats">
              <Stat label="Reward per NFTree" value={formatSui(pool.perNftreeMist, 4)} />
              <Stat label="Claims completed" value={formatInteger(pool.totalClaims)} />
              <Stat label="Total paid out" value={formatSui(pool.totalClaimed, 4)} />
              <Stat label="Pool balance" value={formatSui(pool.vaultBalance, 4)} />
            </div>
          </aside>
          <section className="current-drop-assets" aria-labelledby="dropAssetsTitle">
            <div className="drop-assets-head">
              <div>
                <span>Current Drop Reward Assets</span>
                <h3 id="dropAssetsTitle">Live in this drop</h3>
              </div>
              <span className="chip">{currentDropRewardAssets.length} live asset{currentDropRewardAssets.length === 1 ? "" : "s"}</span>
            </div>
            <div className="drop-assets-grid">
              {currentDropRewardAssets.map((token) => {
                const communityPool = communityPoolByTokenId.get(token.tokenId);
                const rewardPerNftree =
                  token.tokenId === "sui"
                    ? formatSui(pool.perNftreeMist, 4)
                    : `${formatTokenAmount(communityPool?.perNftreeAmount || 0n, token.decimals, 6)} ${token.symbol}`;
                const poolBalance =
                  token.tokenId === "sui"
                    ? formatSui(pool.vaultBalance, 4)
                    : `${formatTokenAmount(communityPool?.vaultBalance || 0n, token.decimals, 4)} ${token.symbol}`;
                const totalPaid =
                  token.tokenId === "sui"
                    ? formatSui(pool.totalClaimed, 4)
                    : `${formatTokenAmount(communityPool?.totalClaimed || 0n, token.decimals, 4)} ${token.symbol}`;
                const claimsCompleted =
                  token.tokenId === "sui" ? formatInteger(pool.totalClaims) : formatInteger(communityPool?.totalClaims || 0n);

                return (
                  <article className="drop-asset-card is-live" key={token.tokenId}>
                    <div className="token-registry-head">
                      <span className="token-logo">
                        <TokenLogo token={token} />
                      </span>
                      <div>
                        <strong>{token.symbol}</strong>
                        <small>{token.name}</small>
                      </div>
                    </div>
                    <div className="asset-stats">
                      <Stat label="Reward per NFTree" value={rewardPerNftree} />
                      <Stat label="Pool balance" value={poolBalance} />
                      <Stat label="Claims completed" value={claimsCompleted} />
                      <Stat label="Total paid out" value={totalPaid} />
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="future-assets">
              <strong>Not live in current drop</strong>
              <p>
                These registered tokens are outside the current live drop. Configured pools appear as claimable assets
                only after they are funded, opened, and eligible for the current round.
              </p>
              <div className="future-token-list">
                {futureDropRewardTokens.map((token) => (
                  <span key={token.tokenId}>{token.symbol}</span>
                ))}
              </div>
            </div>
          </section>
        </section>

        <section className="lower-grid" aria-label="Technical details">
          <article className="id-panel">
            <span>Details: Package</span>
            <button type="button" onClick={() => copy(CONFIG.packageId, "Package ID")}>
              {shortId(CONFIG.packageId)}
            </button>
          </article>
          <article className="id-panel">
            <span>Details: NFTree type</span>
            <button type="button" onClick={() => copy(CONFIG.nftreeType, "NFTree type")}>
              {shortId(CONFIG.nftreeType)}
            </button>
          </article>
        </section>

        <section className="ecosystem-links" aria-label="TREE ecosystem links">
          <div>
            <span>TREE ecosystem</span>
            <p>Helpful links for NFTree holders and community rewards.</p>
          </div>
          <div className="ecosystem-link-row">
            <a href={CONFIG.treeTokenUrl} target="_blank" rel="noreferrer">tree-token.net</a>
            <a href="https://nftree.net/" target="_blank" rel="noreferrer">nftree.net</a>
            <a href="https://nftree.net/battle" target="_blank" rel="noreferrer">Garden Battles</a>
          </div>
          <p className="ecosystem-note">
            SuiDex and Victory Token may be referenced when supported reward drops or community
            campaigns are available.
          </p>
        </section>
        </section>

        <section className={`tx-status ${txStatus.tone}`} aria-live="polite">
          <div>
            <span>{wallet?.name || network || "mainnet"}</span>
            <strong>{txStatus.label}</strong>
            <p>{txStatus.detail}</p>
          </div>
          {txStatus.digest ? (
            <a href={`https://suivision.xyz/txblock/${txStatus.digest}`} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : account?.address ? (
            <button type="button" onClick={() => copy(account.address, "Wallet address")}>
              {shortId(account.address)}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}















