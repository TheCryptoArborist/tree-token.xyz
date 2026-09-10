import { createTreeKnowledgeTrialAdminHandler } from '../lib/tree-knowledge-trial-admin.ts';

const ENVIRONMENT_KEYS = [
  'TREE_KNOWLEDGE_TRIAL_ADMIN_SECRET',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL',
  'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY',
  'TREE_RAFFLE_SUPABASE_URL',
  'TREE_RAFFLE_SUPABASE_SECRET_KEY',
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

export default (request: Request) => createTreeKnowledgeTrialAdminHandler({
  env: runtimeEnvironment(),
})(request);

export const config = { path: '/api/tree-knowledge-trial-admin' };
