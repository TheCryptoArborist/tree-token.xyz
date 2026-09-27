import { createTreeKnowledgeTrialCorrectionHandler } from '../lib/tree-knowledge-trial-correction.ts';

const ENVIRONMENT_KEYS = [
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

export default (request: Request) => createTreeKnowledgeTrialCorrectionHandler({
  env: runtimeEnvironment(),
})(request);

export const config = { path: '/api/tree-knowledge-trial-correction' };
