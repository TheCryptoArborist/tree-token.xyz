// Run only in an isolated copy of this directory after npm ci --ignore-scripts.
// The single public output retains the bundled dependency notices inline.
import { build } from 'vite';
import { readFile, writeFile, rm } from 'node:fs/promises';
import configuration from './vite.arcade.config.mjs';
await build({ ...configuration, configFile: false });
const output = new URL('./build/nftree-wallet-mint.js', import.meta.url);
const licensesPath = new URL('./build/third-party-licenses.md', import.meta.url);
const [code, licenses] = await Promise.all([readFile(output, 'utf8'), readFile(licensesPath, 'utf8')]);
await writeFile(output, `/*!\nNFTree wallet module: nftree_landing f8f014c2869dbaed04735c43f94d01a1a818abaa.\nBundled dependency notices:\n${licenses.replaceAll('*/', '* /')}\n*/\n${code}`);
await rm(licensesPath);
