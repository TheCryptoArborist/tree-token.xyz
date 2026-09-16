import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const source = resolve(root, 'test-dapp-deploy');

await access(dist, constants.W_OK);
await Promise.all([
  copyFile(resolve(source, '_headers'), resolve(dist, '_headers')),
  copyFile(resolve(source, '_redirects'), resolve(dist, '_redirects')),
]);

console.log('Test DApp redirect and no-index safeguards copied into dist.');
