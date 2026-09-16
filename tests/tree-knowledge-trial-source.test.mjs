import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, script, styles] = await Promise.all([
  readFile(new URL('../dapp/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/tree-knowledge-trial.js', import.meta.url), 'utf8'),
  readFile(new URL('../dapp/panel-router.css', import.meta.url), 'utf8'),
]);

test('Challenge navigation and practice interface are present', () => {
  assert.match(html, /<b>Challenge<\/b>/);
  assert.match(html, /TREE Knowledge Trial/);
  assert.match(html, /id="knowledgeTrialStartPractice"/);
  assert.match(html, /id="knowledgeTrialTimer">03:00/);
  assert.match(html, /five-question TREE ecosystem challenge/i);
  assert.match(html, /<span>5 questions<\/span>/i);
  assert.match(html, /No drawing, RNG, ticket weighting, streak multiplier, or random tie-breaker/);
  assert.match(html, /one daily winner/i);
  assert.match(html, /sudden-death questions/i);
  assert.match(html, /id="knowledgeTrialClaimPrize"/);
});

test('Knowledge Trial client uses server scoring and a fixed deadline', () => {
  assert.match(script, /\/api\/tree-knowledge-trial/);
  assert.match(script, /post\('practice-submit'/);
  assert.match(script, /state\.deadline = state\.startedAt \+ state\.config\.durationSeconds \* 1_000/);
  assert.match(script, /tree:wallet-changed/);
  assert.match(script, /post\('challenge'/);
  assert.match(script, /signTreePersonalMessage/);
  assert.match(script, /post\('start'/);
  assert.match(script, /state\.mode === 'tiebreak' \? 'tiebreak-submit' : 'submit'/);
  assert.match(script, /post\('tiebreak-challenge'/);
  assert.match(script, /post\('tiebreak-start'/);
  assert.match(script, /'tiebreak-submit'/);
  assert.match(script, /SUDDEN DEATH · STAGE/);
  assert.match(script, /one winner will be selected after the round closes/i);
  assert.match(script, /\/api\/tree-knowledge-trial-claim/);
  assert.match(script, /buildTreeRaffleBrowserClaim/);
});

test('scheduled rounds do not expose the live-start action before their UTC window', () => {
  assert.match(script, /function roundWindowState\(/);
  assert.match(script, /roundTiming === 'active'/);
  assert.match(script, /roundTiming === 'scheduled'/);
  assert.match(script, /The next scored challenge opens/);
});

test('Knowledge Trial layout includes question, timer, progress, and result styles', () => {
  for (const selector of ['knowledge-trial-card', 'knowledge-option', 'knowledge-progress-track', 'knowledge-result']) {
    assert.match(styles, new RegExp(`\\.${selector}`));
  }
});
