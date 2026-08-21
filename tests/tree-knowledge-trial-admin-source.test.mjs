import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, script, copyScript, dapp] = await Promise.all([
  readFile(new URL('../challenge-admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../challenge-admin/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/copy-static-build.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dapp/index.html', import.meta.url), 'utf8'),
]);

test('private setup page is noindex, non-linked, and cannot activate attempts or move prizes', () => {
  assert.match(html, /noindex,nofollow,noarchive/i);
  assert.match(html, /cannot enable public attempts or move prizes/i);
  assert.match(html, /Review and schedule/i);
  assert.doesNotMatch(dapp, /challenge-admin/i);
  assert.match(copyScript, /'challenge-admin'/);
});

test('setup page never embeds an answer key or persists the admin secret', () => {
  assert.match(script, /x-tree-knowledge-admin-secret/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(script, /correctOptionId:\s*['"][a-d]['"]/i);
  assert.match(script, /tiebreakRoot\.children\.length >= 10/);
  assert.match(script, /for \(let index = 0; index < 5/);
  assert.match(script, /for \(let index = 0; index < 3/);
  assert.match(script, /reviewConfirmed: true/);
  assert.match(script, /Public attempts and prize movement remain separately gated/);
});
