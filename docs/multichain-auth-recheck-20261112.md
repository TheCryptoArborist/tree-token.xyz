# Multichain pilot deployment authentication recheck

Checked November 12, 2026 at 20:45 UTC (2:45 PM Central).

## Corrected Phase 1, Step 1

Resolve the credential used by the TREE repository's GitHub Actions preservation publisher. Do not describe this as restoring the user's overall Netlify account connection, and do not revoke or replace credentials across unrelated projects.

The connected Netlify app and the GitHub Actions runner use separate authentication paths. A successful Git-linked Netlify build does not validate the Netlify API credential supplied to a custom Actions workflow.

## Fresh observations

1. The connected Netlify app successfully returned the authenticated user's profile and projects. TREE and Tree251 belong to the same Netlify team.
2. Tree251's current production deploy is `6af5d9507ba1638d5f9e87d9`. It was published November 12 at 15:21:49 UTC (9:21:49 AM Central), is ready, has a build ID, is marked `manual_deploy: false`, and is linked to GitHub commit `d7a24bd3a992eb5c606b2f49f5aa7350546117a1`.
3. The TREE project's published deployment remained `6af4ef567e67ea8af9abe8ed` in the current project lookup. No production deployment was attempted during this recheck.
4. The successful November 11 Canopy Crown USDC workflow uses `secrets.NETLIFY_AUTH_TOKEN`, the same secret name as the pilot. Run `43113929057` completed successfully. A shared secret name does not establish that its underlying value has remained unchanged.
5. A new diagnostic ran directly in the pilot branch's GitHub Actions environment, using only GET requests and the existing secret. It did not output the credential or modify it.

## Fresh GitHub Actions diagnostic

Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/43303459174

Job: `131480415032`.

The diagnostic itself completed successfully; this means the tests ran, not that authentication passed.

- Secret was populated: true.
- Leading or trailing whitespace: false.
- Anonymous `GET /api/v1/user` control: HTTP 401.
- `GET /api/v1/user` with the Actions secret: HTTP 401.
- TREE deploy-detail request: HTTP 200, but without function or schedule inventories.
- TREE protected file-inventory request: HTTP 401.
- TREE protected function-inventory request: HTTP 401.
- Tree251 deploy-detail request using that same Actions secret: HTTP 200, but without function or schedule inventories.
- Tree251 protected file-inventory request using that same Actions secret: HTTP 401.
- Tree251 protected function-inventory request using that same Actions secret: HTTP 401.

## Interpretation and limits

The API credential supplied to the TREE repository's Actions job is currently rejected even at the user-authentication endpoint and when inspecting the working Tree251 project. This is not evidence of an account-wide Netlify outage, a problem unique to the pilot URL, or a failure of the connected Netlify app.

The observed responses do not establish whether the stored value expired, was revoked, was replaced, or is otherwise incorrect. No claim is made that it needs to be restored across the account. Secret values were not read back, exported, logged, or changed.

For this existing Actions/API publisher, a working credential is required. Alternatively, a different authenticated publication route would need to be verified as capable of preserving the full live inventory. The currently exposed Netlify app actions permit authenticated reads but do not include deploy creation, file upload, or publication.

Do not replace the live TREE site with the historical root snapshot simply because Git-linked publishing works for another project. Repository guidance requires a fresh complete live inventory and preservation of all existing paths, functions, schedules, and runtime configuration.

## Changes made during this review

Only the isolated pilot branch's read-only diagnostic workflow and this report were added or updated. No merge to main, Netlify setting change, secret change, production publication, contract deployment, or wallet action was performed.

## References checked

- Current MystenLabs/skills README: reviewed; this recheck changes no Sui code or blockchain design, so no Sui-specific implementation skill is needed.
- Netlify deployment coding context.
- Netlify official API authentication and Git continuous deployment documentation.
- Repository AGENTS.md and the successful Canopy Crown USDC workflow and API authentication implementation.
