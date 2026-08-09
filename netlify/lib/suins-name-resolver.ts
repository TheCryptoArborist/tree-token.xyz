import { normalizeSuiAddress } from './leaderboard-provider.ts';

export const DEFAULT_SUINS_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
export const MAX_SUINS_NAMES_PER_REQUEST = 50;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type SuinsResolutionResult = {
  names: Record<string, string | null>;
  requestedCount: number;
  resolvedCount: number;
  complete: boolean;
  graphqlErrors: string[];
  networkError: string | null;
  generatedAt: string;
};

export type SuinsResolverOptions = {
  endpoint?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function safeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function graphqlErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const message = record(item).message;
    return typeof message === 'string' && message ? message : 'Unknown SuiNS GraphQL error';
  });
}

export function buildDefaultSuinsQuery(addresses: string[]) {
  const definitions = addresses.map((_, index) => `$address${index}: SuiAddress!`).join(', ');
  const fields = addresses.map((_, index) => `name${index}: address(address: $address${index}) { defaultSuinsName }`).join('\n');
  const variables = Object.fromEntries(addresses.map((address, index) => [`address${index}`, address]));
  return {
    query: `query ResolveDefaultSuinsNames(${definitions}) {\n${fields}\n}`,
    variables,
  };
}

export async function resolveDefaultSuinsNames(
  addresses: string[],
  options: SuinsResolverOptions = {},
): Promise<SuinsResolutionResult> {
  const normalized = [...new Set(addresses.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)))]
    .slice(0, MAX_SUINS_NAMES_PER_REQUEST);
  const names = Object.fromEntries(normalized.map((address) => [address, null])) as Record<string, string | null>;
  const generatedAt = new Date().toISOString();
  if (!normalized.length) {
    return { names, requestedCount: 0, resolvedCount: 0, complete: true, graphqlErrors: [], networkError: null, generatedAt };
  }

  const endpoint = options.endpoint || DEFAULT_SUINS_GRAPHQL_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  options.abortSignal?.addEventListener('abort', externalAbort, { once: true });
  if (options.abortSignal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, options.timeoutMs ?? 12_000));
  let networkError: string | null = null;
  let errors: string[] = [];

  try {
    const body = buildDefaultSuinsQuery(normalized);
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      networkError = `SuiNS GraphQL returned HTTP ${response.status}`;
    } else {
      const payload = record(await response.json());
      errors = graphqlErrors(payload.errors);
      const data = record(payload.data);
      normalized.forEach((address, index) => {
        names[address] = safeName(record(data[`name${index}`]).defaultSuinsName);
      });
    }
  } catch (error) {
    networkError = controller.signal.aborted
      ? 'SuiNS resolution timed out.'
      : error instanceof Error ? error.message : 'SuiNS resolution failed.';
  } finally {
    clearTimeout(timeout);
    options.abortSignal?.removeEventListener('abort', externalAbort);
  }

  const resolvedCount = Object.values(names).filter(Boolean).length;
  return {
    names,
    requestedCount: normalized.length,
    resolvedCount,
    complete: !networkError && errors.length === 0,
    graphqlErrors: errors,
    networkError,
    generatedAt,
  };
}
