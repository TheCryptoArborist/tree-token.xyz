import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
assert.equal((html.match(/src="v3-workspace\.js"/g) || []).length, 1, 'V3 workspace script must load exactly once.');
assert.equal((html.match(/src="v3-transactions\.js"/g) || []).length, 1, 'V3 transaction controller must load exactly once.');
assert.equal((html.match(/href="v3-transactions\.css"/g) || []).length, 1, 'V3 transaction styles must load exactly once.');
assert.ok(html.includes('id="v3"'), 'The V3 host section must remain present.');
assert.ok(html.includes('src="panel-router.js"'), 'Single-panel Command Center routing must remain loaded.');
console.log('Native TREE V3 HTML load safeguard passed.');
