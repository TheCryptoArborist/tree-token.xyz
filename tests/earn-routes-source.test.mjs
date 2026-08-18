import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const markup = await readFile(new URL('../dapp/index.html', import.meta.url), 'utf8');
const earn = markup.match(/<section[^>]*id="earn"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';

assert.ok(earn, 'Earn section must remain present.');
assert.match(earn, /id="earnRoutesTab"/);
assert.match(earn, /id="earnPositionsTab"/);
assert.match(earn, /Verified SUI \/ TREE routes/);
assert.match(earn, /id="earnV2ZapOpen"/);
assert.match(earn, /id="earnV2ZapPanel"/);
assert.match(earn, /id="earnZapAction"/);
assert.match(earn, /Wallet approvals[\s\S]*2 · Zap, then stake/);
assert.match(earn, /Zap &amp; Stake/);
assert.match(earn, /id="earnV3ZapOpen"/);
assert.match(earn, /id="earnV3ZapPanel"/);
assert.match(earn, /id="earnV3ZapAction"/);
assert.match(earn, /Zap into V3/);
assert.match(earn, /Wallet approvals[\s\S]*1 · Position \+ incentives/);
assert.match(earn, /data-open-panel="v3"/);
assert.doesNotMatch(earn, /https:\/\/dex\.suidex\.org/);
assert.equal((earn.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 0);
assert.match(earn, /explicit wallet approval/i);

console.log('Earn routes source: PASS (native V2 zap/stake, internal V3 workspace, no SuiDex redirect)');
