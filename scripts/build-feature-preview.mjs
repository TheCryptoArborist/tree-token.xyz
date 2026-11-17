import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// Keep the candidate separate from the byte-exact published snapshot in dist/.
const output = resolve(root, 'dist-preview');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
const additions = ['dapp/sti-widget.js', 'dapp/sti-purchase-core.js', 'dapp/sti-stats-core.js', 'dapp/challenge-funding-core.js', 'assets/sti-icon.svg', 'play/multichaintest/index.html', 'play/multichaintest/app.js', 'play/multichaintest/wallet-vendor.js', 'play/multichaintest/setup/index.html', 'play/multichaintest/setup/app.js', 'play/multichaintest/setup/bnb/index.html', 'play/multichaintest/setup/bnb/app.js', 'play/multichaintest/setup/bnb/core.js', 'play/multichaintest/setup/bnb/deployment.json', 'play/multichaintest/setup/bnb/pass/index.html', 'play/multichaintest/setup/bnb/pass/app.js', 'play/multichaintest/setup/bnb/pass/deployment.json', 'play/multichaintest/setup/bnb/bind/index.html', 'play/multichaintest/setup/bnb/bind/app.js', 'play/multichaintest/setup/bnb/bind/core.js', 'play/multichaintest/setup/bnb/bind/binding.json', 'play/multichaintest/setup/sui/register/index.html', 'play/multichaintest/setup/sui/register/app.js', 'play/multichaintest/setup/sui/register/core.js', 'play/multichaintest/setup/sui/register/wallet-vendor.js', 'play/multichaintest/setup/sui/configure/index.html', 'play/multichaintest/setup/sui/configure/app.js', 'play/multichaintest/setup/sui/configure/core.js', 'play/multichaintest/setup/sui/configure/wallet-vendor.js', 'play/multichaintest/setup/bnb/configure/index.html', 'play/multichaintest/setup/bnb/configure/app.js', 'play/multichaintest/setup/bnb/configure/core.js', 'play/multichaintest/setup/bnb/configure/configuration.json', 'play/multichaintest/setup/sui/bind/index.html', 'play/multichaintest/setup/sui/bind/app.js', 'play/multichaintest/setup/sui/bind/core.js', 'play/multichaintest/setup/sui/bind/wallet-vendor.js', 'play/multichaintest/setup/sui/reserve/index.html', 'play/multichaintest/setup/sui/reserve/app.js', 'play/multichaintest/setup/sui/reserve/core.js', 'play/multichaintest/setup/sui/reserve/wallet-vendor.js', 'play/multichaintest/setup/sui/recover/index.html', 'play/multichaintest/setup/sui/recover/app.js', 'play/multichaintest/setup/sui/recover/core.js', 'play/multichaintest/setup/sui/recover/wallet-vendor.js', 'play/multichaintest/setup/bnb/recover/index.html', 'play/multichaintest/setup/bnb/recover/app.js', 'play/multichaintest/setup/bnb/recover/core.js', 'play/multichaintest/setup/bnb/buy/index.html', 'play/multichaintest/setup/bnb/buy/app.js', 'play/multichaintest/setup/bnb/buy/core.js', 'play/multichaintest/setup/bnb/redeem/index.html', 'play/multichaintest/setup/bnb/redeem/app.js', 'play/multichaintest/setup/bnb/redeem/core.js', 'play/multichaintest/setup/sui/ack/index.html', 'play/multichaintest/setup/sui/ack/app.js', 'play/multichaintest/setup/sui/ack/core.js', 'play/multichaintest/setup/sui/ack/wallet-vendor.js', 'play/multichaintest/original/index.html', 'play/multichaintest/original/app.js', 'play/multichaintest/original/core.js'];
const overlays = ['dapp/v3-workspace.js', 'dapp/index.html', 'dapp/styles.css', 'dapp/panel-router.css', 'dapp/interaction-bootstrap.js', 'scripts/wallet.js', 'scripts/tree-knowledge-trial.js'];
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
console.log(`Built a ${allowed.size}-file feature preview from the verified production file set and explicit STI additions.`);
console.log('The production manifest and recovered function packages were not changed.');
