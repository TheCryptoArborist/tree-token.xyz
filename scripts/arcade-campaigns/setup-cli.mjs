#!/usr/bin/env node
// Local-file setup and review only. No credentials, network, signing or deployment.
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadSetupSource, validateSetup, reviewSetup, formatSetupReview } from './setup.mjs';

const DEFAULT_PATH = fileURLToPath(new URL('../../data/arcade-weekly-campaign-setup.json', import.meta.url));
const help = `Offline TREE Arcade weekly campaign setup

  node scripts/arcade-campaigns/setup-cli.mjs review [setup.json] [--json]
  node scripts/arcade-campaigns/setup-cli.mjs check [setup.json]

review prints a six-section Markdown review, or JSON with --json.
check prints validation and grouped missing decisions; incomplete/invalid setup exits 2.
The recurring rotation covers all working games: TREE Force ’89, Canopy Defense,
Canopy Breaker, Garden Bot, PvP Battle and ordinary Arborist Trials.
Plan: one featured game per suggested seven-day window; complete the eligible
cycle before repeats, skip unavailable games, and admit new games in future cycles.
The current roster follows LIVE listings, not verified gameplay or payout readiness.
Both default to data/arcade-weekly-campaign-setup.json. The pinned Trials source is
the separate /play/challenge/ technical pilot, not the ordinary Trials roster entry.
No dates or automatic rotation are activated.
Complete choices remain unverified, nonpayable and not launch-ready.
No file is changed, no network is contacted and no campaign or payment is created.
`;

export async function main(args, write = value => process.stdout.write(value)) {
  if (!args.length || (args.length === 1 && ['--help', '-h'].includes(args[0]))) { write(help); return 0; }
  const [command, ...rest] = args;
  if (!['review', 'check'].includes(command) || rest.filter(value => value === '--json').length > 1 || (command === 'check' && rest.includes('--json'))) throw Error('Use review [setup.json] [--json] or check [setup.json].');
  const paths = rest.filter(value => value !== '--json');
  if (paths.length > 1 || paths.some(value => value.startsWith('-'))) throw Error('Use at most one local setup path.');
  const path = paths[0] || DEFAULT_PATH, info = await stat(path);
  if (!info.isFile() || info.size > 1024 * 1024) throw Error('Use a local setup JSON file no larger than 1 MiB.');
  const setup = JSON.parse(await readFile(path, 'utf8'));
  const sourceKnown = await loadSetupSource(), validation = validateSetup(setup, sourceKnown);
  if (command === 'check' || !validation.valid) {
    write(JSON.stringify({ kind: 'offline-weekly-campaign-setup-check', payable: false, launchReady: false, operatorClaimsAuthenticated: false, ...validation }, null, 2) + '\n');
    return validation.valid && validation.decisionsComplete ? 0 : 2;
  }
  const review = reviewSetup(setup, sourceKnown);
  write(rest.includes('--json') ? JSON.stringify(review, null, 2) + '\n' : formatSetupReview(review));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write('Offline campaign setup: ' + error.message + '\n'); process.exitCode = 1; }
}
