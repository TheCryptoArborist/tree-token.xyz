import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'production/manifest.json'), 'utf8'));
const destination = await mkdtemp(join(tmpdir(), 'tree-source-parity-'));
try {
  const functions = await zipFunctions(join(root, 'netlify/functions'), destination, {
    basePath: root,
    config: { '*': { nodeBundler: 'esbuild', nodeVersion: '22' } },
  });
  assert.deepEqual(functions.map(({ name }) => name).sort(), manifest.functions.map(({ name }) => name).sort());
  const schedules = functions.filter(({ schedule }) => schedule).map(({ name, schedule }) => ({ name, cron: schedule })).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(schedules, [...manifest.schedules].sort((a, b) => a.name.localeCompare(b.name)));
  const configurations = manifest.functionConfigurations;
  for (const fn of functions) {
    const expected = configurations.find(({ n }) => n === fn.name);
    assert.deepEqual((fn.routes || []).map(({ pattern }) => pattern).sort(), (expected.ro || []).map(({ p }) => p).sort(), `${fn.name} routes`);
  }
  const result = spawnSync('python3', [join(root, 'scripts/compare-backend-payloads.py'), join(root, 'production/functions'), destination], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Backend payload comparison failed.');
  console.log(result.stdout.trim());
  console.log(`Verified ${functions.length} source-built functions, public routes, and ${schedules.length} schedules against ${manifest.deployId || manifest.id}.`);
} finally {
  await rm(destination, { recursive: true, force: true });
}
