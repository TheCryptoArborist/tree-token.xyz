import './verify-production-snapshot.mjs';
import { readFile, mkdir, cp, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
// Reject unrelated build output while allowing this snapshot to be rebuilt.
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
async function checkOutput(directory, prefix = '') {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await checkOutput(resolve(directory, entry.name), relative + '/');
    else if (!allowed.has(relative.toLowerCase())) throw new Error(`Preserve or remove the old build before continuing: dist/${relative}`);
  }
}
await checkOutput(output);
for (const file of manifest.files) {
  const destination = resolve(output, outputPath(file));
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file.source), destination);
}
console.log(`Built the exact ${manifest.files.length}-file production snapshot. No server functions were rebuilt or deployed.`);
