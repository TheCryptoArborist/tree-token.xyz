import { runOnce } from '../src/worker.mjs';
import { ENV_KEYS } from '../src/config.mjs';
import type { Config } from '@netlify/functions';

// Package separately. This directory is intentionally excluded from the live
// website's default functions directory until a preserved-package release.
export default async (_request: Request) => {
  try {
    const env = Object.fromEntries(ENV_KEYS.map(key => [key, Netlify.env.get(key)]));
    const result = await runOnce({ env });
    console.log(JSON.stringify({ job: 'tree-telegram-notify', ...result }));
    return Response.json(result);
  } catch {
    console.error('TREE Telegram notification worker failed; inspect queue status.');
    return Response.json({ status: 'error' }, { status: 503 });
  }
};

export const config: Config = { schedule: '* * * * *' };
