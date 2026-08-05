import {
  readCompleteLeaderboardSnapshot,
  resolveLeaderboardRefresh,
  writeCompleteLeaderboardSnapshot,
} from '../lib/leaderboard-cache.ts';
import { readSuiGraphqlConfig, scanSuiGraphqlLeaderboard } from '../lib/sui-graphql-leaderboard-provider.ts';

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }

  const context = Netlify.env.get('CONTEXT') || 'dev';
  const branch = Netlify.env.get('BRANCH') || 'local';
  const scan = await scanSuiGraphqlLeaderboard(readSuiGraphqlConfig());
  const cacheWarnings: string[] = [];

  if (scan.outcome === 'complete') {
    try {
      await writeCompleteLeaderboardSnapshot(scan, { context, branch });
    } catch (error) {
      console.error('TREE leaderboard complete snapshot cache write failed', error);
      cacheWarnings.push('The complete scan could not be saved to the server-side snapshot cache.');
    }
  }

  let cached = null;
  if (scan.outcome !== 'complete') {
    try {
      cached = await readCompleteLeaderboardSnapshot({ context, branch });
    } catch (error) {
      console.error('TREE leaderboard complete snapshot cache read failed', error);
      cacheWarnings.push('The last complete server-side snapshot could not be read.');
    }
  }

  const payload = resolveLeaderboardRefresh(scan, cached);
  payload.warnings.push(...cacheWarnings);
  const hasCompleteRows = payload.status === 'ok' || payload.status === 'stale';
  return Response.json(payload, {
    headers: {
      'Cache-Control': hasCompleteRows
        ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
        : 'no-store',
    },
  });
};

export const config = { path: '/api/tree-leaderboard' };
