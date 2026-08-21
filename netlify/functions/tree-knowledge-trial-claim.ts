import { createTreeKnowledgeTrialClaimHandler } from '../lib/tree-knowledge-trial-claim.ts';

const ENVIRONMENT_KEYS = [
  'TREE_KNOWLEDGE_TRIAL_CLAIMS_ENABLED',
  'TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_SUPABASE_URL',
  'TREE_RAFFLE_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_PACKAGE_ID',
  'TREE_RAFFLE_PRIZE_POOL_ID',
] as const;

function runtimeEnvironment() {
  const netlify = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get?: (name: string) => string | undefined } };
  }).Netlify;
  return Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [
    key,
    netlify?.env?.get?.(key) ?? process.env[key],
  ]));
}

export default (request: Request) => createTreeKnowledgeTrialClaimHandler({
  env: runtimeEnvironment(),
})(request);

export const config = { path: '/api/tree-knowledge-trial-claim' };
