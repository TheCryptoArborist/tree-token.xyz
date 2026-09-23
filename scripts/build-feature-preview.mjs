import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// Keep the candidate separate from the byte-exact published snapshot in dist/.
const output = resolve(root, 'dist-preview');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
const additions = ['dapp/sti-widget.js', 'dapp/sti-purchase-core.js'];
const overlays = ['dapp/index.html', 'dapp/styles.css', 'dapp/interaction-bootstrap.js', 'scripts/wallet.js'];
for (const file of additions) allowed.add(file);

async function rejectUntrackedOutput(directory, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await rejectUntrackedOutput(resolve(directory, entry.name), `${relative}/`);
    else if (!allowed.has(relative.toLowerCase())) throw new Error(`Preserve or remove the old preview build before continuing: dist-preview/${relative}`);
  }
}

await rejectUntrackedOutput(output);
for (const file of manifest.files) {
  const destination = resolve(output, outputPath(file));
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file.source), destination);
}

for (const file of [...overlays, ...additions]) {
  await mkdir(dirname(resolve(output, file)), { recursive: true });
  await cp(resolve(root, file), resolve(output, file));
}
console.log(`Built a ${manifest.files.length + additions.length}-file feature preview from the verified production file set and explicit STI additions.`);
console.log('The production manifest and recovered function packages were not changed.');
