# TREE runtime partial-setup recovery

Status: **BLOCKED; do not enable checkout.** This runbook does not authorize credential disclosure or direct database changes.

## Verified facts

- Existing Supabase project `lehswszuekjqottolmsf`; five `tree_continue_<mode>_app_v1` login roles exist, with expected matching group memberships and `NOLOGIN` after the setup rollback.
- Six secrets exist by name: `TREE_CONTINUE_{ORDERS,SETTLEMENT,STORAGE,DELIVERY,RECOVERY}_DB_URL` and `TREE_CONTINUE_SETUP_TOKEN`. Presence is **not** proof that secret contents match database credentials.
- Owner confirmed shared transaction pooler `aws-1-us-east-2.pooler.supabase.com:6543`, database `postgres`, username format `<db_user>.lehswszuekjqottolmsf`. Dedicated pooler uses a different host; do not confuse the two.
- Setup generated SCRAM-SHA-256 verifiers with 16384 iterations. Supavisor current SCRAM code uses the stored verifier iteration count; no evidence establishes 16384 as the cause.
- Hosted checker returned 503 and Supavisor logged a password authentication failure for `tree_continue_orders_app_v1` during the setup attempt.
- Commerce remains disabled, with no configured checkout package and zero pilot allowance. Original short-lived Supabase PAT has been revoked.

## Preflight before a recovery implementation

1. Review the current setup code and checker on the `feature/paid-continue-delivery` branch. Preserve the original five role names, six secret names, and project-specific policy invariants. Never run the original installer again: it refuses pre-existing names by design.
2. Design a separate **recovery-only** tool, not an installer. Require owner confirmation and a short-lived project-scoped management token entered only locally. Never paste credentials into ChatGPT, GitHub, a shell transcript, or a screenshot.
3. Confirm the original setup batch tag on all five roles and exact expected memberships. Refuse to touch any unrelated role or existing service secret. Refuse if the policy enables orders/settlement, if a checkout deployment is set, or if a payment/receipt exists.
4. Check secret **names only** using the management API. Do not request secret plaintext via the chat connector or print/return it in diagnostic results. Review pooler host, port, tenant and username formatting against the official dashboard.
5. Reproduce the authentication path in an isolated disposable database/pooler fixture. Distinguish malformed URI, percent-encoding, SCRAM verifier generation, login state, Supavisor caching, and TLS errors. A 503 response alone is not a diagnosis.

## Controlled repair, only after reviewed implementation and tests

- Generate fresh independent strong passwords **locally** for the five existing app roles. Compute SCRAM verifiers locally; SQL must not contain plaintext passwords. Ensure each role retains `NOLOGIN` during preparation.
- Update the **corresponding five secret values** and role verifiers as one controlled maintenance operation, recognizing that database and secret-store writes are not atomic. Implement idempotent failure detection, no blind retry, and a documented rollback plan. Never reset the project `postgres` password.
- If an acceptance test requires enabling roles, do so only after secrets are committed and only for the exact tagged roles. Test with an authenticated, server-only checker. Confirm each role's exact function grants, no table write access, and disabled commerce policy. Disable roles again if any test fails.
- Return only fixed status codes, never passwords, connection strings, hashes, SCRAM verifiers, secret values, or provider error bodies. Revoke the temporary management token immediately after the attempt.
- Keep `new_orders_enabled=false`, `settlement_enabled=false`, deployment null and pilot cap zero throughout. Do not publish/enable a paid checkout, change game preview, or move tokens.

## Exit criteria

All five live hosted logins and least-privilege checks pass; disabled commerce policy is rechecked; evidence is recorded without secrets; only then continue with the separately reviewed checkout gateway and on-chain pilot acceptance. Until then, mark `RUNTIME CREDENTIALS VERIFIED` **false**.

Related: [Issue #55](https://github.com/TheCryptoArborist/tree-token.xyz/issues/55), draft PR #49. Relevant Mysten guidance: `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`.
