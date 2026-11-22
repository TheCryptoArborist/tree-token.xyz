import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await import('./build.mjs');
const output = path.join(root, 'hosted-public');
await fs.rm(output, {recursive: true, force: true});
await fs.mkdir(path.join(output, 'play/canopy-breaker'), {recursive: true});
await fs.cp(path.join(root, 'dist'), path.join(output, 'play/canopy-breaker'), {recursive: true});
console.log('Prepared isolated host at /play/canopy-breaker/');
