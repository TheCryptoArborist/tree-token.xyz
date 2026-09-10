import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTreeKnowledgeTrialAdminHandler,
  validateTreeKnowledgeTrialDraft,
} from '../netlify/lib/tree-knowledge-trial-admin.ts';

const SECRET = 'challenge-admin-secret-with-more-than-32-characters';
const NOW = new Date('2030-01-01T12:00:00.000Z');

function questions(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    prompt: `Which answer is correct for ${prefix} question ${index + 1}?`,
    options: [
      { id: 'a', label: 'First answer' },
      { id: 'b', label: 'Second answer' },
      { id: 'c', label: 'Third answer' },
      { id: 'd', label: 'Fourth answer' },
    ],
    correctOptionId: 'b',
    explanation: 'The second answer is the verified correct response.',
  }));
}

const draftBody = {
  roundDate: '2030-01-02',
  questions: questions('daily', 5),
  tiebreakQuestions: questions('tie', 3),
};

function request(method = 'POST', secret = SECRET, body: unknown = draftBody) {
  return new Request('https://tree-token.xyz/api/tree-knowledge-trial-admin', {
    method,
    headers: {
      Origin: 'https://tree-token.xyz',
      'Content-Type': 'application/json',
      'x-tree-knowledge-admin-secret': secret,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

test('draft validation fixes the public rules and requires private tie-break backups', () => {
  const draft = validateTreeKnowledgeTrialDraft(draftBody, NOW);
  assert.equal(draft.roundId, 'knowledge:2030-01-02');
  assert.equal(draft.questionSetVersion, 'knowledge-2030-01-02-v1');
  assert.equal(draft.questions.length, 5);
  assert.equal(draft.tiebreakQuestions.length, 3);
  assert.equal(draft.purchaseWindowOpensAt, '2030-01-02T00:00:00.000Z');
  assert.equal(draft.purchaseWindowClosesAt, '2030-01-03T00:00:00.000Z');
  assert.equal(draft.prizeAmountRaw, '50000000000');
  assert.throws(() => validateTreeKnowledgeTrialDraft({ ...draftBody, tiebreakQuestions: questions('tie', 2) }, NOW));
  assert.throws(() => validateTreeKnowledgeTrialDraft({ ...draftBody, roundDate: '2029-12-31' }, NOW));
});

test('admin endpoint fails closed without a configured or matching secret', async () => {
  const unconfigured = createTreeKnowledgeTrialAdminHandler({ env: {} });
  assert.equal((await unconfigured(request())).status, 503);
  const configured = createTreeKnowledgeTrialAdminHandler({
    env: { TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET: SECRET },
    store: { async prepareDraft() { throw new Error('unexpected'); }, async readDraftSetup() { return null; }, async scheduleRound() { throw new Error('unexpected'); } },
  });
  assert.equal((await configured(request('POST', 'incorrect-secret-that-is-also-long-enough'))).status, 401);
});

test('authorized preparation writes one atomic draft and returns no answer key', async () => {
  let prepared: Record<string, unknown> | null = null;
  const handler = createTreeKnowledgeTrialAdminHandler({
    env: { TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET: SECRET },
    now: () => NOW,
    store: {
      async prepareDraft(input) {
        prepared = input;
        return {
          roundId: input.roundId,
          state: 'draft',
          questionSetVersion: input.questionSetVersion,
          dailyQuestionCount: 5,
          tiebreakQuestionCount: 3,
          durationSeconds: 180,
          minimumQualifyingUsdCents: 500,
          prizeAmountRaw: input.prizeAmountRaw,
          preparedAt: NOW.toISOString(),
        };
      },
      async readDraftSetup() { return null; },
      async scheduleRound() { throw new Error('unexpected'); },
    },
  });
  const response = await handler(request());
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.setup.state, 'draft');
  assert.equal(payload.setup.dailyQuestionCount, 5);
  assert.equal('questions' in payload.setup, false);
  assert.equal('correctOptionId' in payload.setup, false);
  assert.equal((prepared as any).roundId, 'knowledge:2030-01-02');
  assert.match(String((prepared as any).requestSha256), /^[0-9a-f]{64}$/);
});

test('authorized status is sanitized and can report a missing draft', async () => {
  const handler = createTreeKnowledgeTrialAdminHandler({
    env: { TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET: SECRET },
    store: {
      async prepareDraft() { throw new Error('unexpected'); },
      async readDraftSetup(roundId) {
        assert.equal(roundId, 'knowledge:2030-01-02');
        return null;
      },
      async scheduleRound() { throw new Error('unexpected'); },
    },
  });
  const response = await handler(new Request(
    'https://tree-token.xyz/api/tree-knowledge-trial-admin?roundDate=2030-01-02',
    { headers: { Origin: 'https://tree-token.xyz', 'x-tree-knowledge-admin-secret': SECRET } },
  ));
  assert.deepEqual(await response.json(), { status: 'ok', setup: null });
});

test('authorized review confirmation schedules a complete draft without returning answers', async () => {
  let scheduledRoundId = '';
  const handler = createTreeKnowledgeTrialAdminHandler({
    env: { TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET: SECRET },
    store: {
      async prepareDraft() { throw new Error('unexpected'); },
      async readDraftSetup() { throw new Error('unexpected'); },
      async scheduleRound(roundId) {
        scheduledRoundId = roundId;
        return {
          roundId,
          state: 'open',
          questionSetVersion: 'knowledge-2030-01-02-v1',
          dailyQuestionCount: 5,
          tiebreakQuestionCount: 3,
          durationSeconds: 180,
          minimumQualifyingUsdCents: 500,
          challengeOpensAt: '2030-01-02T00:00:00.000Z',
          challengeClosesAt: '2030-01-03T00:00:00.000Z',
          prizeAmountRaw: '50000000000',
          scheduledAt: NOW.toISOString(),
        };
      },
    },
  });
  const response = await handler(request('POST', SECRET, {
    action: 'schedule', roundDate: '2030-01-02', reviewConfirmed: true,
  }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(scheduledRoundId, 'knowledge:2030-01-02');
  assert.equal(payload.setup.state, 'open');
  assert.equal(payload.setup.readyForReview, false);
  assert.equal('questions' in payload.setup, false);
});

test('scheduling fails closed without an explicit review confirmation', async () => {
  const handler = createTreeKnowledgeTrialAdminHandler({
    env: { TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET: SECRET },
    store: {
      async prepareDraft() { throw new Error('unexpected'); },
      async readDraftSetup() { throw new Error('unexpected'); },
      async scheduleRound() { throw new Error('unexpected'); },
    },
  });
  const response = await handler(request('POST', SECRET, {
    action: 'schedule', roundDate: '2030-01-02', reviewConfirmed: false,
  }));
  assert.equal(response.status, 400);
});
