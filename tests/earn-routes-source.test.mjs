import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const markup = await readFile(new URL('../dapp/index.html', import.meta.url), 'utf8');
const earn = markup.match(/<section[^>]*id="earn"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';

const v2Pool = 'https://dex.suidex.org/pools/0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc/add';
const v3Pool = 'https://dex.suidex.org/pools/v3/0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf/add';
const v2Zap = 'https://dex.suidex.org/zap?pool=0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc&amp;stake=true';
const v3Zap = `${v3Pool}?zap=1`;

assert.ok(earn, 'Earn section must remain present.');
assert.match(earn, /id="earnRoutesTab"/);
assert.match(earn, /id="earnPositionsTab"/);
assert.match(earn, /Verified SUI \/ TREE routes/);
assert.match(earn, new RegExp(v2Pool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(earn, /https:\/\/dex\.suidex\.org\/farms/);
assert.match(earn, new RegExp(v3Pool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(earn, /https:\/\/dex\.suidex\.org\/portfolio/);
assert.ok(earn.includes(v2Zap), 'V2 Zap must preselect the exact TREE pool and Zap-to-Farm mode.');
assert.ok(earn.includes(v3Zap), 'V3 Zap must preselect the exact TREE pool and enable Zap mode.');
assert.match(earn, /Zap &amp; Stake/);
assert.match(earn, /Zap into V3/);
assert.equal((earn.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 6);
assert.match(earn, /explicit wallet approval/i);

console.log('Earn routes source: PASS (exact V2/V3 zaps, farm, incentives, portfolio, external-link safety)');
