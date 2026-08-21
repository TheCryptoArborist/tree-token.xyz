import { access, cp, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');

const staticDirectories = [
  'about',
  'assets',
  'backgroundtest',
  'challenge-admin',
  'dapp',
  'data',
  'docs',
  'documents',
  'faq',
  'raffle-rules',
  'roadmap',
  'scripts',
  'styles',
  'tokenomics',
];

const staticFiles = [
  'Litepaper.pdf',
  'background5.jpg',
  'hero.png',
  'mascot.png',
  'thick.png',
  'tree.jpg',
];

await mkdir(output, { recursive: true });

for (const directory of staticDirectories) {
  const source = resolve(root, directory);
  await access(source, constants.R_OK);
  await cp(source, resolve(output, directory), { recursive: true, force: true });
}

for (const file of staticFiles) {
  const source = resolve(root, file);
  await access(source, constants.R_OK);
  await cp(source, resolve(output, file), { force: true });
}

console.log('Static site routes and shared assets copied into dist.');
