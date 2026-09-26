import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, script, css] = await Promise.all([
  readFile(new URL('../dapp/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/tree-knowledge-trial.js', import.meta.url), 'utf8'),
  readFile(new URL('../dapp/panel-router.css', import.meta.url), 'utf8'),
]);

test('Challenge-only funding panel is hidden by default', () => {
  assert.match(html, /id="knowledgeFundingControl" hidden/);
  assert.match(css, /\.knowledge-funding-card\[hidden\]\{display:none!important\}/);
  assert.match(script, /nodes\.fundingControl\.hidden = !allowed/);
  assert.match(script, /isChallengeFundingWallet\(window\.playerAddress\)/);
});

test('funding UI requires review, two simulations, and wallet approval', () => {
  assert.match(script, /pass < 2/);
  assert.match(script, /transaction: built\.transaction/);
  assert.doesNotMatch(script, /built\.transaction\.build/);
  assert.match(script, /confirmTransaction\(/);
  assert.match(script, /signAndExecuteTransactionBlock/);
  assert.match(script, /waitForTransaction/);
  assert.match(script, /This control cannot withdraw funds/);
});

test('funding UI distinguishes available, reserved, and total keeper TREE', () => {
  assert.match(html, /id="knowledgeFundingReservedBalance"/);
  assert.match(html, /id="knowledgeFundingTotalBalance"/);
  assert.match(html, /id="knowledgeFundingQueueState"/);
  assert.match(script, /summarizeChallengeKeeper/);
  assert.match(script, /Deposited TREE may be assigned to those older awards/);
  assert.doesNotMatch(script, /Resolve the historical Challenge settlement queue before depositing more TREE/);
  assert.match(script, /Reserved for existing winners/);
});
