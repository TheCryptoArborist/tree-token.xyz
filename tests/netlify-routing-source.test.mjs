import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const copyScript = await readFile(new URL('../scripts/copy-static-build.mjs', import.meta.url), 'utf8');

assert.equal(
  /from\s*=\s*["']\/dapp["'][\s\S]*?to\s*=\s*["']\/dapp\/["']/.test(config),
  false,
  'Netlify must not redirect /dapp to /dapp/ because its trailing-slash normalization can create a loop.',
);

assert.match(packageJson.scripts.build, /node scripts\/copy-static-build\.mjs/);
for (const route of ['about', 'dapp', 'documents', 'faq', 'roadmap', 'tokenomics']) {
  assert.match(copyScript, new RegExp(`['"]${route}['"]`));
}
assert.match(copyScript, /['"]assets['"]/);

console.log('Netlify routing: PASS (no redirect loop; static DApp routes included in build)');
