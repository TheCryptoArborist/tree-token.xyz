import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
// Keep the candidate separate from the byte-exact published snapshot in dist/.
const output = resolve(root, 'dist-preview');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
const additions = ['dapp/sti-widget.js', 'dapp/sti-purchase-core.js', 'dapp/sti-stats-core.js', 'dapp/challenge-funding-core.js', 'assets/sti-icon.svg'];
additions.push('gateway/index.html', 'gateway/style.css', 'gateway/app.js', 'gateway/options.js', 'gateway/entry.js');
additions.push('gateway/review-core.js');
const generated = ['gateway/wallet-bundle.js'];
const overlays = ['dapp/index.html', 'dapp/styles.css', 'dapp/panel-router.css', 'dapp/interaction-bootstrap.js', 'scripts/wallet.js', 'scripts/tree-knowledge-trial.js'];

for (const file of [...additions, ...generated]) allowed.add(file);

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
try { await readFile(resolve(root, 'gateway/wallet-kit/node_modules/@mysten/dapp-kit-core/package.json')); }
catch {
  const windows = process.platform === 'win32';
  execFileSync(windows ? 'cmd.exe' : 'npm', windows ? ['/d', '/s', '/c', 'npm ci --prefix gateway/wallet-kit --ignore-scripts'] : ['ci', '--prefix', 'gateway/wallet-kit', '--ignore-scripts'], { cwd: root, stdio: 'inherit' });
}
for (const file of manifest.files) {
  const destination = resolve(output, outputPath(file));
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file.source), destination);
}

for (const file of [...overlays, ...additions]) {
  await mkdir(dirname(resolve(output, file)), { recursive: true });
  await cp(resolve(root, file), resolve(output, file));
}
// Extend navigation only in the feature preview; preserve the recorded production router.
const appHtmlPath = resolve(output, 'dapp/index.html');
const appHtml = await readFile(appHtmlPath, 'utf8');
await writeFile(appHtmlPath, appHtml.replace('<a href="#limit">', '<a href="#bridge"><span aria-hidden="true">↗</span><b>Bridge</b></a>\n      <a href="#limit">').replace('<main>', '<main>\n<section class="section compact-section app-panel" id="bridge" aria-labelledby="bridge-title" hidden><h2 id="bridge-title">TREE Gateway <small>Preview</small></h2><div id="tree-gateway-bridge"></div></section>'));
const panelCssPath = resolve(output, 'dapp/panel-router.css');
const panelCss = await readFile(panelCssPath, 'utf8');
await writeFile(panelCssPath, panelCss.replace('width:700px;max-width:100%;grid-template-columns:repeat(10,minmax(0,1fr))','width:770px;max-width:100%;grid-template-columns:repeat(11,minmax(0,1fr))').replace('repeat(10,70px)','repeat(11,70px)').replace('.app-tabbed #swap,.app-tabbed #limit','.app-tabbed #swap,.app-tabbed #bridge,.app-tabbed #limit'));
const routerPath = resolve(output, 'dapp/panel-router.js');
const routerSource = await readFile(routerPath, 'utf8');
if (!routerSource.includes("  'swap',") || !routerSource.includes("  swap: 'Swap',")) throw new Error('Unexpected panel router format');
await writeFile(routerPath, routerSource.replace("  'swap',", "  'swap',\n  'bridge',").replace("  swap: 'Swap',", "  swap: 'Swap',\n  bridge: 'Bridge',"));
await build({ entryPoints: [resolve(root, 'gateway/wallet-kit/entry.js')], outfile: resolve(output, 'gateway/wallet-bundle.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline' });
// Discoverable only in preview output; never modify published snapshot sources.
for (const file of ['index.html', 'dapp/index.html']) {
  const path = resolve(output, file);
  const html = await readFile(path, 'utf8');
  await writeFile(path, html.replace('</body>', '<script type="module" src="/gateway/entry.js"></script></body>'));
}
console.log(`Built a ${allowed.size}-file feature preview including TREE Gateway.`);
console.log('The production manifest and recovered function packages were not changed.');
