from pathlib import Path

resolver = Path('netlify/lib/suins-name-resolver.ts')
resolver.write_text("""import { SuiGrpcClient } from '@mysten/sui/grpc';
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
  if (!name || name.length > 255 || /[\\u0000-\\u001f\\u007f]/.test(name)) return null;
  return name;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown SuiNS resolution error');
}

function isExpectedMissingName(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
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
""", encoding='utf-8')

preview = Path('netlify/functions/tree-leaderboard-preview.ts')
text = preview.read_text(encoding='utf-8')
text = text.replace("provider: 'sui-graphql-default-suins-name'", "provider: 'sui-grpc-default-suins-name'")
text = text.replace(
    "}, 200, 'public, max-age=120, s-maxage=300');",
    "}, 200, resolution.complete ? 'public, max-age=120, s-maxage=300' : 'no-store');",
)
preview.write_text(text, encoding='utf-8')

worker = Path('netlify/lib/leaderboard-background-worker.ts')
text = worker.read_text(encoding='utf-8')
text = text.replace(
    "const resolution = await resolveSuins(result.entries.map((entry) => entry.wallet), { endpoint: config.endpoint });",
    "const resolution = await resolveSuins(result.entries.map((entry) => entry.wallet));",
)
worker.write_text(text, encoding='utf-8')

resolver_test = Path('tests/suins-name-resolver.test.ts')
resolver_test.write_text("""import assert from 'node:assert/strict';
import { resolveDefaultSuinsNames } from '../netlify/lib/suins-name-resolver.ts';

const first = `0x${'a'.repeat(64)}`;
const second = `0x${'b'.repeat(64)}`;
const third = `0x${'c'.repeat(64)}`;
let calls = 0;
const success = await resolveDefaultSuinsNames([first, second, third, first, 'invalid'], {
  client: {
    core: {
      async defaultNameServiceName({ address }) {
        calls += 1;
        if (address === first) return { name: 'cryptoarborist.sui' };
        if (address === second) throw new Error('NOT_FOUND');
        throw new Error('name has expired');
      },
    },
  },
});
assert.equal(calls, 3);
assert.equal(success.requestedCount, 3);
assert.equal(success.resolvedCount, 1);
assert.equal(success.names[first], 'cryptoarborist.sui');
assert.equal(success.names[second], null);
assert.equal(success.names[third], null);
assert.equal(success.complete, true);

const failed = await resolveDefaultSuinsNames([first], {
  client: { core: { async defaultNameServiceName() { throw new Error('transport unavailable'); } } },
});
assert.equal(failed.complete, false);
assert.match(failed.networkError || '', /transport unavailable/);

let active = 0;
let peak = 0;
await resolveDefaultSuinsNames([first, second, third], {
  concurrency: 2,
  client: {
    core: {
      async defaultNameServiceName() {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { name: null };
      },
    },
  },
});
assert.ok(peak <= 2);
console.log('SuiNS gRPC resolver: PASS (deduplication, expected missing names, bounded concurrency, and safe failure)');
""", encoding='utf-8')

preview_test = Path('tests/leaderboard-preview-function.test.ts')
text = preview_test.read_text(encoding='utf-8').replace(
    "provider: 'sui-graphql-default-suins-name'",
    "provider: 'sui-grpc-default-suins-name'",
)
preview_test.write_text(text, encoding='utf-8')
