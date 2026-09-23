import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
for (const file of manifest.files) {
  const bytes = await readFile(resolve(root, file.source));
  if (createHash('sha1').update(bytes).digest('hex') !== file.sha1) throw new Error(`Production snapshot changed: ${file.source}`);
}
for (const fn of manifest.functions.filter(fn => fn.artifact)) {
  const bytes = await readFile(resolve(root, fn.artifact));
  if (createHash('sha256').update(bytes).digest('hex') !== fn.sha256) throw new Error(`Function package mismatch: ${fn.name}`);
}
console.log(`Verified ${manifest.files.length} production files and ${manifest.functions.filter(fn => fn.artifact).length}/${manifest.functions.length} exact function packages for ${manifest.deployId}.`);
console.log('Reuse deployed function packages. Local sources are not verified production replacements.');
