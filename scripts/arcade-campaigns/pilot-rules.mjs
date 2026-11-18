import { contentHash, canonicalJson, utcMillis } from './core.mjs';
import { ADAPTER, createChallenge } from './trials-adapter.mjs';

const ID = /^[a-z0-9][a-z0-9-]{5,79}$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Explicit local/operator input; this does not create or open a hosted pilot. */
export function makePilotRules({ pilotId, challengeDate, startsAt, endsAt, maxAttemptSeconds = 900 }) {
  if (typeof pilotId !== 'string' || !ID.test(pilotId)) throw Error('Choose a pilot ID of 6–80 lowercase letters, digits or hyphens.');
  if (!Number.isFinite(utcMillis(startsAt)) || !Number.isFinite(utcMillis(endsAt)) || utcMillis(endsAt) <= utcMillis(startsAt)) throw Error('Choose an explicit inclusive start and exclusive end in UTC.');
  if (!Number.isSafeInteger(maxAttemptSeconds) || maxAttemptSeconds < 60 || maxAttemptSeconds > 3600) throw Error('Choose an attempt duration from 60 to 3600 seconds.');
  // This validates the supported calendar without using this fixed seed for play.
  createChallenge('0'.repeat(64), challengeDate);
  return {
    schemaVersion: 1, mode: 'nonpaying-pilot', pilotId,
    game: { id: ADAPTER.gameId, version: ADAPTER.gameVersion, ruleset: ADAPTER.gameRuleset, sourceHash: ADAPTER.sourceHash },
    adapter: { id: ADAPTER.id, version: ADAPTER.version },
    challengeDate, window: { startsAt, endsAt }, maxAttemptSeconds,
    objective: { metric: 'wins', operator: 'eq', targetUnits: '1' },
    access: { entry: 'free', purchaseRequired: false, standardCards: 4, paidAdvantages: 'forbidden' },
    identityScope: 'wallet-session-only', payable: false, prizeEligible: false, awardsEnabled: false,
  };
}

export function verifyPilotRules(input) {
  if (!exact(input, ['schemaVersion', 'mode', 'pilotId', 'game', 'adapter', 'challengeDate', 'window', 'maxAttemptSeconds', 'objective', 'access', 'identityScope', 'payable', 'prizeEligible', 'awardsEnabled']) || !exact(input.window, ['startsAt', 'endsAt'])) throw Error('Unsupported pilot rules.');
  const expected = makePilotRules({ pilotId: input.pilotId, challengeDate: input.challengeDate, startsAt: input.window.startsAt, endsAt: input.window.endsAt, maxAttemptSeconds: input.maxAttemptSeconds });
  if (canonicalJson(input) !== canonicalJson(expected)) throw Error('The pilot does not match the pinned four-card, no-prize rules.');
  return { rules: expected, rulesHash: contentHash(expected) };
}

/** A record's indexed fields must describe precisely the rules shown to the player. */
export function verifyPilotRecord(record) {
  if (!plain(record)) throw Error('Pilot configuration is unavailable.');
  const frozen = verifyPilotRules(record.config);
  if (record.pilotId !== frozen.rules.pilotId || record.rulesHash !== frozen.rulesHash || record.adapterId !== ADAPTER.id || record.adapterVersion !== ADAPTER.version || record.sourceHash !== ADAPTER.sourceHash || Date.parse(record.startsAt) !== utcMillis(frozen.rules.window.startsAt) || Date.parse(record.endsAt) !== utcMillis(frozen.rules.window.endsAt) || record.maxAttemptSeconds !== frozen.rules.maxAttemptSeconds || !['draft', 'enabled', 'disabled'].includes(record.status) || record.enabled !== (record.status === 'enabled') || record.mode !== 'nonpaying-pilot' || record.payable !== false || record.prizeEligible !== false || record.awardsEnabled !== false || !Number.isFinite(Date.parse(record.serverNow))) throw Error('Pilot configuration binding is invalid.');
  return frozen;
}
