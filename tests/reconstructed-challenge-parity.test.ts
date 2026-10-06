import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { publicTreeKnowledgeQuestions, treeKnowledgeTrialStatus, rotatingTreeKnowledgeTrialRound } from '../netlify/lib/tree-knowledge-trial-core.ts';
import { prepareDailyRotatingKnowledgeRound } from '../netlify/functions/tree-knowledge-trial-rotation-scheduled.ts';
import { runKnowledgeTrialDeployBootstrap } from '../netlify/functions/tree-knowledge-trial-rotation-on-deploy.ts';
import { createTreeKnowledgeTrialTestProxy } from '../netlify/lib/tree-knowledge-trial-test-proxy.ts';

test('recovered public practice and rules match the captured live service', () => {
  const live = JSON.parse(fs.readFileSync('tests/fixtures/knowledge-trial-live-rules.json', 'utf8'));
  const local = treeKnowledgeTrialStatus({});
  for (const field of ['version', 'questionSetVersion', 'durationSeconds', 'questionCount', 'minimumQualifyingUsdCents']) {
    assert.deepEqual(local[field], live.trial[field], field);
  }
  assert.deepEqual(publicTreeKnowledgeQuestions(), live.practice.questions);
});

test('rotation preserves open rounds and requires review for manual drafts', async () => {
  for (const state of ['open', 'closed', 'resolved', 'cancelled', 'draft']) {
    let writes = 0;
    const result = await prepareDailyRotatingKnowledgeRound({
      roundDate: '2030-01-02',
      store: {
        async readDraftSetup() { return { state, questionSetVersion: 'knowledge-2030-01-02-manual-v2' }; },
        async prepareDraft() { writes++; throw new Error('must not write'); },
        async scheduleRound() { writes++; throw new Error('must not write'); },
      } as any,
    });
    assert.equal(writes, 0);
    assert.equal(result.status, state === 'draft' ? 'manual-review-required' : 'unchanged');
  }
});

test('rotating question sets are deterministic and contain three distinct daily questions', () => {
  const round = rotatingTreeKnowledgeTrialRound('2030-01-02');
  assert.deepEqual(round, rotatingTreeKnowledgeTrialRound('2030-01-02'));
  assert.equal(round.questions.length, 3);
  assert.equal(new Set(round.questions.map(q => q.id)).size, 3);
  assert.equal(round.tiebreakQuestions.length, 3);
});

test('review branch deployment cannot trigger Challenge database writes', async () => {
  const result = await runKnowledgeTrialDeployBootstrap({ deploy: { id: 'review', context: 'branch-deploy' } }, {
    async ensure() { throw new Error('must not run'); },
  });
  assert.deepEqual(result, { attempted: false, outcome: 'skipped-context' });
});

test('test relay restricts actions and does not forward admin credentials', async () => {
  let called = false;
  const relay = createTreeKnowledgeTrialTestProxy('trial', async (url, options) => {
    called = true;
    assert.equal(String(url), 'https://tree-token.xyz/api/tree-knowledge-trial?action=status');
    assert.equal(new Headers(options?.headers).has('authorization'), false);
    return Response.json({ status: 'ok' });
  });
  assert.equal((await relay(new Request('https://example.test/?action=admin'))).status, 405);
  assert.equal(called, false);
  assert.equal((await relay(new Request('https://example.test/?action=status', { headers: { authorization: 'private' } }))).status, 200);
  assert.equal(called, true);
});
