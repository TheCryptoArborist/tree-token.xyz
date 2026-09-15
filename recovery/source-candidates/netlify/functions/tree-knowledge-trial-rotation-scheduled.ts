import { createHash } from 'node:crypto';
import { rotatingTreeKnowledgeTrialRound } from '../lib/tree-knowledge-trial-core.ts';
import { TREE_RAFFLE_DAILY_PRIZE } from '../lib/tree-raffle-core.ts';
import {
  configuredSupabaseTreeKnowledgeTrialStore,
  type SupabaseTreeKnowledgeTrialStore,
} from '../lib/tree-knowledge-trial-supabase.ts';

type Environment = Record<string, string | undefined>;
type RotationStore = Pick<SupabaseTreeKnowledgeTrialStore, 'prepareDraft' | 'readDraftSetup' | 'scheduleRound'>;

const ENVIRONMENT_KEYS = [
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

export async function prepareDailyRotatingKnowledgeRound(input: {
  now?: Date;
  roundDate?: string;
  env?: Environment;
  store?: RotationStore;
} = {}) {
  const now = input.now || new Date();
  const roundDate = input.roundDate || new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const roundId = `knowledge:${roundDate}`;
  const store = input.store || configuredSupabaseTreeKnowledgeTrialStore(input.env || runtimeEnvironment());
  const existing = await store.readDraftSetup(roundId);
  const existingState = String(existing?.state || '');
  if (existingState && existingState !== 'draft') {
    return { status: 'unchanged', roundId, state: existingState };
  }
  if (existingState === 'draft' && !/-rotating-v[23]$/.test(String(existing?.questionSetVersion || ''))) {
    return { status: 'manual-review-required', roundId, state: existingState };
  }

  const rotation = rotatingTreeKnowledgeTrialRound(roundDate);
  const opensAt = new Date(`${roundDate}T00:00:00.000Z`);
  const closesAt = new Date(opensAt.getTime() + 86_400_000);
  const draft = {
    roundId,
    questionSetVersion: rotation.questionSetVersion,
    questions: rotation.questions,
    tiebreakQuestions: rotation.tiebreakQuestions,
    purchaseWindowOpensAt: opensAt.toISOString(),
    purchaseWindowClosesAt: closesAt.toISOString(),
    challengeOpensAt: opensAt.toISOString(),
    challengeClosesAt: closesAt.toISOString(),
    prizeTokenType: TREE_RAFFLE_DAILY_PRIZE.coinType,
    prizeAmountRaw: TREE_RAFFLE_DAILY_PRIZE.amountRaw,
  };
  const requestSha256 = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
  if (!existingState) await store.prepareDraft({ ...draft, requestSha256 });
  const scheduled = await store.scheduleRound(roundId);
  return {
    status: 'scheduled',
    roundId,
    state: String(scheduled.state || ''),
    questionSetVersion: rotation.questionSetVersion,
    bankVersion: rotation.bankVersion,
  };
}

export async function ensureCurrentAndNextKnowledgeRounds(input: {
  now?: Date;
  env?: Environment;
  store?: RotationStore;
} = {}) {
  const now = input.now || new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const nextDate = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const store = input.store || configuredSupabaseTreeKnowledgeTrialStore(input.env || runtimeEnvironment());
  const current = await prepareDailyRotatingKnowledgeRound({ ...input, now, store, roundDate: currentDate });
  const next = await prepareDailyRotatingKnowledgeRound({ ...input, now, store, roundDate: nextDate });
  return { current, next };
}

export default async () => {
  try {
    const result = await ensureCurrentAndNextKnowledgeRounds();
    console.log(JSON.stringify({ level: 'info', action: 'knowledge-rotation', ...result }));
    return Response.json({ status: 'ok', result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(JSON.stringify({ level: 'error', action: 'knowledge-rotation', message }));
    return Response.json({ status: 'error', error: 'knowledge-rotation-failed' }, { status: 500 });
  }
};

export const config = { schedule: '15 * * * *' };
