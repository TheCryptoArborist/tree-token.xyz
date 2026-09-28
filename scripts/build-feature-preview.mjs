import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// Keep the candidate separate from the byte-exact published snapshot in dist/.
const output = resolve(root, 'dist-preview');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
const additions = ['dapp/sti-widget.js', 'dapp/sti-purchase-core.js', 'dapp/sti-stats-core.js', 'dapp/challenge-funding-core.js', 'assets/sti-icon.svg'];
additions.push('gateway/index.html', 'gateway/style.css', 'gateway/app.js', 'gateway/options.js', 'gateway/entry.js');
const overlays = ['dapp/index.html', 'dapp/styles.css', 'dapp/panel-router.css', 'dapp/interaction-bootstrap.js', 'scripts/wallet.js', 'scripts/tree-knowledge-trial.js'];
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
// Discoverable only in preview output; never modify published snapshot sources.
for (const file of ['index.html', 'dapp/index.html']) {
  const path = resolve(output, file);
  const html = await readFile(path, 'utf8');
  await writeFile(path, html.replace('</body>', '<script type="module" src="/gateway/entry.js"></script></body>'));
}
console.log(`Built a ${allowed.size}-file feature preview including TREE Gateway.`);
console.log('The production manifest and recovered function packages were not changed.');
