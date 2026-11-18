// Deliberately fictional units, game, players and verifier. Never an offer.
import { contentHash, freezeDraft } from './core.mjs';

export function syntheticDemo() {
  const draft = {
    schemaVersion: 1, status: 'draft', id: 'synthetic-campaign-only', title: 'Synthetic arithmetic demonstration — not an offer', rulesVersion: 1,
    game: { id: 'synthetic-game', version: 'fixture-v1', ruleset: 'synthetic-rules' },
    window: { startsAt: '2000-01-01T00:00:00.000Z', endsAt: '2000-01-08T00:00:00.000Z' },
    reward: { network: 'offline:synthetic', assetId: 'SYNTHETIC-NONTRANSFERABLE-UNITS', symbol: 'TEST', decimals: 0, poolUnits: '10' },
    objective: { id: 'synthetic-target', description: 'Fictional test metric of at least 100; no real game or reward.', metric: 'synthetic-score', operator: 'gte', targetUnits: '100' },
    eligibility: { entry: 'free', purchaseRequired: false, identityPolicy: 'one-verified-player', paidAdvantages: 'forbidden', attempts: 'repeat-attempts-one-share' },
    allocation: { method: 'equal-shares', residualPolicy: 'leave-unallocated', noQualifiersPolicy: 'leave-unallocated' },
    verification: { runAdapterId: 'synthetic-verifier', runAdapterVersion: 'fixture-v1', identityReviewerId: 'synthetic-reviewer' },
    associatedEvent: { id: 'synthetic-event-only', href: '/play/#events', campaignRequiredForEntry: false },
    cancellationPolicy: 'Synthetic fixture only. No funding exists and no transfers can occur.'
  };
  const frozen = freezeDraft(draft), asOf = '2000-01-09T00:00:00.000Z';
  const identity = playerId => ({ playerId, identityEvidenceId: 'synthetic-identity-' + playerId, status: 'verified', source: 'operator-identity-review', reviewerId: draft.verification.identityReviewerId, reviewedAt: asOf });
  const run = (playerId, suffix) => ({
    evidenceId: 'synthetic-evidence-' + suffix, evidenceSha256: contentHash({ syntheticEvidence: suffix }), playerId, campaignId: draft.id, rulesHash: frozen.rulesHash,
    gameId: draft.game.id, gameVersion: draft.game.version, gameRuleset: draft.game.ruleset,
    adapterId: draft.verification.runAdapterId, adapterVersion: draft.verification.runAdapterVersion,
    source: 'server-verification-adapter', reviewStatus: 'verified', reviewedAt: asOf,
    startedAt: '2000-01-03T00:00:00.000Z', completedAt: '2000-01-03T00:05:00.000Z', metric: draft.objective.metric, metricUnits: '100',
    completed: true, paidAdvantagesUsed: false, debugUsed: false
  });
  const manifest = {
    schemaVersion: 1, purpose: 'offline-dry-run', classification: 'synthetic-fixture', campaignId: draft.id, rulesHash: frozen.rulesHash,
    identities: ['synthetic-alice', 'synthetic-bob', 'synthetic-carol'].map(identity),
    runs: [run('synthetic-alice', 'a1'), run('synthetic-alice', 'a2'), run('synthetic-bob', 'b1'), run('synthetic-carol', 'c1')]
  };
  return { draft, frozen, manifest, asOf };
}
