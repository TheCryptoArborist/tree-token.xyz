import { fetchDirectTreeLeaderboard, LEADERBOARD_COVERAGE, METHODOLOGY_VERSION } from '../lib/leaderboard-provider.ts';

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }
  const generatedAt = new Date().toISOString();
  const apiKey = Netlify.env.get('BLOCKVISION_API_KEY') || '';
  if (!apiKey) {
    return Response.json({
      status: 'not-configured', generatedAt, methodologyVersion: METHODOLOGY_VERSION,
      coverage: LEADERBOARD_COVERAGE, holderCount: null, entries: [],
      warnings: ['BlockVision leaderboard data is not configured.'],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const result = await fetchDirectTreeLeaderboard(apiKey);
    return Response.json({
      status: 'ok', generatedAt, methodologyVersion: METHODOLOGY_VERSION,
      coverage: LEADERBOARD_COVERAGE, holderCount: result.holderCount,
      entries: result.entries, warnings: ['Phase 2.1 ranks direct wallet-held TREE only. Other exposure is not yet covered.'],
    }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' } });
  } catch (error) {
    console.error('TREE leaderboard request failed', error);
    return Response.json({
      status: 'error', generatedAt, methodologyVersion: METHODOLOGY_VERSION,
      coverage: LEADERBOARD_COVERAGE, holderCount: null, entries: [],
      warnings: ['BlockVision leaderboard data is temporarily unavailable.'],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
};

export const config = { path: '/api/tree-leaderboard' };
