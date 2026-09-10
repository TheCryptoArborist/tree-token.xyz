import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { createTreeKnowledgeTrialHandler } from '../netlify/functions/tree-knowledge-trial.ts';
import { TREE_KNOWLEDGE_TRIAL_QUESTIONS } from '../netlify/lib/tree-knowledge-trial-core.ts';

test('Knowledge Trial status publishes an inactive three-minute practice configuration', async () => {
  const response = await handler(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=status'));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.trial.publicAttemptsEnabled, false);
  assert.equal(payload.trial.practiceEnabled, true);
  assert.equal(payload.trial.durationSeconds, 180);
  assert.equal(payload.trial.minimumQualifyingUsdCents, 500);
  assert.equal(payload.practice.questions.length, 5);
  assert.equal('correctOptionId' in payload.practice.questions[0], false);
});

test('practice scoring stays server-side', async () => {
  const answers = TREE_KNOWLEDGE_TRIAL_QUESTIONS.map((question) => ({
    questionId: question.id,
    optionId: question.correctOptionId,
  }));
  const response = await handler(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=practice-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ answers, elapsedMs: 65_000 }),
  }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.score.correctCount, 5);
  assert.equal(payload.score.elapsedSeconds, 65);
});

test('public attempt start is fail-closed', async () => {
  const response = await handler(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({}),
  }));
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error, 'knowledge-trial-not-active');
});

test('unknown origins are rejected', async () => {
  const response = await handler(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=status', {
    headers: { Origin: 'https://example.com' },
  }));
  assert.equal(response.status, 403);
});

test('active pipeline requires wallet proof, starts one attempt, and uses server scoring', async () => {
  const wallet = `0x${'ab'.repeat(32)}`;
  const roundId = 'knowledge:2030-01-02';
  const challengeId = '11111111-1111-4111-8111-111111111111';
  const digest = '1'.repeat(44);
  const now = new Date('2030-01-02T12:00:00.000Z');
  let challenge: any = null;
  let verifiedMessage = '';
  let submitted: any = null;
  const store = {
    async publicSnapshot() { return { round: null, leaderboard: [], submissionCount: 0 }; },
    async createChallenge(input: any) {
      challenge = {
        challengeId,
        roundId,
        wallet,
        qualifyingTxDigest: digest,
        message: `${input.messagePrefix}\nQualifying TREE transaction: ${digest}`,
        expiresAt: input.expiresAt,
        consumed: false,
      };
      return challenge;
    },
    async readChallenge() { return challenge; },
    async consumeChallenge() { return { ...challenge, consumed: true }; },
    async issuePass() { return { passId: 'pass-1' }; },
    async startAttempt() {
      return {
        attemptId: 'attempt-1', roundId, wallet,
        questionSetVersion: 'private-daily-v1',
        startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 180_000).toISOString(), submitted: false,
      };
    },
    async readAttempt() {
      return {
        attemptId: 'attempt-1', roundId, wallet,
        questionSetVersion: 'private-daily-v1',
        startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 180_000).toISOString(), submitted: false,
      };
    },
    async questionSet() { return TREE_KNOWLEDGE_TRIAL_QUESTIONS; },
    async submitAttempt(_token: string, answers: unknown, correctCount: number) {
      submitted = { answers, correctCount };
      return { outcome: 'recorded', correctCount, elapsedMs: 42_500 };
    },
    async createTiebreakChallenge() { throw new Error('unexpected'); },
    async readTiebreakChallenge() { throw new Error('unexpected'); },
    async consumeTiebreakChallenge() { throw new Error('unexpected'); },
    async startTiebreakAttempt() { throw new Error('unexpected'); },
    async readTiebreakAttempt() { throw new Error('unexpected'); },
    async tiebreakQuestion() { throw new Error('unexpected'); },
    async submitTiebreakAttempt() { throw new Error('unexpected'); },
  };
  const active = createTreeKnowledgeTrialHandler({
    env: {
      TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
      TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
      TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 'rate-limit-secret-that-is-longer-than-32-characters',
    },
    store,
    now: () => now,
    randomHex: (bytes) => (bytes === 24 ? 'ab'.repeat(24) : 'cd'.repeat(32)),
    requestIp: () => '203.0.113.10',
    verifySignature: async (message, _signature, address) => {
      verifiedMessage = new TextDecoder().decode(message);
      assert.equal(address, wallet);
    },
  });

  const challengeResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ wallet, roundId }),
  }));
  assert.equal(challengeResponse.status, 200);
  const challengePayload = await challengeResponse.json();
  assert.equal(challengePayload.challenge.challengeId, challengeId);
  assert.match(challengePayload.challenge.message, /does not authorize a transaction or move funds/i);

  const startResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ wallet, challengeId, signature: 'A'.repeat(80) }),
  }));
  const startPayload = await startResponse.json();
  assert.equal(startResponse.status, 200);
  assert.equal(verifiedMessage, challenge.message);
  assert.equal(startPayload.attempt.attemptToken, 'cd'.repeat(32));
  assert.equal(startPayload.attempt.questions.length, 5);
  assert.equal('correctOptionId' in startPayload.attempt.questions[0], false);

  const answers = TREE_KNOWLEDGE_TRIAL_QUESTIONS.map((question) => ({
    questionId: question.id,
    optionId: question.correctOptionId,
  }));
  const submitResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ attemptToken: 'cd'.repeat(32), answers, elapsedMs: 1 }),
  }));
  const submitPayload = await submitResponse.json();
  assert.equal(submitResponse.status, 200);
  assert.equal(submitPayload.result.correctCount, 5);
  assert.equal(submitPayload.result.elapsedMs, 42_500);
  assert.equal(submitted.correctCount, 5);
});

test('eligible tied wallet signs and completes one private sudden-death question', async () => {
  const wallet = `0x${'cd'.repeat(32)}`;
  const roundId = 'knowledge:2030-01-02';
  const challengeId = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2030-01-03T00:10:00.000Z');
  const question = {
    id: 'tie-1',
    prompt: 'Which network is TREE built on?',
    options: [{ id: 'sui', label: 'Sui' }, { id: 'eth', label: 'Ethereum' }],
  };
  let challenge: any = null;
  let selectedOption = '';
  const store = {
    async publicSnapshot() { return { round: null, leaderboard: [], submissionCount: 0 }; },
    async createChallenge() { throw new Error('unexpected'); },
    async readChallenge() { throw new Error('unexpected'); },
    async consumeChallenge() { throw new Error('unexpected'); },
    async issuePass() { throw new Error('unexpected'); },
    async startAttempt() { throw new Error('unexpected'); },
    async readAttempt() { throw new Error('unexpected'); },
    async questionSet() { throw new Error('unexpected'); },
    async submitAttempt() { throw new Error('unexpected'); },
    async createTiebreakChallenge(input: any) {
      challenge = {
        challengeId, roundId, wallet, stage: 1, message: input.message,
        expiresAt: input.expiresAt, consumed: false,
      };
      return challenge;
    },
    async readTiebreakChallenge() { return challenge; },
    async consumeTiebreakChallenge() { return { ...challenge, consumed: true }; },
    async startTiebreakAttempt() {
      return {
        attemptId: 'tie-attempt-1', roundId, wallet, stage: 1,
        startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30_000).toISOString(), submitted: false,
      };
    },
    async readTiebreakAttempt() {
      return {
        attemptId: 'tie-attempt-1', roundId, wallet, stage: 1,
        startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30_000).toISOString(), submitted: false,
      };
    },
    async tiebreakQuestion() { return question; },
    async submitTiebreakAttempt(_token: string, optionId: string) {
      selectedOption = optionId;
      return { outcome: 'recorded', stage: 1, correct: true, elapsedMs: 4_321 };
    },
  };
  const active = createTreeKnowledgeTrialHandler({
    env: {
      TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
      TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
      TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY: 'true',
      TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 'rate-limit-secret-that-is-longer-than-32-characters',
    },
    store,
    now: () => now,
    randomHex: (bytes) => (bytes === 24 ? 'ef'.repeat(24) : '12'.repeat(32)),
    requestIp: () => '203.0.113.11',
    verifySignature: async (message, _signature, address) => {
      assert.equal(address, wallet);
      assert.match(new TextDecoder().decode(message), /Start sudden-death stage 1/);
    },
  });

  const challengeResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=tiebreak-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ wallet, roundId, stage: 1 }),
  }));
  const challengePayload = await challengeResponse.json();
  assert.equal(challengeResponse.status, 200);
  assert.equal(challengePayload.challenge.stage, 1);

  const startResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=tiebreak-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({ wallet, challengeId, signature: 'B'.repeat(80) }),
  }));
  const startPayload = await startResponse.json();
  assert.equal(startResponse.status, 200);
  assert.equal(startPayload.attempt.questions.length, 1);
  assert.equal(startPayload.attempt.questions[0].prompt, question.prompt);
  assert.equal('correctOptionId' in startPayload.attempt.questions[0], false);

  const submitResponse = await active(new Request('https://tree-token.xyz/api/tree-knowledge-trial?action=tiebreak-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tree-token.xyz' },
    body: JSON.stringify({
      attemptToken: '12'.repeat(32),
      answers: [{ questionId: 'tie-1', optionId: 'sui' }],
    }),
  }));
  const submitPayload = await submitResponse.json();
  assert.equal(submitResponse.status, 200);
  assert.equal(submitPayload.result.correctCount, 1);
  assert.equal(submitPayload.result.elapsedMs, 4_321);
  assert.equal(selectedOption, 'sui');
});
