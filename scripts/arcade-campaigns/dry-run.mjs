#!/usr/bin/env node
// Reads local JSON and writes a report to stdout. No fetch, wallets or payments.
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { freezeDraft, planAllocation, validateDraft } from './core.mjs';
import { syntheticDemo } from './synthetic-demo.mjs';

const help = `Offline TREE Arcade campaign planner (never a payment tool)

  node scripts/arcade-campaigns/dry-run.mjs check [draft.json]
  node scripts/arcade-campaigns/dry-run.mjs freeze draft.json
  node scripts/arcade-campaigns/dry-run.mjs plan frozen.json evidence.json UTC_AS_OF
  node scripts/arcade-campaigns/dry-run.mjs demo

check defaults to data/arcade-campaigns-draft.json and exits 2 for unresolved terms.
freeze prints a content-hashed OFFLINE draft; it does not publish or authorize it.
plan requires an explicit UTC time at/after the end and prints a nonpayable roster.
demo uses only fictional historical data and nontransferable TEST units.
All output goes to stdout. No file is changed and no network is contacted.\n`;

async function localJson(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size > 25 * 1024 * 1024) throw Error('Use a local JSON file no larger than 25 MiB.');
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function main(args, write = value => process.stdout.write(value)) {
  const [command, ...rest] = args;
  if (['--help', '-h'].includes(command) || command === undefined) { write(help); return 0; }
  let output, code = 0;
  if (command === 'check' && rest.length <= 1) {
    const path = rest[0] || fileURLToPath(new URL('../../data/arcade-campaigns-draft.json', import.meta.url));
    output = { kind: 'offline-draft-check', payable: false, launchReady: false, ...validateDraft(await localJson(path)) };
    code = output.valid ? 0 : 2;
  } else if (command === 'freeze' && rest.length === 1) output = freezeDraft(await localJson(rest[0]));
  else if (command === 'plan' && rest.length === 3) {
    const [frozen, evidence] = await Promise.all([localJson(rest[0]), localJson(rest[1])]);
    output = planAllocation(frozen, evidence, rest[2]);
  } else if (command === 'demo' && rest.length === 0) {
    const { frozen, manifest, asOf } = syntheticDemo(); output = planAllocation(frozen, manifest, asOf);
  } else throw Error('Unknown command or arguments. Use --help.');
  write(JSON.stringify(output, null, 2) + '\n'); return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write('Offline campaign planner: ' + error.message + '\n'); process.exitCode = 1; }
}
