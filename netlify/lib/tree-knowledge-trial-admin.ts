import { createHash, timingSafeEqual } from 'node:crypto';
import {
  validateTreeKnowledgeQuestionSet,
  type TreeKnowledgeQuestion,
} from './tree-knowledge-trial-core.ts';
import { TREE_RAFFLE_DAILY_PRIZE } from './tree-raffle-core.ts';
import {
  configuredSupabaseTreeKnowledgeTrialStore,
  type SupabaseTreeKnowledgeTrialStore,
} from './tree-knowledge-trial-supabase.ts';

const MAX_BODY_BYTES = 131_072;
const DAY_MS = 86_400_000;
const MAX_ADVANCE_DAYS = 180;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const NETLIFY_PREVIEW_HOST = /^(?:deploy-preview-\d+|[a-f0-9]{24})--tree-token\.netlify\.app$/;

type Environment = Record<string, string | undefined>;
type AdminStore = Pick<SupabaseTreeKnowledgeTrialStore, 'prepareDraft' | 'readDraftSetup' | 'scheduleRound'>;

type Dependencies = {
  env?: Environment;
  store?: AdminStore;
  now?: () => Date;
};

export type TreeKnowledgeTrialDraft = {
  roundDate: string;
  roundId: string;
  questionSetVersion: string;
  questions: TreeKnowledgeQuestion[];
  tiebreakQuestions: TreeKnowledgeQuestion[];
  purchaseWindowOpensAt: string;
  purchaseWindowClosesAt: string;
  challengeOpensAt: string;
  challengeClosesAt: string;
  prizeTokenType: string;
  prizeAmountRaw: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function secretMatches(received: string, expected: string) {
  if (!received || expected.length < 32) return false;
  const left = createHash('sha256').update(received).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'https:' && (
      url.hostname === 'tree-token.xyz'
      || url.hostname === 'www.tree-token.xyz'
      || NETLIFY_PREVIEW_HOST.test(url.hostname)
    )) || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

function validDate(value: unknown) {
  const roundDate = typeof value === 'string' ? value.trim() : '';
  if (!DATE_PATTERN.test(roundDate)) throw new Error('invalid-round-date');
  const start = new Date(`${roundDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== roundDate) {
    throw new Error('invalid-round-date');
  }
  return { roundDate, start };
}

async function requestBody(request: Request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new Error('request-too-large');
  const bodyText = await request.text();
  if (!bodyText || bodyText.length > MAX_BODY_BYTES) throw new Error('invalid-request');
  const body: unknown = JSON.parse(bodyText);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid-request');
  return body as Record<string, unknown>;
}

export function validateTreeKnowledgeTrialDraft(value: unknown, now = new Date()): TreeKnowledgeTrialDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-request');
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  if (keys.join(',') !== 'questions,roundDate,tiebreakQuestions') throw new Error('invalid-request');
  const { roundDate, start } = validDate(body.roundDate);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (start.getTime() < today.getTime()) throw new Error('round-date-in-past');
  if (start.getTime() > today.getTime() + MAX_ADVANCE_DAYS * DAY_MS) throw new Error('round-date-too-far');

  const questions = validateTreeKnowledgeQuestionSet(body.questions, 5);
  if (!Array.isArray(body.tiebreakQuestions)
      || body.tiebreakQuestions.length < 3
      || body.tiebreakQuestions.length > 10) {
    throw new Error('invalid-tiebreak-question-count');
  }
  const tiebreakQuestions = validateTreeKnowledgeQuestionSet(
    body.tiebreakQuestions,
    body.tiebreakQuestions.length,
  );
  const allIds = [...questions, ...tiebreakQuestions].map(({ id }) => id);
  if (new Set(allIds).size !== allIds.length) throw new Error('duplicate-question-id');

  const closesAt = new Date(start.getTime() + DAY_MS).toISOString();
  return {
    roundDate,
    roundId: `knowledge:${roundDate}`,
    questionSetVersion: `knowledge-${roundDate}-v1`,
    questions,
    tiebreakQuestions,
    purchaseWindowOpensAt: start.toISOString(),
    purchaseWindowClosesAt: closesAt,
    challengeOpensAt: start.toISOString(),
    challengeClosesAt: closesAt,
    prizeTokenType: TREE_RAFFLE_DAILY_PRIZE.coinType,
    prizeAmountRaw: TREE_RAFFLE_DAILY_PRIZE.amountRaw,
  };
}

function setupSummary(value: Record<string, unknown> | null) {
  if (value === null) return null;
  const state = String(value.state || '');
  const dailyQuestionCount = Number(value.dailyQuestionCount || 0);
  const tiebreakQuestionCount = Number(value.tiebreakQuestionCount || 0);
  return {
    roundId: String(value.roundId || ''),
    state,
    questionSetVersion: String(value.questionSetVersion || ''),
    dailyQuestionCount,
    tiebreakQuestionCount,
    durationSeconds: Number(value.durationSeconds || 0),
    minimumQualifyingUsdCents: Number(value.minimumQualifyingUsdCents || 0),
    purchaseWindowOpensAt: value.purchaseWindowOpensAt || null,
    purchaseWindowClosesAt: value.purchaseWindowClosesAt || null,
    challengeOpensAt: value.challengeOpensAt || null,
    challengeClosesAt: value.challengeClosesAt || null,
    prizeAmountRaw: String(value.prizeAmountRaw || ''),
    readyForReview: value.readyForReview === true
      || (state === 'draft' && dailyQuestionCount === 5 && tiebreakQuestionCount >= 3),
    lastPreparedAt: value.lastPreparedAt || value.preparedAt || null,
    scheduledAt: value.scheduledAt || null,
  };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/Only a reviewed draft|Only a draft|five daily|sudden-death|question IDs|invalid|past|too far|does not exist|not ready|already closed|overlaps/i.test(message)) return message;
  return 'The Challenge draft could not be prepared.';
}

export function createTreeKnowledgeTrialAdminHandler(dependencies: Dependencies = {}) {
  return async (request: Request) => {
    if (!allowedOrigin(request)) return json({ status: 'error', error: 'origin-not-allowed' }, 403);
    const env = dependencies.env || process.env;
    const configuredSecret = env.TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET?.trim() || '';
    if (configuredSecret.length < 32) {
      return json({ status: 'disabled', error: 'challenge-admin-not-configured' }, 503);
    }
    if (!secretMatches(request.headers.get('x-tree-knowledge-admin-secret') || '', configuredSecret)) {
      return json({ status: 'error', error: 'unauthorized' }, 401);
    }
    const store = dependencies.store || configuredSupabaseTreeKnowledgeTrialStore(env);
    const url = new URL(request.url);

    try {
      if (request.method === 'GET') {
        const { roundDate } = validDate(url.searchParams.get('roundDate'));
        const setup = await store.readDraftSetup(`knowledge:${roundDate}`);
        return json({ status: 'ok', setup: setupSummary(setup) });
      }
      if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
      const body = await requestBody(request);
      if (body.action === 'schedule') {
        const keys = Object.keys(body).sort().join(',');
        if (keys !== 'action,reviewConfirmed,roundDate' || body.reviewConfirmed !== true) {
          throw new Error('invalid-review-confirmation');
        }
        const { roundDate } = validDate(body.roundDate);
        const scheduled = await store.scheduleRound(`knowledge:${roundDate}`);
        return json({ status: 'ok', setup: setupSummary(scheduled) });
      }
      const draft = validateTreeKnowledgeTrialDraft(body, dependencies.now?.() || new Date());
      const requestSha256 = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
      const prepared = await store.prepareDraft({ ...draft, requestSha256 });
      return json({ status: 'ok', setup: setupSummary(prepared) });
    } catch (error) {
      console.error('TREE Knowledge Trial admin request failed', error instanceof Error ? error.message : 'unknown');
      const message = safeError(error);
      const status = /invalid|past|too far|requires|question/i.test(message) ? 400 : 409;
      return json({ status: 'error', error: 'challenge-draft-failed', message }, status);
    }
  };
}
