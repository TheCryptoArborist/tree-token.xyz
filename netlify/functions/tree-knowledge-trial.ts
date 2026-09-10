import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import {
  publicTreeKnowledgeQuestions,
  scoreTreeKnowledgeTrial,
  scoreTreeKnowledgeTrialAgainst,
  treeKnowledgeTrialStatus,
  validateTreeKnowledgeQuestionSet,
  TREE_KNOWLEDGE_TRIAL_QUESTION_SET,
} from '../lib/tree-knowledge-trial-core.ts';
import {
  configuredSupabaseTreeKnowledgeTrialStore,
  type SupabaseTreeKnowledgeTrialStore,
} from '../lib/tree-knowledge-trial-supabase.ts';

const MAX_BODY_BYTES = 16_384;
const NETLIFY_PREVIEW_HOST = /^(?:deploy-preview-\d+|[a-f0-9]{24})--tree-token\.netlify\.app$/;
const SUI_WALLET = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;
const ROUND_ID = /^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^[A-Za-z0-9+/_=-]{40,2048}$/;
const TOKEN = /^[0-9a-f]{64}$/;

type Environment = Record<string, string | undefined>;
type TrialStore = Pick<SupabaseTreeKnowledgeTrialStore,
  'publicSnapshot' | 'createChallenge' | 'readChallenge' | 'consumeChallenge'
  | 'issuePass' | 'startAttempt' | 'readAttempt' | 'questionSet' | 'submitAttempt'
  | 'createTiebreakChallenge' | 'readTiebreakChallenge' | 'consumeTiebreakChallenge'
  | 'startTiebreakAttempt' | 'readTiebreakAttempt' | 'tiebreakQuestion' | 'submitTiebreakAttempt'>;

type HandlerDependencies = {
  env?: Environment;
  store?: TrialStore;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
  verifySignature?: (message: Uint8Array, signature: string, wallet: string) => Promise<void>;
  requestIp?: (context: unknown) => string;
};

const ENVIRONMENT_KEYS = [
  'TREE_KNOWLEDGE_TRIAL_ENABLED',
  'TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED',
  'TREE_KNOWLEDGE_TRIAL_DATABASE_READY',
  'TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY',
  'TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY',
  'TREE_KNOWLEDGE_TRIAL_CLAIMS_ENABLED',
  'TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_SUPABASE_URL',
  'TREE_RAFFLE_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_PACKAGE_ID',
  'TREE_RAFFLE_PRIZE_POOL_ID',
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

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
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

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new Error('request-too-large');
  const bodyText = await request.text();
  if (!bodyText || bodyText.length > MAX_BODY_BYTES) throw new Error('invalid-request');
  const value: unknown = JSON.parse(bodyText);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-request');
  return value as Record<string, unknown>;
}

function normalizedWallet(value: unknown) {
  const wallet = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SUI_WALLET.test(wallet)) throw new Error('invalid-wallet');
  return wallet;
}

function roundId(value: unknown) {
  if (typeof value !== 'string' || !ROUND_ID.test(value)) throw new Error('invalid-round');
  return value;
}

function randomHex(bytes: number) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requestFingerprint(secret: string, ip: string) {
  if (secret.length < 32) throw new Error('rate-limit-secret-not-configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip || 'unknown'));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/qualifying TREE purchase|not accepting|no qualifying Challenge Pass|expired|already used|too many|sudden-death|not eligible/i.test(message)) return message;
  return 'The Knowledge Trial could not complete this request.';
}

type PublicTiebreakQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
};

function publicTiebreakQuestion(value: unknown): PublicTiebreakQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-sudden-death-question');
  const question = value as Record<string, unknown>;
  const id = typeof question.id === 'string' ? question.id.trim() : '';
  const prompt = typeof question.prompt === 'string' ? question.prompt.trim() : '';
  if (!id || id.length > 96 || !prompt || prompt.length > 500 || !Array.isArray(question.options)) {
    throw new Error('invalid-sudden-death-question');
  }
  const options = question.options.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-sudden-death-question');
    const option = value as Record<string, unknown>;
    const optionId = typeof option.id === 'string' ? option.id.trim() : '';
    const label = typeof option.label === 'string' ? option.label.trim() : '';
    if (!optionId || optionId.length > 64 || !label || label.length > 300) throw new Error('invalid-sudden-death-question');
    return { id: optionId, label };
  });
  if (options.length < 2 || options.length > 8 || new Set(options.map(({ id: optionId }) => optionId)).size !== options.length) {
    throw new Error('invalid-sudden-death-question');
  }
  return { id, prompt, options };
}

export function createTreeKnowledgeTrialHandler(dependencies: HandlerDependencies = {}) {
  return async (request: Request, context?: unknown) => {
    if (!allowedOrigin(request)) return json({ status: 'error', error: 'origin-not-allowed' }, 403);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';
    const env = dependencies.env || runtimeEnvironment();
    const trial = treeKnowledgeTrialStatus(env);
    const getStore = () => dependencies.store || configuredSupabaseTreeKnowledgeTrialStore(env);

    if (request.method === 'GET' && action === 'status') {
      let publicRound: unknown = null;
      let leaderboard: unknown[] = [];
      let submissionCount = 0;
      if (trial.activation.databaseReady) {
        try {
          const snapshot = await getStore().publicSnapshot();
          publicRound = snapshot.round;
          leaderboard = snapshot.leaderboard;
          submissionCount = snapshot.submissionCount;
        } catch (error) {
          console.error('TREE Knowledge Trial snapshot failed', error);
        }
      }
      return json({
        status: 'ok',
        generatedAt: new Date().toISOString(),
        trial,
        contracts: {
          packageId: env.TREE_RAFFLE_PACKAGE_ID || null,
          poolId: env.TREE_RAFFLE_PRIZE_POOL_ID || null,
        },
        plannedPrize: { symbol: 'TREE', amount: '50,000', cadence: 'daily', winnerCount: 1 },
        practice: { questionSetVersion: TREE_KNOWLEDGE_TRIAL_QUESTION_SET, questions: publicTreeKnowledgeQuestions() },
        publicRound,
        leaderboard,
        submissionCount,
      });
    }

    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);

    if (action === 'practice-submit') {
      try {
        const body = await requestBody(request);
        const answers = Array.isArray(body.answers) ? body.answers : [];
        const score = scoreTreeKnowledgeTrial(answers as Array<{ questionId: string; optionId: string }>, Number(body.elapsedMs));
        return json({ status: 'ok', practice: true, score });
      } catch {
        return json({ status: 'error', error: 'invalid-practice-submission' }, 400);
      }
    }

    if (!['challenge', 'start', 'submit', 'tiebreak-challenge', 'tiebreak-start', 'tiebreak-submit'].includes(action)) {
      return json({ status: 'error', error: 'unknown-action' }, 400);
    }
    if (!trial.publicAttemptsEnabled) {
      return json({
        status: 'disabled',
        error: 'knowledge-trial-not-active',
        message: 'Public Challenge Passes and scored attempts remain disabled while the rules and production ledger are completed.',
      }, 503);
    }

    try {
      const body = await requestBody(request);
      const store = getStore();
      const now = dependencies.now?.() || new Date();
      const createRandomHex = dependencies.randomHex || randomHex;

      if (action === 'tiebreak-challenge') {
        const wallet = normalizedWallet(body.wallet);
        const selectedRoundId = roundId(body.roundId);
        const stage = Number(body.stage);
        if (!Number.isInteger(stage) || stage < 1 || stage > 100) throw new Error('invalid-sudden-death-stage');
        const nonce = createRandomHex(24);
        const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
        const message = [
          'TREE Knowledge Trial',
          `Action: Start sudden-death stage ${stage}`,
          `Wallet: ${wallet}`,
          `Round: ${selectedRoundId}`,
          `Stage: ${stage}`,
          `Nonce: ${nonce}`,
          `Expires: ${expiresAt}`,
          'This signature does not authorize a transaction or move funds.',
        ].join('\n');
        const rateSecret = env.TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET || '';
        const ip = dependencies.requestIp?.(context)
          || String((context as { ip?: string } | undefined)?.ip || 'unknown');
        const challenge = await store.createTiebreakChallenge({
          roundId: selectedRoundId,
          wallet,
          nonceSha256: await sha256Hex(nonce),
          message,
          requestFingerprint: await requestFingerprint(rateSecret, ip),
          expiresAt,
        });
        return json({
          status: 'ok',
          challenge: {
            challengeId: challenge.challengeId,
            roundId: challenge.roundId,
            wallet: challenge.wallet,
            stage: challenge.stage,
            message: challenge.message,
            expiresAt: challenge.expiresAt,
          },
        });
      }

      if (action === 'tiebreak-start') {
        const wallet = normalizedWallet(body.wallet);
        const challengeId = typeof body.challengeId === 'string' && UUID.test(body.challengeId) ? body.challengeId : null;
        const signature = typeof body.signature === 'string' && SIGNATURE.test(body.signature) ? body.signature : null;
        if (!challengeId || !signature) throw new Error('invalid-wallet-authorization');
        const challenge = await store.readTiebreakChallenge(challengeId);
        if (challenge.wallet !== wallet || challenge.consumed || new Date(challenge.expiresAt).getTime() <= now.getTime()) {
          throw new Error('The sudden-death wallet challenge is invalid, expired, or already used.');
        }
        const verify = dependencies.verifySignature || (async (message: Uint8Array, signed: string, address: string) => {
          await verifyPersonalMessageSignature(message, signed, { address });
        });
        await verify(new TextEncoder().encode(challenge.message), signature, wallet);
        const consumed = await store.consumeTiebreakChallenge(
          challengeId,
          wallet,
          challenge.roundId,
          challenge.stage,
        );
        const attemptToken = createRandomHex(32);
        const attempt = await store.startTiebreakAttempt(
          consumed.roundId,
          wallet,
          consumed.stage,
          await sha256Hex(attemptToken),
        );
        const question = publicTiebreakQuestion(await store.tiebreakQuestion(attempt.roundId, attempt.stage));
        return json({
          status: 'ok',
          attempt: {
            attemptId: attempt.attemptId,
            roundId: attempt.roundId,
            stage: attempt.stage,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            attemptToken,
            questions: [question],
          },
        });
      }

      if (action === 'tiebreak-submit') {
        const attemptToken = typeof body.attemptToken === 'string' && TOKEN.test(body.attemptToken) ? body.attemptToken : null;
        if (!attemptToken || !Array.isArray(body.answers) || body.answers.length !== 1) {
          throw new Error('invalid-sudden-death-submission');
        }
        const tokenSha256 = await sha256Hex(attemptToken);
        const attempt = await store.readTiebreakAttempt(tokenSha256);
        if (attempt.submitted) return json({ status: 'error', error: 'attempt-already-submitted' }, 409);
        const question = publicTiebreakQuestion(await store.tiebreakQuestion(attempt.roundId, attempt.stage));
        const answer = body.answers[0] as Record<string, unknown>;
        const questionId = typeof answer?.questionId === 'string' ? answer.questionId : '';
        const optionId = typeof answer?.optionId === 'string' ? answer.optionId : '';
        if (questionId !== question.id || !question.options.some((option) => option.id === optionId)) {
          throw new Error('invalid-sudden-death-submission');
        }
        const recorded = await store.submitTiebreakAttempt(tokenSha256, optionId);
        return json({
          status: 'ok',
          result: {
            outcome: recorded.outcome,
            correctCount: recorded.correct === true ? 1 : 0,
            totalQuestions: 1,
            elapsedMs: Number(recorded.elapsedMs),
            stage: Number(recorded.stage),
          },
        });
      }

      if (action === 'challenge') {
        const wallet = normalizedWallet(body.wallet);
        const selectedRoundId = roundId(body.roundId);
        let qualifyingTxDigest: string | null = null;
        if (body.qualifyingTxDigest != null && body.qualifyingTxDigest !== '') {
          if (typeof body.qualifyingTxDigest !== 'string' || !SUI_DIGEST.test(body.qualifyingTxDigest)) {
            throw new Error('invalid-transaction-digest');
          }
          qualifyingTxDigest = body.qualifyingTxDigest;
        }
        const nonce = createRandomHex(24);
        const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
        const prefix = [
          'TREE Knowledge Trial',
          'Action: Start one scored challenge attempt',
          `Wallet: ${wallet}`,
          `Round: ${selectedRoundId}`,
          `Nonce: ${nonce}`,
          `Expires: ${expiresAt}`,
          'This signature does not authorize a transaction or move funds.',
        ].join('\n');
        const rateSecret = env.TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET || '';
        const ip = dependencies.requestIp?.(context)
          || String((context as { ip?: string } | undefined)?.ip || 'unknown');
        const challenge = await store.createChallenge({
          roundId: selectedRoundId,
          wallet,
          qualifyingTxDigest,
          nonceSha256: await sha256Hex(nonce),
          messagePrefix: prefix,
          requestFingerprint: await requestFingerprint(rateSecret, ip),
          expiresAt,
        });
        return json({
          status: 'ok',
          challenge: {
            challengeId: challenge.challengeId,
            roundId: challenge.roundId,
            wallet: challenge.wallet,
            message: challenge.message,
            expiresAt: challenge.expiresAt,
          },
        });
      }

      if (action === 'start') {
        const wallet = normalizedWallet(body.wallet);
        const challengeId = typeof body.challengeId === 'string' && UUID.test(body.challengeId) ? body.challengeId : null;
        const signature = typeof body.signature === 'string' && SIGNATURE.test(body.signature) ? body.signature : null;
        if (!challengeId || !signature) throw new Error('invalid-wallet-authorization');
        const challenge = await store.readChallenge(challengeId);
        if (challenge.wallet !== wallet || challenge.consumed || new Date(challenge.expiresAt).getTime() <= now.getTime()) {
          throw new Error('The wallet challenge is invalid, expired, or already used.');
        }
        const verify = dependencies.verifySignature || (async (message: Uint8Array, signed: string, address: string) => {
          await verifyPersonalMessageSignature(message, signed, { address });
        });
        await verify(new TextEncoder().encode(challenge.message), signature, wallet);
        const consumed = await store.consumeChallenge(challengeId, wallet, challenge.roundId);
        await store.issuePass(challenge.roundId, wallet, consumed.qualifyingTxDigest);
        const attemptToken = createRandomHex(32);
        const attempt = await store.startAttempt(challenge.roundId, wallet, await sha256Hex(attemptToken));
        if (attempt.submitted) return json({ status: 'error', error: 'attempt-already-submitted' }, 409);
        if (new Date(attempt.expiresAt).getTime() <= now.getTime()) return json({ status: 'error', error: 'attempt-expired' }, 409);
        const questions = validateTreeKnowledgeQuestionSet(await store.questionSet(attempt.questionSetVersion));
        return json({
          status: 'ok',
          attempt: {
            attemptId: attempt.attemptId,
            roundId: attempt.roundId,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            attemptToken,
            questions: publicTreeKnowledgeQuestions(questions),
          },
        });
      }

      const attemptToken = typeof body.attemptToken === 'string' && TOKEN.test(body.attemptToken) ? body.attemptToken : null;
      if (!attemptToken || !Array.isArray(body.answers)) throw new Error('invalid-attempt-submission');
      const tokenSha256 = await sha256Hex(attemptToken);
      const attempt = await store.readAttempt(tokenSha256);
      if (attempt.submitted) return json({ status: 'error', error: 'attempt-already-submitted' }, 409);
      const questions = validateTreeKnowledgeQuestionSet(await store.questionSet(attempt.questionSetVersion));
      const score = scoreTreeKnowledgeTrialAgainst(
        questions,
        body.answers as Array<{ questionId: string; optionId: string }>,
        0,
      );
      const recorded = await store.submitAttempt(tokenSha256, score.answers, score.correctCount);
      return json({
        status: 'ok',
        result: {
          outcome: recorded.outcome,
          correctCount: Number(recorded.correctCount),
          totalQuestions: questions.length,
          elapsedMs: Number(recorded.elapsedMs),
        },
      });
    } catch (error) {
      console.error('TREE Knowledge Trial request failed', error);
      const status = /invalid-/i.test(error instanceof Error ? error.message : '') ? 400 : 409;
      return json({ status: 'error', error: 'knowledge-trial-request-failed', message: safeMessage(error) }, status);
    }
  };
}

export default createTreeKnowledgeTrialHandler();

export const config = { path: '/api/tree-knowledge-trial' };
