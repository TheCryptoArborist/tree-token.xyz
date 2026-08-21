import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeKnowledgeTrialResolver } from '../netlify/functions/tree-knowledge-trial-resolver.ts';

const activeEnv = {
  TREE_KNOWLEDGE_TRIAL_ENABLED: 'true',
  TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED: 'true',
  TREE_KNOWLEDGE_TRIAL_DATABASE_READY: 'true',
  TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY: 'true',
  TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY: 'true',
};

test('resolver stays disabled until every activation gate is ready', async () => {
  const response = await createTreeKnowledgeTrialResolver({ env: {} })();
  assert.deepEqual(await response.json(), { status: 'skipped', reason: 'knowledge-trial-not-active' });
});

test('resolver only resolves a closed daily challenge window', async () => {
  let resolved = '';
  const resolver = createTreeKnowledgeTrialResolver({
    env: activeEnv,
    now: () => new Date('2030-01-03T00:05:00.000Z'),
    store: {
      async publicSnapshot() {
        return { round: { roundId: 'knowledge:2030-01-02', state: 'open', challengeClosesAt: '2030-01-03T00:00:00.000Z' } };
      },
      async resolveRound(roundId) {
        resolved = roundId;
        return { outcome: 'winner', winnerWallet: `0x${'12'.repeat(32)}` };
      },
    },
  });
  const response = await resolver();
  const payload = await response.json();
  assert.equal(payload.status, 'ok');
  assert.equal(resolved, 'knowledge:2030-01-02');
  assert.equal(payload.resolution.outcome, 'winner');
});
