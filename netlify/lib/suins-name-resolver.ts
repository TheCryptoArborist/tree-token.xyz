import { normalizeSuiAddress } from './leaderboard-provider.ts';

export const DEFAULT_SUINS_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
export const MAX_SUINS_NAMES_PER_REQUEST = 50;
export const MAX_SUINS_NAMES_PER_GRAPHQL_BATCH = 20;
export const DEFAULT_SUINS_CONCURRENCY = 8;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;
type NameServiceClient = {
  core: {
    defaultNameServiceName(input: { address: string }): Promise<{ name?: string | null }>;
  };
  nameService?: {
    reverseLookupName(input: { address: string }): Promise<{ response?: { record?: { name?: string | null } } }>;
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
  fetchImpl?: FetchLike;
  client?: NameServiceClient;
  clientFactory?: (endpoint: string) => NameServiceClient;
  timeoutMs?: number;
  concurrency?: number;
  abortSignal?: AbortSignal;
  now?: () => number;
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

function graphqlErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const message = record(item).message;
    return typeof message === 'string' && message ? message : 'Unknown SuiNS GraphQL error';
  });
}

export function buildDefaultSuinsQuery(addresses: string[]) {
  const definitions = addresses.map((_, index) => `$address${index}: SuiAddress!`).join(', ');
  const fields = addresses
    .map((_, index) => `name${index}: address(address: $address${index}) { defaultNameRecord { domain } }`)
    .join('\n');
  return {
    query: `query ResolveDefaultSuinsNames(${definitions}) {\n${fields}\n}`,
    variables: Object.fromEntries(addresses.map((address, index) => [`address${index}`, address])),
  };
}

async function resolveWithGraphql(
  normalized: string[],
  names: Record<string, string | null>,
  options: SuinsResolverOptions,
) {
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  options.abortSignal?.addEventListener('abort', externalAbort, { once: true });
  if (options.abortSignal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, options.timeoutMs ?? 15_000));
  let networkError: string | null = null;
  const errors: string[] = [];

  try {
    const batches = Array.from(
      { length: Math.ceil(normalized.length / MAX_SUINS_NAMES_PER_GRAPHQL_BATCH) },
      (_, index) => normalized.slice(
        index * MAX_SUINS_NAMES_PER_GRAPHQL_BATCH,
        (index + 1) * MAX_SUINS_NAMES_PER_GRAPHQL_BATCH,
      ),
    );
    const results = await Promise.all(batches.map(async (batch) => {
      const response = await (options.fetchImpl || fetch)(options.endpoint || DEFAULT_SUINS_GRAPHQL_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDefaultSuinsQuery(batch)),
        signal: controller.signal,
      });
      if (!response.ok) return { errors: [] as string[], networkError: `SuiNS GraphQL returned HTTP ${response.status}` };
      const payload = record(await response.json());
      const batchErrors = graphqlErrors(payload.errors);
      const data = record(payload.data);
      batch.forEach((address, index) => {
        const nameRecord = record(record(data[`name${index}`]).defaultNameRecord);
        names[address] = safeName(nameRecord.domain);
      });
      return { errors: batchErrors, networkError: null as string | null };
    }));
    results.forEach((result) => {
      errors.push(...result.errors);
      networkError ||= result.networkError;
    });
  } catch (error) {
    networkError = controller.signal.aborted
      ? 'SuiNS resolution timed out.'
      : errorMessage(error);
  } finally {
    clearTimeout(timeout);
    options.abortSignal?.removeEventListener('abort', externalAbort);
  }
  return { errors, networkError };
}

async function resolveWithInjectedClient(
  normalized: string[],
  names: Record<string, string | null>,
  options: SuinsResolverOptions,
) {
  const now = options.now ?? Date.now;
  const client = options.client ?? options.clientFactory?.(options.endpoint || DEFAULT_SUINS_GRAPHQL_URL);
  if (!client) return { errors: ['SuiNS client is unavailable.'], networkError: 'SuiNS client is unavailable.' };
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
        const response = await withTimeout(client.core.defaultNameServiceName({ address }), deadline - now());
        let name = safeName(response?.name);
        if (!name && client.nameService?.reverseLookupName) {
          const reverse = await withTimeout(client.nameService.reverseLookupName({ address }), deadline - now());
          name = safeName(reverse?.response?.record?.name);
        }
        names[address] = name;
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
  const errors = [...new Set(unexpectedErrors)].slice(0, 10);
  return { errors, networkError: errors[0] || null };
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

  const result = options.client || options.clientFactory
    ? await resolveWithInjectedClient(normalized, names, options)
    : await resolveWithGraphql(normalized, names, options);
  const resolvedCount = Object.values(names).filter(Boolean).length;
  const errors = [...result.errors];
  if (normalized.length >= 10 && resolvedCount === 0 && errors.length === 0 && !result.networkError) {
    errors.push(`SuiNS reverse lookup returned zero names for ${normalized.length} addresses.`);
  }
  const uniqueErrors = [...new Set(errors)].slice(0, 10);
  const networkError = result.networkError || uniqueErrors[0] || null;
  return {
    names,
    requestedCount: normalized.length,
    resolvedCount,
    complete: !networkError && uniqueErrors.length === 0,
    graphqlErrors: uniqueErrors,
    networkError,
    generatedAt,
  };
}
