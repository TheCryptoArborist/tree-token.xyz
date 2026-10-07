# TREE secure runtime setup

One-time, owner-run setup for EXISTING Supabase project `lehswszuekjqottolmsf`. No contract, payment, quote key, gas transaction or checkout activation.

Extract the folder and double-click `Start TREE Setup.cmd` on Peter's Windows computer. Python 3.10+ with Tkinter is required; no PowerShell, Node, Supabase CLI or third-party Python modules. The utility opens the official Supabase access-token page. Create a short-lived personal access token, scoped to this project when available, with Project Settings Read, Database Read-write, Connection Pooling Read, and Edge Function Secrets Read-write. Classic tokens carry broader account access. Enter it only in the utility's hidden LOCAL field, never in chat or a screenshot. Review its confirmation, run once, and revoke the temporary token afterward.

The utility verifies the disabled policy and existing permission roles, refuses pre-existing application role/secret names, and retrieves the primary SCRAM transaction-pooler address from Supabase rather than guessing it. It creates five NEW restricted app logins, initially NOLOGIN, inherits only the matching role without ADMIN/SET permission, sets a four-connection limit, and submits SCRAM verifiers rather than cleartext database passwords in SQL. It then stores generated connection values directly in Supabase Secrets and enables only the new logins.

Environment contract: `TREE_CONTINUE_ORDERS_DB_URL`, `TREE_CONTINUE_SETTLEMENT_DB_URL`, `TREE_CONTINUE_STORAGE_DB_URL`, `TREE_CONTINUE_DELIVERY_DB_URL`, `TREE_CONTINUE_RECOVERY_DB_URL`, and `TREE_CONTINUE_SETUP_TOKEN`.

The deployed `tree-continue-runtime-check` function authenticates the dedicated setup bearer and performs read-only actual login, function-grant and disabled-policy checks. No platform-key fallback or browser-origin access is accepted. TLS certificate verification remains enabled. Success is `RUNTIME CREDENTIALS VERIFIED`; this means credentials work, not that monetary checkout has launched. The payment gateway remains unfinished.

No existing password/API key is reset. Values are not deliberately logged or saved locally; they necessarily exist briefly in process memory and are sent over authenticated HTTPS to Supabase. Python does not guarantee physical memory zeroization. Errors suppress response bodies. The token is not sent to ChatGPT.

On failure, the tool attempts to set only its own batch-tagged new logins back to NOLOGIN. It does not delete or reset existing credentials. Database and secret-store operations are not one atomic transaction, so a timeout may leave partial setup. Do not rerun a PARTIAL SETUP blindly; report only the nonsensitive status. Supabase's upsert-secret API has no conditional create-only option: use a quiet configuration window because a separate simultaneous operator can race the name check.

Supabase secrets are project-level; storing all app credentials there does not prove isolation from other functions or administrators. Further runtime isolation, role review, rotation, payment gateway, quote authority, receipt connection, eligibility and interruption handling remain release gates.

Tests: `test_setup.py` mocks the Management API; `runtime-check.test.mjs` mocks database responses. `runtime-pg.mjs` uses a real disposable PostgreSQL database and SCRAM logins, with a CI-only connection factory (not cloud TLS or API provisioning). `hosted-negative.mjs` makes three actual requests to the deployed endpoint without credentials. These do NOT claim Windows GUI acceptance, live credential provisioning, an installed-wallet test or mainnet purchase. Results must be read from the completed workflow; a source file is not proof it ran.

References checked: current MystenLabs/skills README, frontend-apps/SKILL.md and limitations.md; https://supabase.com/docs/guides/platform/personal-access-tokens ; https://supabase.com/docs/guides/functions/secrets ; https://supabase.com/docs/reference/api/v1-get-pooler-config ; https://supabase.com/docs/reference/api/v1-bulk-create-secrets ; https://supabase.com/docs/reference/api/v1-run-a-query . The query endpoint is documented experimental/beta; unexpected responses stop setup.
