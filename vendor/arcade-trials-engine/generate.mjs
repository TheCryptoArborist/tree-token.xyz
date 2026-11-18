// Reproduce the isolated replay engine with Node 24's built-in type eraser.
// No package installation, game configuration, network access or live mutation.
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  : JSON.stringify(value);
const source = JSON.parse(readFileSync(root + 'source.json', 'utf8'));
const raw = name => {
  const file = source.files.find(row => row.path === 'upstream/' + name);
  const bytes = readFileSync(root + file.path);
  if (hash(bytes) !== file.sha256) throw Error('Pinned upstream bytes changed: ' + name);
  const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  if (blob !== file.gitBlobSha1) throw Error('Pinned upstream Git blob changed: ' + name);
  return bytes.toString('utf8');
};
const erased = name => stripTypeScriptTypes(raw(name), { mode: 'strip' });
function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw Error('Unexpected import layout: ' + before);
  return text.replace(before, after);
}
const transformations = [
  'Erase TypeScript types with Node 24 stripTypeScriptTypes(mode=strip).',
  'Remove whitespace-only padding lines left by type erasure; retain all original nonblank runtime lines.',
  'Redirect only runtime imports to local generated modules; type-only UI imports erase automatically.',
  'Extract MOVE_LABELS, MoveType, MoveMeta and MOVE_META from sui-config.ts, from its Short display label comment to before SELF_GROWTH_MOVE_IDS. Do not copy chain configuration into the runtime.',
  'Preserve all game calculations, seeded RNG consumption (including log-entry random draws), portable shuffle, bot policy and round rules. Date.now remains upstream log metadata only; the adapter excludes it from replay results.',
  'The adapter enforces portable-v1 and four standard cards, seeds every battle, and exposes no fifth-card, paid-advantage or debug option.',
];
const modules = new Map();
let practice = erased('practiceBattle.ts');
practice = replaceOnce(practice, '"@/lib/sui-config"', '"./card-catalog.mjs"');
practice = replaceOnce(practice, '"@shared/trial-engine"', '"./trial-engine.mjs"');
modules.set('practice-battle.mjs', practice);
let trial = erased('arboristTrials.ts');
trial = replaceOnce(trial, '"./practiceBattle"', '"./practice-battle.mjs"');
trial = replaceOnce(trial, '"./sui-config"', '"./card-catalog.mjs"');
modules.set('trial-game.mjs', trial);
modules.set('trial-engine.mjs', erased('trial-engine.ts'));
modules.set('challenge-rules.mjs', replaceOnce(erased('arborist-trials.ts'), '"./trial-engine"', '"./trial-engine.mjs"'));
const config = raw('sui-config.ts');
const start = config.indexOf('// Short display label for buttons');
const end = config.indexOf('const SELF_GROWTH_MOVE_IDS');
if (start < 0 || end <= start) throw Error('Card catalog extraction markers changed.');
modules.set('card-catalog.mjs', stripTypeScriptTypes(config.slice(start, end), { mode: 'strip' }));
mkdirSync(root + 'runtime', { recursive: true });
const runtime = [];
for (const [name, code] of modules) {
  const bytes = '// Generated from the pinned project source. See ../source.json and ../README.md.\n' + code.replace(/^[\t ]+$/gm, '').trimEnd() + '\n';
  writeFileSync(root + 'runtime/' + name, bytes);
  runtime.push({ path: 'runtime/' + name, sha256: hash(bytes) });
}
const pinned = { schemaVersion: 1, repository: source.repository, commit: source.commit, sources: source.files, transformations, runtime };
writeFileSync(root + 'provenance.json', JSON.stringify({ ...pinned, sourceHash: hash(canonical(pinned)), liveParityClaimed: false }, null, 2) + '\n');
console.log(JSON.stringify({ generated: runtime.length, sourceHash: hash(canonical(pinned)) }));
