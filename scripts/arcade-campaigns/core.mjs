// Offline planning only. Input labels are not authentication or anti-cheat.
import { createHash } from 'node:crypto';

const ID = /^[a-z0-9][a-z0-9._:-]{1,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const UNITS = /^(0|[1-9][0-9]{0,77})$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keysAre = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const textIs = (value, max = 256) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const idIs = value => typeof value === 'string' && ID.test(value);
const unitIs = value => typeof value === 'string' && UNITS.test(value);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function utcMillis(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const stamp = Date.parse(value);
  const expanded = value.includes('.') ? value : value.replace('Z', '.000Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString() === expanded ? stamp : NaN;
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (plain(value)) return '{' + Object.keys(value).sort(compare).map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  throw Error('Only plain JSON with safe integer numbers is supported; token quantities must be decimal strings.');
}

export const contentHash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

/** An incomplete operator draft is expected. Missing terms block freezing. */
export function validateDraft(draft) {
  const issues = [];
  const check = (pass, path, message) => { if (!pass) issues.push({ path, message }); };
  if (!keysAre(draft, ['schemaVersion', 'status', 'id', 'title', 'rulesVersion', 'game', 'window', 'reward', 'objective', 'eligibility', 'allocation', 'verification', 'associatedEvent', 'cancellationPolicy'])) return { valid: false, issues: [{ path: '$', message: 'Use the exact campaign draft schema; unknown or missing fields are rejected.' }] };
  check(draft.schemaVersion === 1, 'schemaVersion', 'Use draft schema 1.');
  check(draft.status === 'draft', 'status', 'This tool accepts offline drafts only.');
  check(idIs(draft.id), 'id', 'Choose a stable campaign identifier.');
  check(textIs(draft.title, 100), 'title', 'Set a campaign title.');
  check(Number.isSafeInteger(draft.rulesVersion) && draft.rulesVersion >= 1, 'rulesVersion', 'Set a positive rules version.');
  if (!keysAre(draft.game, ['id', 'version', 'ruleset'])) check(false, 'game', 'Set the exact game, build version and ruleset.');
  else for (const field of ['id', 'version', 'ruleset']) check(idIs(draft.game[field]), 'game.' + field, 'Choose an exact game ' + field + '.');
  if (!keysAre(draft.window, ['startsAt', 'endsAt'])) check(false, 'window', 'Set the inclusive start and exclusive end in UTC.');
  else {
    const start = utcMillis(draft.window.startsAt), end = utcMillis(draft.window.endsAt);
    check(Number.isFinite(start), 'window.startsAt', 'Set a real ISO UTC start ending in Z.');
    check(Number.isFinite(end), 'window.endsAt', 'Set a real ISO UTC end ending in Z.');
    if (Number.isFinite(start) && Number.isFinite(end)) check(end > start, 'window.endsAt', 'The exclusive end must follow the start.');
  }
  if (!keysAre(draft.reward, ['network', 'assetId', 'symbol', 'decimals', 'poolUnits'])) check(false, 'reward', 'Set the exact network, asset identity, display symbol, decimals and fixed pool units.');
  else {
    check(idIs(draft.reward.network), 'reward.network', 'Select one explicit payout network for this campaign.');
    check(textIs(draft.reward.assetId), 'reward.assetId', 'Select the exact asset identifier; a ticker alone is insufficient.');
    check(typeof draft.reward.symbol === 'string' && /^[A-Z0-9]{1,16}$/.test(draft.reward.symbol), 'reward.symbol', 'Set the display ticker.');
    check(Number.isSafeInteger(draft.reward.decimals) && draft.reward.decimals >= 0 && draft.reward.decimals <= 30, 'reward.decimals', 'Set verified asset decimals from 0 to 30.');
    check(unitIs(draft.reward.poolUnits) && BigInt(draft.reward.poolUnits) > 0n, 'reward.poolUnits', 'Set a positive fixed pool as an exact integer-unit string.');
  }
  if (!keysAre(draft.objective, ['id', 'description', 'metric', 'operator', 'targetUnits'])) check(false, 'objective', 'Define one explicit skill objective.');
  else {
    check(idIs(draft.objective.id), 'objective.id', 'Set a stable objective identifier.');
    check(textIs(draft.objective.description, 600), 'objective.description', 'Describe exactly what a player must achieve.');
    check(idIs(draft.objective.metric), 'objective.metric', 'Name the integer metric checked by the selected adapter.');
    check(['gte', 'lte', 'eq'].includes(draft.objective.operator), 'objective.operator', 'Choose gte, lte or eq.');
    check(unitIs(draft.objective.targetUnits), 'objective.targetUnits', 'Set the target as an exact nonnegative integer string.');
  }
  if (!keysAre(draft.eligibility, ['entry', 'purchaseRequired', 'identityPolicy', 'paidAdvantages', 'attempts'])) check(false, 'eligibility', 'Define free entry, identity, paid-advantage and attempt rules.');
  else {
    check(draft.eligibility.entry === 'free' && draft.eligibility.purchaseRequired === false, 'eligibility.entry', 'This foundation supports free entry with no purchase requirement.');
    check(draft.eligibility.identityPolicy === 'one-verified-player', 'eligibility.identityPolicy', 'One verified player identity may receive one share.');
    check(draft.eligibility.paidAdvantages === 'forbidden', 'eligibility.paidAdvantages', 'Select no paid gameplay advantages; other policies need a new reviewed implementation.');
    check(draft.eligibility.attempts === 'repeat-attempts-one-share', 'eligibility.attempts', 'Repeated attempts cannot earn additional shares.');
  }
  if (!keysAre(draft.allocation, ['method', 'residualPolicy', 'noQualifiersPolicy'])) check(false, 'allocation', 'Define equal shares and both unused-pool policies.');
  else {
    check(draft.allocation.method === 'equal-shares', 'allocation.method', 'Every verified target achiever receives the same whole-unit share.');
    for (const field of ['residualPolicy', 'noQualifiersPolicy']) check(draft.allocation[field] === 'leave-unallocated', 'allocation.' + field, 'Explicitly leave unused units unallocated; no silent redistribution or carryover.');
  }
  if (!keysAre(draft.verification, ['runAdapterId', 'runAdapterVersion', 'identityReviewerId'])) check(false, 'verification', 'Select the run verifier version and identity reviewer.');
  else for (const field of ['runAdapterId', 'runAdapterVersion', 'identityReviewerId']) check(idIs(draft.verification[field]), 'verification.' + field, 'Select the exact verification ' + field + '.');
  if (!keysAre(draft.associatedEvent, ['id', 'href', 'campaignRequiredForEntry'])) check(false, 'associatedEvent', 'Select the associated Event without changing its entry rules.');
  else {
    check(idIs(draft.associatedEvent.id), 'associatedEvent.id', 'Select the associated Event identifier.');
    check(typeof draft.associatedEvent.href === 'string' && /^\/play\/(?:[a-z0-9/_-]*)(?:#[a-z0-9-]+)?$/.test(draft.associatedEvent.href), 'associatedEvent.href', 'Choose the Event path under /play/.');
    check(draft.associatedEvent.campaignRequiredForEntry === false, 'associatedEvent.campaignRequiredForEntry', 'This draft cannot impose a new Event entry requirement.');
  }
  check(textIs(draft.cancellationPolicy, 1000), 'cancellationPolicy', 'Set cancellation and unused-funding handling before freezing.');
  return { valid: issues.length === 0, issues };
}

export function freezeDraft(draft) {
  const result = validateDraft(draft);
  if (!result.valid) throw Error('Draft is incomplete or invalid: ' + result.issues.map(issue => issue.path).join(', '));
  const rules = JSON.parse(canonicalJson(draft));
  return deepFreeze({ schemaVersion: 1, kind: 'offline-frozen-campaign-draft', rulesHash: contentHash(rules), rules });
}

export function verifyFrozenRules(frozen) {
  if (!keysAre(frozen, ['schemaVersion', 'kind', 'rulesHash', 'rules']) || frozen.schemaVersion !== 1 || frozen.kind !== 'offline-frozen-campaign-draft' || typeof frozen.rulesHash !== 'string' || !HASH.test(frozen.rulesHash)) throw Error('Use an offline frozen campaign draft.');
  const expected = freezeDraft(frozen.rules);
  if (frozen.rulesHash !== expected.rulesHash) throw Error('Frozen rules changed: the rule hash no longer matches.');
  return expected;
}

/** Exact smallest-unit accounting; never round through Number or floating point. */
export function equalShares(poolUnits, qualifierCount) {
  if (!unitIs(poolUnits) || BigInt(poolUnits) <= 0n) throw Error('Use a positive integer-unit pool string.');
  if (!Number.isSafeInteger(qualifierCount) || qualifierCount < 0) throw Error('Invalid qualifier count.');
  const pool = BigInt(poolUnits), count = BigInt(qualifierCount);
  const share = count ? pool / count : 0n, allocated = share * count;
  return { poolUnits, qualifierCount, perPlayerUnits: String(share), allocatedUnits: String(allocated), unallocatedUnits: String(pool - allocated), reason: !count ? 'no-qualifiers' : !share ? 'pool-smaller-than-qualifier-count' : pool === allocated ? 'exact-division' : 'whole-unit-remainder' };
}

const IDENTITY_FIELDS = ['playerId', 'identityEvidenceId', 'status', 'source', 'reviewerId', 'reviewedAt'];
const RUN_FIELDS = ['evidenceId', 'evidenceSha256', 'playerId', 'campaignId', 'rulesHash', 'gameId', 'gameVersion', 'gameRuleset', 'adapterId', 'adapterVersion', 'source', 'reviewStatus', 'reviewedAt', 'startedAt', 'completedAt', 'metric', 'metricUnits', 'completed', 'paidAdvantagesUsed', 'debugUsed'];

/**
 * Consistency checks over an operator-supplied review export, NOT a verifier.
 * The output is always nonpayable, including when every input says "verified".
 */
export function planAllocation(frozenInput, manifest, asOf) {
  const frozen = verifyFrozenRules(frozenInput), rules = frozen.rules, clock = utcMillis(asOf);
  if (!Number.isFinite(clock) || clock < utcMillis(rules.window.endsAt)) throw Error('Supply an explicit UTC as-of time at or after the exclusive campaign end.');
  if (!keysAre(manifest, ['schemaVersion', 'purpose', 'classification', 'campaignId', 'rulesHash', 'identities', 'runs']) || manifest.schemaVersion !== 1 || manifest.purpose !== 'offline-dry-run' || !['synthetic-fixture', 'operator-supplied'].includes(manifest.classification) || manifest.campaignId !== rules.id || manifest.rulesHash !== frozen.rulesHash || !Array.isArray(manifest.identities) || !Array.isArray(manifest.runs) || manifest.identities.length > 100000 || manifest.runs.length > 100000) throw Error('Use a bounded offline review manifest bound to this campaign and frozen rule hash.');
  const identities = new Map(), identityProofs = new Set();
  for (const row of manifest.identities) {
    if (!keysAre(row, IDENTITY_FIELDS) || !idIs(row.playerId) || !idIs(row.identityEvidenceId)) throw Error('Invalid identity review record.');
    if (identities.has(row.playerId) || identityProofs.has(row.identityEvidenceId)) throw Error('Duplicate player identity or identity evidence; resolve the manifest before planning.');
    const reviewedAt = utcMillis(row.reviewedAt);
    identities.set(row.playerId, row.status === 'verified' && row.source === 'operator-identity-review' && row.reviewerId === rules.verification.identityReviewerId && Number.isFinite(reviewedAt) && reviewedAt <= clock);
    identityProofs.add(row.identityEvidenceId);
  }
  const evidenceIds = new Set(), evidenceHashes = new Set(), accepted = new Map(), rejected = [];
  const start = utcMillis(rules.window.startsAt), end = utcMillis(rules.window.endsAt);
  for (const row of manifest.runs) {
    if (!plain(row) || !idIs(row.evidenceId) || typeof row.evidenceSha256 !== 'string' || !HASH.test(row.evidenceSha256)) throw Error('Each run needs a stable evidence ID and SHA-256 reference to its original evidence.');
    if (evidenceIds.has(row.evidenceId) || evidenceHashes.has(row.evidenceSha256)) throw Error('Duplicate run evidence ID or evidence hash; no evidence may support multiple entries.');
    evidenceIds.add(row.evidenceId); evidenceHashes.add(row.evidenceSha256);
    let reason = null;
    const startedAt = utcMillis(row.startedAt), completedAt = utcMillis(row.completedAt), reviewedAt = utcMillis(row.reviewedAt);
    if (!keysAre(row, RUN_FIELDS)) reason = 'unsupported-evidence-shape';
    else if (row.source !== 'server-verification-adapter' || row.reviewStatus !== 'verified') reason = 'not-server-reviewed';
    else if (!identities.get(row.playerId)) reason = 'identity-not-reviewed';
    else if (row.campaignId !== rules.id || row.rulesHash !== frozen.rulesHash) reason = 'wrong-campaign-or-rules';
    else if (row.gameId !== rules.game.id || row.gameVersion !== rules.game.version || row.gameRuleset !== rules.game.ruleset) reason = 'wrong-game-version-or-ruleset';
    else if (row.adapterId !== rules.verification.runAdapterId || row.adapterVersion !== rules.verification.runAdapterVersion) reason = 'wrong-verification-adapter';
    else if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || startedAt < start || startedAt >= end || completedAt < startedAt || completedAt >= end) reason = 'outside-utc-window';
    else if (!Number.isFinite(reviewedAt) || reviewedAt < completedAt || reviewedAt > clock) reason = 'invalid-review-time';
    else if (row.completed !== true || row.paidAdvantagesUsed !== false || row.debugUsed !== false) reason = 'ineligible-gameplay';
    else if (row.metric !== rules.objective.metric || !unitIs(row.metricUnits)) reason = 'invalid-objective-evidence';
    else {
      const actual = BigInt(row.metricUnits), target = BigInt(rules.objective.targetUnits);
      const meets = rules.objective.operator === 'gte' ? actual >= target : rules.objective.operator === 'lte' ? actual <= target : actual === target;
      if (!meets) reason = 'target-not-reached';
    }
    if (reason) { rejected.push({ evidenceId: row.evidenceId, reason }); continue; }
    const records = accepted.get(row.playerId) || [];
    records.push({ evidenceId: row.evidenceId, completedAt: row.completedAt }); accepted.set(row.playerId, records);
  }
  const accounting = equalShares(rules.reward.poolUnits, accepted.size);
  const roster = [...accepted].sort(([a], [b]) => compare(a, b)).map(([playerId, records]) => {
    records.sort((a, b) => utcMillis(a.completedAt) - utcMillis(b.completedAt) || compare(a.evidenceId, b.evidenceId));
    return { playerId, units: accounting.perPlayerUnits, supportingEvidenceId: records[0].evidenceId, qualifyingAttemptCount: records.length };
  });
  rejected.sort((a, b) => compare(a.evidenceId, b.evidenceId));
  const { poolUnits: _poolUnits, ...asset } = rules.reward;
  return deepFreeze({ schemaVersion: 1, kind: 'campaign-allocation-dry-run', classification: manifest.classification, payable: false, launchReady: false, campaignId: rules.id, rulesHash: frozen.rulesHash, inputHash: contentHash(manifest), asOf, asset, accounting, roster, rejected, verificationNotice: 'Operator input assertions only. Identity, original evidence, funding and payout recipients are not authenticated by this offline tool.' });
}
