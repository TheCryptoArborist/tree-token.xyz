// Local planning only. A source reference or an operator entry is not a funded offer.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalJson, contentHash, equalShares, utcMillis } from './core.mjs';
import { ADAPTER, MAX_MOVES, createChallenge } from './trials-adapter.mjs';
import { verifyPilotRules } from './pilot-rules.mjs';

const ROOT = new URL('../../', import.meta.url);
const PILOT_PATH = 'data/arcade-challenge-pilot-november-2026.json';
const ENGINE_PATH = 'vendor/arcade-trials-engine/';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keysAre = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const textIs = (value, max = 600) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const idIs = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{1,127}$/.test(value);
const unitsIs = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value);
const same = (left, right) => { try { return canonicalJson(left) === canonicalJson(right); } catch { return false; } };
const oneOf = values => value => values.includes(value);
const isoUtc = value => Number.isFinite(utcMillis(value));

export const SETUP_PROPOSAL = Object.freeze({
  status: 'awaiting-operator-decisions-and-funded-design',
  workingTitle: 'Arborist Trials Weekly Practice Challenge',
  rulesBasis: 'review-pinned-pilot',
  objective: Object.freeze({ choice: 'win-one-match', metric: 'wins', operator: 'eq', targetUnits: '1', scope: 'single-attempt', classification: 'participation-practice', fundedSkillTargetEstablished: false }),
  attempts: Object.freeze({ choice: 'repeat-attempts-one-share', sharesPerReviewedPlayer: 1, weeklyStartLimit: null }),
  suggestedDurationDays: 7,
  allocation: Object.freeze({ method: 'equal-shares', residualPolicy: 'leave-unallocated', noQualifiersPolicy: 'leave-unallocated' }),
  identityOutcome: 'one-reviewed-player',
  campaignRequiredForEventEntry: false,
});

const FIELDS = [
  { id: 'challenge', title: 'Challenge', fields: [
    ['title', 'Campaign title', value => textIs(value, 100), 'Enter a short working title.'],
    ['rulesBasis', 'Rules to review', oneOf(['review-pinned-pilot']), 'Only review-pinned-pilot is available; this is a candidate, not funded rules.'],
    ['objectiveChoice', 'Proposed objective', oneOf(['win-one-match']), 'Only win-one-match is supported as a proposal. A multiple-win objective needs an aggregation implementation.'],
    ['attemptPolicy', 'Proposed attempt policy', oneOf(['repeat-attempts-one-share']), 'Only repeat-attempts-one-share is available as a proposal; no weekly start limit is implemented here.'],
  ] },
  { id: 'schedule', title: 'Schedule', fields: [
    ['startsAt', 'Start, inclusive (UTC)', isoUtc, 'Enter a real ISO UTC instant ending in Z.'],
    ['endsAt', 'End, exclusive (UTC)', isoUtc, 'Enter a real ISO UTC instant ending in Z.'],
  ] },
  { id: 'pool', title: 'Pool', fields: [
    ['network', 'Payout network', idIs, 'Enter one exact network identifier.'],
    ['assetId', 'Exact asset identifier', value => textIs(value, 256), 'Enter the exact asset identifier; a ticker alone is insufficient.'],
    ['symbol', 'Display ticker', value => typeof value === 'string' && /^[A-Z0-9]{1,16}$/.test(value), 'Use an uppercase display ticker of 1–16 letters or digits.'],
    ['decimals', 'Asset decimals', value => Number.isSafeInteger(value) && value >= 0 && value <= 30, 'Enter an integer from 0 to 30; the tool does not authenticate this metadata.'],
    ['poolUnits', 'Fixed pool in smallest units', value => unitsIs(value) && BigInt(value) > 0n, 'Enter a positive exact integer string, never a floating-point amount.'],
  ] },
  { id: 'playersAndReview', title: 'Players and review', fields: [
    ['identityMethod', 'How one player is reviewed', value => textIs(value), 'Describe the proposed player and linked-wallet review method. Wallet possession alone is insufficient.'],
    ['identityReviewerId', 'Identity reviewer', idIs, 'Name the accountable reviewer identifier; this entry is not authenticated.'],
    ['recipientReviewMethod', 'How payout recipients are reviewed', value => textIs(value), 'Describe how the recipient and selected network would be checked.'],
    ['reviewEndsAt', 'Review/correction deadline (UTC)', isoUtc, 'Enter a real ISO UTC instant after campaign close.'],
    ['payoutTiming', 'Proposed payout timing', value => textIs(value), 'Describe when payment would follow completed review and funding checks.'],
    ['correctionPolicy', 'Corrections and disputes', value => textIs(value, 1000), 'Describe how players can correct a missing or disputed result.'],
  ] },
  { id: 'associatedEvent', title: 'Associated Event', fields: [
    ['id', 'Actual associated Event', idIs, 'Select a real Event identifier; the pilot does not establish a pairing.'],
    ['href', 'Event details path', value => typeof value === 'string' && /^\/play\/(?:[a-z0-9/_-]*)(?:#[a-z0-9-]+)?$/.test(value), 'Use the actual Event path under /play/.'],
  ] },
  { id: 'finalTerms', title: 'Final terms', fields: [
    ['residualPolicy', 'Indivisible residual units', oneOf(['leave-unallocated']), 'The supported proposal is leave-unallocated; no automatic spending or carryover.'],
    ['noQualifiersPolicy', 'If nobody qualifies', oneOf(['leave-unallocated']), 'The supported proposal is leave-unallocated; the whole pool stays unallocated.'],
    ['cancellationPolicy', 'Cancellation and unused funding', value => textIs(value, 1000), 'Describe cancellation and unused-funding handling.'],
  ] },
];

/** Reads fixed repository paths only. The optional reader is an offline test seam. */
export async function loadSetupSource(read = url => readFile(url)) {
  const paths = [PILOT_PATH, ENGINE_PATH + 'provenance.json', 'scripts/arcade-campaigns/trials-adapter.mjs', 'scripts/arcade-campaigns/pilot-rules.mjs'];
  const [pilotBytes, provenanceBytes, adapterBytes, rulesBytes] = await Promise.all(paths.map(path => read(new URL(path, ROOT))));
  const pilot = JSON.parse(String(pilotBytes)), provenance = JSON.parse(String(provenanceBytes));
  if (!keysAre(pilot, ['rulesHash', 'rules'])) throw Error('Pinned pilot record has an unsupported shape.');
  const verified = verifyPilotRules(pilot.rules);
  if (pilot.rulesHash !== verified.rulesHash) throw Error('Pinned pilot rule hash does not match its exact rules.');
  const { sourceHash, liveParityClaimed, ...pinned } = provenance;
  if (contentHash(pinned) !== sourceHash || sourceHash !== ADAPTER.sourceHash || liveParityClaimed !== false) throw Error('Pinned engine provenance changed.');
  if (!Array.isArray(provenance.sources) || !Array.isArray(provenance.runtime) || provenance.sources.length !== 5 || provenance.runtime.length !== 5) throw Error('Pinned engine file inventory changed.');
  await Promise.all([...provenance.sources, ...provenance.runtime].map(async file => {
    if (!/^(?:upstream|runtime)\/[a-zA-Z0-9.-]+$/.test(file.path)) throw Error('Pinned engine file path is invalid.');
    const bytes = await read(new URL(ENGINE_PATH + file.path, ROOT));
    if (sha256(bytes) !== file.sha256) throw Error('Pinned engine bytes changed: ' + file.path);
  }));
  const rules = verified.rules;
  // This fixed seed is used only to inspect date-specific rules, never for play.
  const challenge = createChallenge('0'.repeat(64), rules.challengeDate);
  return {
    referenceKind: 'checked-in-no-prize-pilot-source',
    pilotConfigPath: PILOT_PATH,
    pilotId: rules.pilotId,
    pilotRulesHash: verified.rulesHash,
    game: clone(rules.game),
    adapter: clone(rules.adapter),
    challengeDate: rules.challengeDate,
    variant: { id: challenge.trial.rule, title: challenge.trial.title, targetGrowth: challenge.trial.targetGrowth, playerStartGrowth: challenge.trial.playerStartGrowth, botStartGrowth: challenge.trial.botStartGrowth },
    engine: challenge.engine,
    maxAttemptSeconds: rules.maxAttemptSeconds,
    maxMoves: MAX_MOVES,
    dealRules: {
      standardCardsPerSide: rules.access.standardCards,
      guaranteedTypes: ['attack', 'growth', 'hybrid'],
      fourthCard: 'another-distinct-standard-card',
      hands: 'separately-dealt-per-attempt',
      fifthCardEnabled: challenge.fifthMoveUnlocked,
      equalHandStrengthGuaranteed: false,
      chanceEffectsPresent: true,
    },
    currentPilotObjective: clone(rules.objective),
    access: clone(rules.access),
    identityScope: rules.identityScope,
    implementationHashes: { adapterSha256: sha256(adapterBytes), pilotRulesSha256: sha256(rulesBytes) },
  };
}

/** Creates an offline planning envelope, never a campaign or a funding record. */
export function createSetup(sourceKnown) {
  return {
    schemaVersion: 1, kind: 'offline-weekly-campaign-setup', status: 'draft', payable: false, launchReady: false,
    sourceKnown: clone(sourceKnown), proposal: clone(SETUP_PROPOSAL),
    decisions: Object.fromEntries(FIELDS.map(section => [section.id, Object.fromEntries(section.fields.map(([field]) => [field, null]))])),
  };
}

export function validateSetup(setup, sourceKnown) {
  const issues = [], missingDecisions = [];
  const add = (path, message) => issues.push({ path, message });
  if (!keysAre(setup, ['schemaVersion', 'kind', 'status', 'payable', 'launchReady', 'sourceKnown', 'proposal', 'decisions'])) return { valid: false, decisionsComplete: false, issues: [{ path: '$', message: 'Use the exact offline setup envelope; unknown or missing fields are rejected.' }], missingDecisions };
  if (setup.schemaVersion !== 1 || setup.kind !== 'offline-weekly-campaign-setup' || setup.status !== 'draft') add('$', 'Use the version-1 offline draft setup.');
  if (setup.payable !== false || setup.launchReady !== false) add('$', 'Setup records must remain nonpayable and not launch-ready.');
  if (!same(setup.sourceKnown, sourceKnown)) add('sourceKnown', 'The source reference drifted from the checked-in pilot, adapter or engine. Review the new source explicitly; do not silently refresh this record.');
  if (!same(setup.proposal, SETUP_PROPOSAL)) add('proposal', 'Use the supported, explicitly unconfirmed proposal. Different objectives, attempt limits or reward methods require new reviewed implementation.');
  if (!keysAre(setup.decisions, FIELDS.map(section => section.id))) {
    add('decisions', 'Use exactly the six setup sections.');
    return { valid: false, decisionsComplete: false, issues, missingDecisions };
  }
  for (const section of FIELDS) {
    const values = setup.decisions[section.id], missing = [];
    if (!keysAre(values, section.fields.map(([field]) => field))) { add('decisions.' + section.id, 'Use the exact fields for ' + section.title + '; unknown and missing fields are rejected.'); continue; }
    for (const [field, label, valid, message] of section.fields) {
      const path = 'decisions.' + section.id + '.' + field;
      if (values[field] === null) missing.push({ path, label });
      else if (!valid(values[field])) add(path, message);
    }
    if (missing.length) missingDecisions.push({ section: section.id, title: section.title, fields: missing });
  }
  const schedule = setup.decisions.schedule, review = setup.decisions.playersAndReview;
  if (plain(schedule) && isoUtc(schedule.startsAt) && isoUtc(schedule.endsAt) && utcMillis(schedule.endsAt) <= utcMillis(schedule.startsAt)) add('decisions.schedule.endsAt', 'The exclusive end must follow the inclusive start.');
  if (plain(schedule) && plain(review) && isoUtc(schedule.endsAt) && isoUtc(review.reviewEndsAt) && utcMillis(review.reviewEndsAt) <= utcMillis(schedule.endsAt)) add('decisions.playersAndReview.reviewEndsAt', 'The correction/review deadline must follow campaign close.');
  return { valid: issues.length === 0, decisionsComplete: issues.length === 0 && missingDecisions.length === 0, issues, missingDecisions };
}

export function formatExactUnits(units, decimals) {
  if (!unitsIs(units) || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 30) throw Error('Use exact integer units and supported decimals.');
  if (!decimals) return units;
  const digits = units.padStart(decimals + 1, '0');
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

export function reviewSetup(setup, sourceKnown) {
  const validation = validateSetup(setup, sourceKnown);
  if (!validation.valid) throw Error('Invalid setup: ' + validation.issues.map(issue => issue.path + ': ' + issue.message).join(' '));
  const pool = setup.decisions.pool;
  const sharePreview = Object.values(pool).every(value => value !== null) ? {
    kind: 'hypothetical-share-examples', inputClassification: 'operator-entered-not-verified',
    asset: clone(pool), poolAmount: formatExactUnits(pool.poolUnits, pool.decimals),
    scenarios: [0, 1, 5, 10, 25].map(qualifierCount => {
      const accounting = equalShares(pool.poolUnits, qualifierCount);
      return { ...accounting, perPlayerAmount: formatExactUnits(accounting.perPlayerUnits, pool.decimals), unallocatedAmount: formatExactUnits(accounting.unallocatedUnits, pool.decimals) };
    }),
    notice: 'Illustrative counts, not live qualifiers or a promised payment. Entered asset metadata, funding and recipients are not verified. The final share would follow completed eligibility review.',
  } : null;
  return {
    schemaVersion: 1, kind: 'offline-weekly-campaign-setup-review', payable: false, launchReady: false,
    operatorClaimsAuthenticated: false, productionIntegrationReady: false,
    decisionsComplete: validation.decisionsComplete,
    sourceStatus: 'matches-checked-in-pilot-source',
    sourceKnown: clone(sourceKnown), proposal: clone(setup.proposal),
    sections: FIELDS.map(section => ({ id: section.id, title: section.title, fields: section.fields.map(([field, label]) => ({ path: 'decisions.' + section.id + '.' + field, label, value: setup.decisions[section.id][field], status: setup.decisions[section.id][field] === null ? 'not-selected' : 'operator-entered-not-verified' })) })),
    missingDecisions: validation.missingDecisions, sharePreview,
    limitations: [
      'Entered choices are an offline proposal. They do not publish terms, verify a person, prove funding or authorize a payment.',
      'The win-one choice is an accessible participation/practice candidate, not an established demanding skill threshold. Objective and attempt preferences remain subject to difficulty review; changing a target cannot create multi-win aggregation.',
      'The pilot deals variable four-card hands with chance effects. Balanced card types do not guarantee equal hand strength, pure skill or resistance to automation.',
      'No weekly attempt-start limit is implemented here. The pilot active-attempt cap is a concurrency limit, not a weekly allowance; any future allowance must count starts, including abandoned and expired attempts, per reviewed player.',
      'Wallet authentication does not establish a unique person. Identity methods and reviewer identifiers entered here are unverified operator assertions.',
      'Existing no-prize pilot results remain ineligible for funded rewards. A funded window requires its own authoritative records, rules, qualification and payout integration.',
      'The associated Event and its entry rules need independent confirmation. A general Events link does not establish a game-specific pairing.',
    ],
  };
}

const markdownText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|\-]/g, '\\$&');
const display = value => value === null ? '**Not selected**' : markdownText(value);

export function formatSetupReview(review) {
  const s = review.sourceKnown;
  const lines = [
    '# Weekly campaign setup — offline review', '',
    '**Status:** ' + (review.decisionsComplete ? 'All planning choices entered; funded integration remains pending.' : 'Planning choices remain open.'),
    '**Payable:** No · **Launch-ready:** No · **Operator claims authenticated:** No', '',
    '## Source-known starting point', '',
    'These facts match the checked-in no-prize pilot. They are a proposed starting point for a future campaign.', '',
    '- Game: ' + markdownText(s.game.id) + ' · build ' + markdownText(s.game.version) + ' · ruleset ' + markdownText(s.game.ruleset),
    '- Adapter: ' + markdownText(s.adapter.id) + ' v' + markdownText(s.adapter.version),
    '- Fixed rules date: ' + markdownText(s.challengeDate) + ' · variant: ' + markdownText(s.variant.title) + ' (' + markdownText(s.variant.id) + ')',
    '- Growth: ' + s.variant.playerStartGrowth + ' / ' + s.variant.botStartGrowth + ' at start; target ' + s.variant.targetGrowth + '.',
    '- Pilot limits: ' + s.maxAttemptSeconds + ' seconds per attempt and ' + s.maxMoves + ' moves; session expiry and pilot close can shorten the time.',
    '- Deal: four separately dealt standard cards per side; attack, growth, hybrid, then another distinct standard card. No fifth card or paid advantage. Hands and chance effects vary.',
    '- Pilot rule hash: `' + s.pilotRulesHash + '`',
    '- Engine source hash: `' + s.game.sourceHash + '`', '',
    '## Proposed first campaign', '',
    markdownText(review.proposal.workingTitle) + ': an accessible participation/practice candidate using one single-attempt win, repeat attempts with one equal share per reviewed qualifying player, and a suggested seven-day window. This is not an established demanding skill threshold. Difficulty, identity, dates, pool and Event pairing remain operator decisions. This proposal creates no offer.', '',
  ];
  review.sections.forEach((section, index) => {
    lines.push('## ' + (index + 1) + '. ' + section.title, '', '| Choice | Entered value |', '| --- | --- |');
    for (const field of section.fields) lines.push('| ' + field.label + ' | ' + display(field.value) + ' |');
    lines.push('');
  });
  lines.push('## Allocation preview', '');
  if (!review.sharePreview) lines.push('Enter all five pool fields to see exact-unit share examples. No budget, token or payout network has been inferred.', '');
  else {
    const preview = review.sharePreview;
    lines.push('Operator-entered pool: **' + markdownText(preview.poolAmount + ' ' + preview.asset.symbol) + '** on ' + markdownText(preview.asset.network) + '. Asset identity and decimals are not verified.', '', '| Illustrative qualifiers | Equal amount per player | Unallocated amount | Reason |', '| ---: | ---: | ---: | --- |');
    for (const row of preview.scenarios) lines.push('| ' + row.qualifierCount + ' | ' + markdownText(row.perPlayerAmount + ' ' + preview.asset.symbol) + ' | ' + markdownText(row.unallocatedAmount + ' ' + preview.asset.symbol) + ' | ' + markdownText(row.reason) + ' |');
    lines.push('', preview.notice, '');
  }
  lines.push('## Remaining choices', '');
  if (!review.missingDecisions.length) lines.push('All planning fields are filled. This is still an offline, unverified proposal; it does not make a campaign payable or launch-ready.', '');
  else {
    for (const group of review.missingDecisions) lines.push('- **' + group.title + ':** ' + group.fields.map(field => field.label).join('; ') + '.');
    lines.push('');
  }
  lines.push('## Practical boundaries', '', ...review.limitations.map(note => '- ' + note), '');
  return lines.join('\n');
}
