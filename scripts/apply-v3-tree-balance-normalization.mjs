import fs from 'node:fs';

const path = 'dapp/v3-transactions.js';
let source = fs.readFileSync(path, 'utf8');

const importBefore = '  SUI_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, DEFAULT_SLIPPAGE_BPS, MIN_SUI_GAS_RESERVE_RAW, TREE_V3_REWARD_TOKENS,';
const importAfter = '  SUI_COIN_TYPE, TREE_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, DEFAULT_SLIPPAGE_BPS, MIN_SUI_GAS_RESERVE_RAW, TREE_V3_REWARD_TOKENS,';
if (!source.includes(importAfter)) {
  if (!source.includes(importBefore)) throw new Error('Expected V3 core import was not found.');
  source = source.replace(importBefore, importAfter);
}

const helperAnchor = "async function overview(owner = null) { const query = owner ? `?owner=${encodeURIComponent(owner)}` : ''; const response = await fetch(`/api/tree-v3-overview${query}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!response.ok) throw new Error(`V3 overview returned ${response.status}.`); const payload = await response.json(); validateVerifiedPool(payload?.pool); return payload; }\n";
const helper = `${helperAnchor}function rawBalanceValue(result) {\n  const value = result?.balance?.balance ?? result?.balance?.totalBalance ?? result?.balance ?? result?.totalBalance ?? 0;\n  try { return BigInt(value); } catch { throw new Error('Sui returned an invalid wallet balance.'); }\n}\nasync function rawCoinBalance(client, owner, coinType) {\n  return rawBalanceValue(await client.core.getBalance({ owner, coinType }));\n}\n`;
if (!source.includes('function rawBalanceValue(result)')) {
  if (!source.includes(helperAnchor)) throw new Error('Expected overview helper anchor was not found.');
  source = source.replace(helperAnchor, helper);
}

const increaseBefore = `    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });\n    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);\n    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the increase deposit.');`;
const increaseAfter = `    const [suiBalance, treeBalance] = await Promise.all([\n      rawCoinBalance(client, owner, SUI_COIN_TYPE),\n      rawCoinBalance(client, owner, TREE_COIN_TYPE),\n    ]);\n    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the increase deposit.');\n    if (treeBalance < treeRaw) throw new Error('The connected wallet does not have enough TREE for this position.');`;
if (!source.includes(increaseAfter)) {
  if (!source.includes(increaseBefore)) throw new Error('Expected V3 increase balance block was not found.');
  source = source.replace(increaseBefore, increaseAfter);
}

const createBefore = `    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE }); const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);\n    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the position deposit.');`;
const createAfter = `    const [suiBalance, treeBalance] = await Promise.all([rawCoinBalance(client, owner, SUI_COIN_TYPE), rawCoinBalance(client, owner, TREE_COIN_TYPE)]);\n    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the position deposit.');\n    if (treeBalance < treeRaw) throw new Error('The connected wallet does not have enough TREE for this position.');`;
if (!source.includes(createAfter)) {
  if (!source.includes(createBefore)) throw new Error('Expected V3 create balance block was not found.');
  source = source.replace(createBefore, createAfter);
}

fs.writeFileSync(path, source);
console.log('Applied V3 raw-balance normalization to create and increase flows.');
