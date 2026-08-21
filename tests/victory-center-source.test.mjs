import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const markup = await readFile(new URL('../dapp/index.html', import.meta.url), 'utf8');
const router = await readFile(new URL('../dapp/panel-router.js', import.meta.url), 'utf8');
const client = await readFile(new URL('../dapp/victory-center.js', import.meta.url), 'utf8');
const earn = markup.match(/<section[^>]*id="earn"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';

assert.match(earn, /id="earnVictoryTab"/); assert.match(earn, /id="earnVictoryPanel"/);
assert.match(earn, /xVICTORY is a locked on-chain position, not a separate coin/);
assert.match(earn, /id="victoryLockAction"/); assert.match(earn, /7 days/); assert.match(earn, /1,095 days/);
assert.match(earn, /id="victoryLocksTab"/); assert.match(earn, /My Locks &amp; Claims/);
assert.match(earn, /Current lock APRs/); assert.match(earn, /data-victory-apr="1095"/);
assert.match(earn, /id="victoryClaimRewards"/); assert.match(earn, /Claim VICTORY Rewards/);
assert.match(earn, /id="victoryClaimSui"/); assert.match(earn, /Claim Weekly SUI/);
assert.match(earn, /id="victoryBackToTop"/); assert.match(earn, /Back to Top/);
assert.match(earn, /id="victoryReinvestTab"/); assert.match(earn, /id="victoryReinvestView"/);
assert.match(earn, /Complete Reinvest/); assert.match(earn, /Sustainable Reinvest/); assert.match(earn, /Two verified pools/);
assert.match(earn, /data-victory-reinvest-mode="sustainable"/); assert.match(earn, /id="victoryReinvestSplit"/); assert.match(earn, /id="victorySustainableLockTerm"/);
assert.match(earn, /data-victory-reinvest-slippage="50"/); assert.match(earn, /data-victory-reinvest-slippage="200"/);
assert.match(markup, /src="victory-center\.js"/); assert.match(router, /showEarnView\('victory'\)/);
assert.match(client, /simulateTwice/); assert.match(client, /extractVictoryLocked/);
assert.match(client, /getVictoryLocks/); assert.match(client, /calculateVictoryAprs/); assert.match(client, /buildVictoryRewardsClaimTransaction/); assert.match(client, /buildSuiRewardsClaimTransaction/);
assert.match(client, /buildVictoryUnlockTransaction/); assert.match(client, /extractVictoryUnlockEvent/); assert.match(client, /Unlock &amp; Collect|Unlock & Collect/);
assert.match(client, /combined claim-and-unlock transaction/); assert.match(client, /data-victory-unlock/);
assert.match(client, /quoteVictoryV2Reinvest/); assert.match(client, /buildVictoryV2ReinvestTransaction/); assert.match(client, /extractPositiveV2Lp/);
assert.match(client, /buildVictoryV2SustainableReinvestTransaction/); assert.match(client, /extractVictoryLockEvent/); assert.match(client, /Review Sustainable Reinvest/);
assert.match(client, /V2 reinvest and staking confirmed/); assert.match(client, /newly created raw SUI\/TREE LP units/);
assert.match(client, /Locked VICTORY cannot be withdrawn early/); assert.match(client, /tree:wallet-changed/);
assert.match(client, /updateLocksBackToTop/); assert.match(client, /scrollIntoView/); assert.match(client, /prefers-reduced-motion/);
assert.match(client, /victory-locks-preview/); assert.match(client, /localhost.*127\.0\.0\.1/);
assert.doesNotMatch(earn, /Coming soon|Preview execution only/);

console.log('VICTORY center source: PASS (locks, claims, guarded unlocks, complete reinvest, and sustainable reinvest)');
