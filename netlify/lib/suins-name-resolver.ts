import { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeSuiAddress } from './leaderboard-provider.ts';

export const DEFAULT_SUINS_GRPC_URL = 'https://fullnode.mainnet.sui.io:443';
export const MAX_SUINS_NAMES_PER_REQUEST = 50;
export const DEFAULT_SUINS_CONCURRENCY = 8;

type NameServiceClient = {
  core: {
    defaultNameServiceName(input: { address: string }): Promise<{ name?: string | null }>;
  };
};

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
  client?: NameServiceClient;
  clientFactory?: (endpoint: string) => NameServiceClient;
  timeoutMs?: number;
  concurrency?: number;
  abortSignal?: AbortSignal;
  now?: () => number;
};

function safeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown SuiNS resolution error');
}

function isExpectedMissingName(error: unknown): boolean {
  const source = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {};
  if (source.code === 5 || source.status === 5 || source.code === 'NOT_FOUND' || source.status === 'NOT_FOUND') return true;
  const rawMessage = errorMessage(error).toLowerCase();
  let message = rawMessage;
  try { message = decodeURIComponent(rawMessage.replace(/\+/g, ' ')); } catch { /* Preserve the raw message. */ }
  return message.includes('not_found')
    || message.includes('not found')
    || message.includes('name has expired')
    || message.includes('name does not exist');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return Promise.reject(new Error('SuiNS resolution timed out.'));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SuiNS resolution timed out.')), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function resolveDefaultSuinsNames(
  addresses: string[],
  options: SuinsResolverOptions = {},
): Promise<SuinsResolutionResult> {
  const normalized = [...new Set(addresses.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)))]
    .slice(0, MAX_SUINS_NAMES_PER_REQUEST);
  const names = Object.fromEntries(normalized.map((address) => [address, null])) as Record<string, string | null>;
  const now = options.now ?? Date.now;
  const generatedAt = new Date(now()).toISOString();
  if (!normalized.length) {
    return { names, requestedCount: 0, resolvedCount: 0, complete: true, graphqlErrors: [], networkError: null, generatedAt };
  }

  const endpoint = options.endpoint || DEFAULT_SUINS_GRPC_URL;
  const client = options.client
    ?? options.clientFactory?.(endpoint)
    ?? new SuiGrpcClient({ network: 'mainnet', baseUrl: endpoint });
  const deadline = now() + Math.max(1_000, options.timeoutMs ?? 15_000);
  const concurrency = Math.max(1, Math.min(16, Math.trunc(options.concurrency ?? DEFAULT_SUINS_CONCURRENCY)));
  const unexpectedErrors: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < normalized.length) {
      if (options.abortSignal?.aborted) {
        unexpectedErrors.push('SuiNS resolution aborted.');
        return;
      }
      const current = cursor;
      cursor += 1;
      const address = normalized[current];
      try {
        const response = await withTimeout(
          client.core.defaultNameServiceName({ address }),
          deadline - now(),
        );
        names[address] = safeName(response?.name);
      } catch (error) {
        if (isExpectedMissingName(error)) {
          names[address] = null;
          continue;
        }
        unexpectedErrors.push(errorMessage(error));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, normalized.length) }, () => worker()));
  const uniqueErrors = [...new Set(unexpectedErrors)].slice(0, 10);
  const resolvedCount = Object.values(names).filter(Boolean).length;
  return {
    names,
    requestedCount: normalized.length,
    resolvedCount,
    complete: uniqueErrors.length === 0,
    graphqlErrors: uniqueErrors,
    networkError: uniqueErrors.length ? uniqueErrors[0] : null,
    generatedAt,
  };
}
