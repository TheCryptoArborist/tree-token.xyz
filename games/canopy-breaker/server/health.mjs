const tables = ['accounts', 'runs', 'invoices', 'receipts', 'restarts', 'player_profiles', 'leaderboard_scores'];
export async function databaseHealth(database) {
  try {
    const result = await database.query("SELECT count(*)::integer AS total FROM information_schema.tables WHERE table_schema = 'breaker' AND table_name = ANY($1::text[])", [tables]);
    const ready = result.rows?.[0]?.total === tables.length;
    return Response.json({ready}, {status: ready ? 200 : 503, headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    return Response.json({ready: false}, {status: 503, headers: {'Cache-Control': 'private, no-store'}});
  }
}
