import { treeKnowledgeTrialStatus } from '../lib/tree-knowledge-trial-core.ts';
import { configuredSupabaseTreeKnowledgeTrialStore } from '../lib/tree-knowledge-trial-supabase.ts';

type Environment = Record<string, string | undefined>;
type ResolverStore = {
  publicSnapshot(): Promise<{ round: Record<string, unknown> | null }>;
  resolveRound(roundId: string): Promise<Record<string, unknown>>;
};

const ENVIRONMENT_KEYS = [
  'TREE_KNOWLEDGE_TRIAL_ENABLED',
  'TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED',
  'TREE_KNOWLEDGE_TRIAL_DATABASE_READY',
  'TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY',
  'TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_SUPABASE_URL',
  'TREE_RAFFLE_SUPABASE_SECRET_KEY',
] as const;

function runtimeEnvironment(): Environment {
  const netlify = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get?: (name: string) => string | undefined } };
  }).Netlify;
  return Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [
    key,
    netlify?.env?.get?.(key) ?? process.env[key],
  ]));
}

export function createTreeKnowledgeTrialResolver(dependencies: {
  env?: Environment;
  store?: ResolverStore;
  now?: () => Date;
} = {}) {
  return async () => {
    const env = dependencies.env || runtimeEnvironment();
    const status = treeKnowledgeTrialStatus(env);
    if (!status.publicAttemptsEnabled) {
      return Response.json({ status: 'skipped', reason: 'knowledge-trial-not-active' });
    }
    const store = dependencies.store || configuredSupabaseTreeKnowledgeTrialStore(env);
    const snapshot = await store.publicSnapshot();
    const round = snapshot.round;
    const roundId = typeof round?.roundId === 'string' ? round.roundId : '';
    const state = typeof round?.state === 'string' ? round.state : '';
    const closesAt = typeof round?.challengeClosesAt === 'string' ? Date.parse(round.challengeClosesAt) : Number.NaN;
    const now = (dependencies.now?.() || new Date()).getTime();
    if (!roundId || !['open', 'closed', 'tiebreak'].includes(state) || !Number.isFinite(closesAt) || now < closesAt) {
      return Response.json({ status: 'skipped', reason: 'no-round-ready-to-resolve' });
    }
    const resolution = await store.resolveRound(roundId);
    return Response.json({ status: 'ok', roundId, resolution });
  };
}

export default createTreeKnowledgeTrialResolver();

export const config = { schedule: '5 * * * *' };
