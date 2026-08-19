import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../dapp/styles.css', import.meta.url), 'utf8');
const swapStyles = readFileSync(new URL('../dapp/swap-router.css', import.meta.url), 'utf8');
const limitScript = readFileSync(new URL('../dapp/limit-orders.js', import.meta.url), 'utf8');
const v3Script = readFileSync(new URL('../dapp/v3-workspace.js', import.meta.url), 'utf8');
const suiLogo = readFileSync(new URL('../assets/sui-token.svg', import.meta.url), 'utf8');

test('SUI and TREE logos appear in the shared price ribbon and earn routes', () => {
  assert.match(suiLogo, /<svg[\s\S]*SUI/);
  assert.match(html, /src="\.\.\/assets\/sui-token\.svg" alt="SUI logo"/);
  assert.match(html, /src="\.\.\/thick\.png" alt="TREE logo"/);
  assert.ok((html.match(/class="token-logo-stack"/g) || []).length >= 1);
});

test('swap, limit, and V3 token direction changes preserve logo presentation', () => {
  assert.match(swapStyles, /swap-token-icon\.sui[^{]*\{[^}]*sui-token\.svg/);
  assert.match(swapStyles, /swap-token-icon\.tree[^{]*\{[^}]*thick\.png/);
  assert.match(limitScript, /limit-token-symbol.*direction\.inputSymbol\.toLowerCase/);
  assert.match(v3Script, /v3-token-stack[\s\S]*sui-token\.svg[\s\S]*thick\.png/);
  assert.match(styles, /\.sui-dot[^{]*\{[^}]*sui-token\.svg/);
  assert.match(styles, /\.tree-dot[^{]*\{[^}]*thick\.png/);
});
