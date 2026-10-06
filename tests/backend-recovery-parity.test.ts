import assert from 'node:assert/strict';
import test from 'node:test';
import { rotatingTreeKnowledgeTrialRound, publicTreeKnowledgeQuestions } from '../netlify/lib/tree-knowledge-trial-core.ts';
import { prepareDailyRotatingKnowledgeRound } from '../netlify/functions/tree-knowledge-trial-rotation-scheduled.ts';
import { runKnowledgeTrialDeployBootstrap } from '../netlify/functions/tree-knowledge-trial-rotation-on-deploy.ts';
import { createTreeKnowledgeTrialTestProxy } from '../netlify/lib/tree-knowledge-trial-test-proxy.ts';
import { handleTreeLeaderboardRequest } from '../netlify/functions/tree-leaderboard.ts';
import { treeKnowledgeTrialSupabaseConfig as claimConfig } from '../netlify/lib/tree-knowledge-trial-claim-store.ts';
import { treeKnowledgeTrialSupabaseConfig as roundConfig } from '../netlify/lib/tree-knowledge-trial-supabase.ts';

test('daily rotation is deterministic, distinct, and keeps answer keys private', () => {
  for (let day = 1; day <= 28; day++) {
    const date = `2030-01-${String(day).padStart(2, '0')}`;
    const round = rotatingTreeKnowledgeTrialRound(date);
    assert.deepEqual(round, rotatingTreeKnowledgeTrialRound(date));
    assert.equal(round.questions.length, 3);
    assert.equal(round.tiebreakQuestions.length, 3);
    assert.equal(new Set([...round.questions, ...round.tiebreakQuestions].map(q => q.id)).size, 6);
    const publicQuestions = publicTreeKnowledgeQuestions(round.questions);
    assert.equal(publicQuestions.length, 3);
    assert.equal(JSON.stringify(publicQuestions).includes('correctOptionId'), false);
    assert.equal(JSON.stringify(publicQuestions).includes('explanation'), false);
  }
});

test('rotation never overwrites an open round or auto-schedules a manual draft', async () => {
  for (const state of ['open', 'scheduled', 'resolved', 'draft']) {
    const result = await prepareDailyRotatingKnowledgeRound({
      roundDate: '2030-01-02',
      store: {
        async readDraftSetup() { return { state, questionSetVersion: 'manual-v2' }; },
        async prepareDraft() { throw new Error('must not overwrite'); },
        async scheduleRound() { throw new Error('must not schedule'); },
      },
    });
    assert.equal(result.status, state === 'draft' ? 'manual-review-required' : 'unchanged');
  }
});

test('branch review deployments never bootstrap Challenge database writes', async () => {
  const result = await runKnowledgeTrialDeployBootstrap({ deploy: { id: 'review', context: 'branch-deploy' } }, {
    async ensure() { throw new Error('must not write'); },
  });
  assert.equal(result.attempted, false);
});

test('test relay rejects admin actions and strips incoming credentials', async () => {
  let calls = 0;
  const proxy = createTreeKnowledgeTrialTestProxy('trial', async (_url, options) => {
    calls++;
    const headers = new Headers(options?.headers);
    assert.equal(headers.has('authorization'), false);
    assert.equal(headers.has('x-tree-knowledge-admin-secret'), false);
    return Response.json({ status: 'ok' });
  });
  const rejected = await proxy(new Request('https://example.test/?action=prepare', { method: 'POST', body: '{}' }));
  assert.equal(rejected.status, 405);
  assert.equal(calls, 0);
  const accepted = await proxy(new Request('https://example.test/?action=status', { headers: { Authorization: 'Bearer test-only', 'x-tree-knowledge-admin-secret': 'test-only' } }));
  assert.equal(accepted.status, 200);
  assert.equal(calls, 1);
});

test('leaderboard reports a rejected refresh as unauthorized', async () => {
  const result = await handleTreeLeaderboardRequest(new Request('https://example.test/api/tree-leaderboard', { method: 'POST' }), undefined as never, undefined,
    async () => ({ accepted: false, started: false, outcome: 'unauthorized' }));
  assert.equal(result.status, 401);
  assert.equal((await result.json()).error, 'refresh-not-authorized');
});

test('claim and round adapters retain their deployed database precedence', () => {
  const env = {
    TREE_KNOWLEDGE_TRIAL_SUPABASE_URL: 'https://claim.example.test',
    TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY: 'claim-test-key',
    TREE_RAFFLE_SUPABASE_URL: 'https://round.example.test',
    TREE_RAFFLE_SUPABASE_SECRET_KEY: 'round-test-key',
  };
  assert.equal(claimConfig(env).url, env.TREE_KNOWLEDGE_TRIAL_SUPABASE_URL);
  assert.equal(roundConfig(env).url, env.TREE_RAFFLE_SUPABASE_URL);
});
