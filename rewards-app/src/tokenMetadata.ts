import { rewardClient } from "./rewardClient";
import type { RegisteredRewardToken } from "./rewardTokens";

export type TokenMetadataDraft = {
  logoUrl?: string;
  projectUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  chartUrl?: string;
  notes?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
};

export type TokenMetadataResult = {
  metadata: TokenMetadataDraft;
  source: "registry" | "sui" | "fallback";
  message: string;
  diagnostics?: {
    hasRegistryLogo: boolean;
    hasSuiIconUrl: boolean;
    logoSource: "registry" | "sui" | "fallback";
  };
};

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanDecimals(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function registryMetadata(token: RegisteredRewardToken): TokenMetadataDraft {
  return {
    logoUrl: clean(token.logoUrl),
    projectUrl: clean(token.projectUrl),
    xUrl: clean(token.xUrl),
    telegramUrl: clean(token.telegramUrl),
    chartUrl: clean(token.chartUrl),
    notes: clean(token.notes),
    symbol: clean(token.symbol),
    name: clean(token.name),
    decimals: cleanDecimals(token.decimals),
  };
}

function mergeMetadataByPriority(
  token: RegisteredRewardToken,
  registry: TokenMetadataDraft,
  noodlesMetadata: TokenMetadataDraft,
  suiMetadata: TokenMetadataDraft,
) {
  const hasRegistryLogo = Boolean(registry.logoUrl);
  const hasSuiIconUrl = Boolean(suiMetadata.logoUrl);
  const logoSource: "registry" | "sui" | "fallback" = hasRegistryLogo ? "registry" : hasSuiIconUrl ? "sui" : "fallback";

  return {
    metadata: {
      logoUrl: registry.logoUrl || noodlesMetadata.logoUrl || suiMetadata.logoUrl,
      projectUrl: registry.projectUrl || noodlesMetadata.projectUrl,
      xUrl: registry.xUrl || noodlesMetadata.xUrl,
      telegramUrl: registry.telegramUrl || noodlesMetadata.telegramUrl,
      chartUrl: registry.chartUrl || noodlesMetadata.chartUrl,
      notes: registry.notes || noodlesMetadata.notes || suiMetadata.notes,
      symbol: registry.symbol || noodlesMetadata.symbol || suiMetadata.symbol,
      name: registry.name || noodlesMetadata.name || suiMetadata.name,
      decimals: suiMetadata.decimals ?? noodlesMetadata.decimals ?? registry.decimals,
    },
    diagnostics: {
      hasRegistryLogo,
      hasSuiIconUrl,
      logoSource,
    },
  };
}

async function fetchSuiCoinMetadata(token: RegisteredRewardToken, signal?: AbortSignal): Promise<TokenMetadataDraft> {
  const { coinMetadata: result } = await rewardClient.getCoinMetadata({ coinType: token.coinType, signal });
  if (!result) return {};

  return {
    logoUrl: clean(result.iconUrl),
    notes: clean(result.description),
    symbol: clean(result.symbol),
    name: clean(result.name),
    decimals: cleanDecimals(result.decimals),
  };
}

// TODO: Add a Netlify Function proxy for Noodles coin-detail metadata.
// Noodles requires x-api-key, so the browser must not call it directly with a secret.
async function fetchNoodlesCoinDetailMetadata(_token: RegisteredRewardToken, _signal?: AbortSignal): Promise<TokenMetadataDraft> {
  return {};
}

export async function hydrateRegisteredTokenMetadata(
  token: RegisteredRewardToken,
  signal?: AbortSignal,
): Promise<TokenMetadataResult> {
  const registry = registryMetadata(token);

  try {
    const [noodlesMetadata, suiMetadata] = await Promise.all([
      fetchNoodlesCoinDetailMetadata(token, signal),
      fetchSuiCoinMetadata(token, signal),
    ]);

    const merged = mergeMetadataByPriority(token, registry, noodlesMetadata, suiMetadata);
    const hasSuiMetadata = Boolean(suiMetadata.symbol || suiMetadata.name || suiMetadata.logoUrl || suiMetadata.notes);

    return {
      metadata: merged.metadata,
      source: hasSuiMetadata ? "sui" : "registry",
      message: hasSuiMetadata
        ? "Loaded registry values and public Sui coin metadata. Noodles enrichment needs a backend proxy because it requires an API key."
        : "Using TreeDrop registry values. Noodles enrichment needs a backend proxy because it requires an API key.",
      diagnostics: merged.diagnostics,
    };
  } catch {
    return {
      metadata: registry,
      source: Object.values(registry).some(Boolean) ? "registry" : "fallback",
      message: "Metadata lookup was unavailable, so the preview is using TreeDrop registry values and fallback badges.",
      diagnostics: {
        hasRegistryLogo: Boolean(registry.logoUrl),
        hasSuiIconUrl: false,
        logoSource: registry.logoUrl ? "registry" : "fallback",
      },
    };
  }
}

export function applyMetadataToRegisteredToken(
  token: RegisteredRewardToken,
  metadata: TokenMetadataDraft,
): RegisteredRewardToken {
  return {
    ...token,
    logoUrl: metadata.logoUrl || token.logoUrl,
    projectUrl: metadata.projectUrl || token.projectUrl,
    xUrl: metadata.xUrl || token.xUrl,
    telegramUrl: metadata.telegramUrl || token.telegramUrl,
    chartUrl: metadata.chartUrl || token.chartUrl,
    notes: metadata.notes || token.notes,
    symbol: metadata.symbol || token.symbol,
    name: metadata.name || token.name,
    decimals: metadata.decimals ?? token.decimals,
  };
}

