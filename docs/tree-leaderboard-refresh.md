# TREE leaderboard background refresh

The Phase 2.2B leaderboard is served from complete verified snapshots. The public status endpoint never starts a Sui GraphQL scan.

## Background endpoint

- Endpoint: `/.netlify/functions/tree-leaderboard-refresh-background`
- Method: `POST`
- Required request header: `x-tree-refresh-secret`
- Required server environment variable: `TREE_LEADERBOARD_REFRESH_SECRET`

The secret belongs only in Netlify environment variables. Deploy Preview requests must use the preview hostname, while production requests must use the production hostname. A `202` response means Netlify accepted the background request; it does not prove authentication succeeded or that the scan completed. Check completion through the public leaderboard endpoint.

Never paste the secret into GitHub, source files, browser code, screenshots, documentation, logs, or this repository. Use only the placeholder below:

```powershell
$headers = @{
  "x-tree-refresh-secret" = "<REFRESH_SECRET>"
}

Invoke-WebRequest `
  -Uri "https://deploy-preview-1--tree-token.netlify.app/.netlify/functions/tree-leaderboard-refresh-background" `
  -Method Post `
  -Headers $headers
```

## Public status endpoint

The status endpoint requires no secret:

```powershell
Invoke-RestMethod `
  -Uri "https://deploy-preview-1--tree-token.netlify.app/api/tree-leaderboard" `
  -Method Get |
ConvertTo-Json -Depth 12
```

Completion requires a `complete` background refresh and a public `ok` or `stale` response containing the verified snapshot. Partial or failed refreshes never replace an existing complete snapshot.

## Automatic production schedule

The production schedule is `17 */6 * * *`. Cron uses UTC, so the scheduled function runs at 00:17, 06:17, 12:17, and 18:17 UTC on published production deploys only.

The scheduled function invokes the protected Background Function and does not perform the complete Sui GraphQL scan itself. Deploy Previews do not run this schedule automatically; manual Deploy Preview refreshes remain available for testing.

Configure `TREE_LEADERBOARD_REFRESH_SECRET` for the production context before creating the production deployment. The scheduled trigger sends that value only in the `x-tree-refresh-secret` request header. Never place a real secret in this repository; documentation examples must continue to use `<REFRESH_SECRET>`.

The public leaderboard endpoint remains snapshot-only and never starts a Sui GraphQL scan.
