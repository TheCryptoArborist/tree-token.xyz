import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareTreeKnowledgeScores,
  publicTreeKnowledgeQuestions,
  rankTreeKnowledgeScores,
  resolveTreeKnowledgeDailyWinner,
  scoreTreeKnowledgeTrial,
  treeKnowledgeTrialStatus,
  TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS,
  TREE_KNOWLEDGE_TRIAL_QUESTIONS,
} from '../netlify/lib/tree-knowledge-trial-core.ts';

test('public Knowledge Trial questions never expose answers or explanations', () => {
  const questions = publicTreeKnowledgeQuestions();
  assert.equal(questions.length, 5);
  assert.equal('correctOptionId' in questions[0], false);
  assert.equal('explanation' in questions[0], false);
  assert.equal(questions.every((question) => question.options.length === 4), true);
});

test('Knowledge Trial scoring is accuracy-first and records elapsed time', () => {
  const answers = TREE_KNOWLEDGE_TRIAL_QUESTIONS.map((question) => ({
    questionId: question.id,
    optionId: question.correctOptionId,
  }));
  const score = scoreTreeKnowledgeTrial(answers, 82_345);
  assert.equal(score.correctCount, 5);
  assert.equal(score.percentage, 100);
  assert.equal(score.elapsedSeconds, 82.3);
  assert.equal(score.timedOut, false);
});

test('partial submissions count unanswered questions as incorrect', () => {
  const first = TREE_KNOWLEDGE_TRIAL_QUESTIONS[0];
  const score = scoreTreeKnowledgeTrial([{ questionId: first.id, optionId: first.correctOptionId }], 180_000);
  assert.equal(score.correctCount, 1);
  assert.equal(score.answers.filter((answer) => answer.optionId === null).length, 4);
  assert.equal(score.timedOut, false);
  assert.equal(scoreTreeKnowledgeTrial([], (TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS + 1) * 1_000).timedOut, true);
});

test('invalid and duplicate answers are rejected', () => {
  assert.throws(() => scoreTreeKnowledgeTrial([{ questionId: 'missing', optionId: 'a' }], 1), /unknown/i);
  const question = TREE_KNOWLEDGE_TRIAL_QUESTIONS[0];
  assert.throws(() => scoreTreeKnowledgeTrial([
    { questionId: question.id, optionId: question.correctOptionId },
    { questionId: question.id, optionId: question.correctOptionId },
  ], 1), /more than once/i);
});

test('ranking uses correct answers, elapsed time, and shared ranks for exact ties', () => {
  assert.equal(compareTreeKnowledgeScores({ correctCount: 9, elapsedMs: 170_000 }, { correctCount: 8, elapsedMs: 10_000 }), -1);
  const ranked = rankTreeKnowledgeScores([
    { id: 'slow-perfect', correctCount: 10, elapsedMs: 120_000 },
    { id: 'fast-nine', correctCount: 9, elapsedMs: 50_000 },
    { id: 'tie-a', correctCount: 10, elapsedMs: 90_000 },
    { id: 'tie-b', correctCount: 10, elapsedMs: 90_000 },
  ]);
  assert.deepEqual(ranked.map(({ id, rank, exactTie }) => ({ id, rank, exactTie })), [
    { id: 'tie-a', rank: 1, exactTie: true },
    { id: 'tie-b', rank: 1, exactTie: true },
    { id: 'slow-perfect', rank: 3, exactTie: false },
    { id: 'fast-nine', rank: 4, exactTie: false },
  ]);
});

test('daily resolution produces exactly one winner or a sudden-death group', () => {
  const unique = resolveTreeKnowledgeDailyWinner([
    { wallet: '0x2', correctCount: 9, elapsedMs: 90_000 },
    { wallet: '0x1', correctCount: 10, elapsedMs: 100_000 },
  ]);
  assert.equal(unique.outcome, 'winner');
  assert.equal(unique.winner?.wallet, '0x1');

  const tie = resolveTreeKnowledgeDailyWinner([
    { wallet: '0x2', correctCount: 10, elapsedMs: 90_000 },
    { wallet: '0x1', correctCount: 10, elapsedMs: 90_000 },
    { wallet: '0x3', correctCount: 9, elapsedMs: 50_000 },
  ]);
  assert.equal(tie.outcome, 'sudden-death-required');
  assert.equal(tie.winner, null);
  assert.deepEqual(tie.tiedWallets, ['0x1', '0x2']);
  assert.equal(resolveTreeKnowledgeDailyWinner([]).outcome, 'no-entries');
});

test('public attempts require every independent activation gate', () => {
  assert.equal(treeKnowledgeTrialStatus({}).publicAttemptsEnabled, false);
  assert.equal(treeKnowledgeTrialStatus({
    TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
    TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
    TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
  }).publicAttemptsEnabled, false);
  assert.equal(treeKnowledgeTrialStatus({
    TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
    TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
    TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
    TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY: 'true',
    TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY: 'true',
  }).publicAttemptsEnabled, true);
  assert.equal(treeKnowledgeTrialStatus({
    TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
    TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
    TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
    TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY: 'true',
    TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY: 'true',
  }).scoring.exactTie, 'sudden-death');
});
