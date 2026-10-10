# Credential recovery review — 2026-10-10

**Decision: HOLD live execution.** The offline suite passed 20 tests in GitHub Actions run 38018243239. This is not a production credential acceptance test.

## Code reviewed
- `services/canopy-credits/runtime-setup/recover_existing.py`
- `recovery_preflight.py`, `tree_runtime_setup.py`
- `tests/test_existing_recovery.py` and the recovery CI workflow

## Validated offline
- Generated SCRAM verifier construction and shared pooler selection
- Guarded existing-role password rotation SQL and login enable/disable statements
- Fail-closed preflight for disabled roles, setup tags, exact memberships, project and policy
- Explicit owner confirmation and secret-suppressing status output

## Unresolved blockers before live use
1. **No end-to-end mocked recovery sequence test.** Current six recovery tests cover SQL generation, rejection, and decline, but not success, secret-write failure, pooler rejection, rollback failure, or a partial state after DB write. Add these tests.
2. **Non-atomic updates.** Database role-password changes and Edge Function secret updates cannot be committed atomically. A failed secret update can strand the accounts with a password mismatch. The script disables accounts on failure, but does not restore the previous passwords. This must be explicitly accepted with a tested recovery-from-partial plan.
3. **Hosted acceptance is not proven.** The read-only Edge Function checker failed authentication in the original setup. The new tool still uses the same checker. Determine whether failure was caused by the credential mismatch or another Supavisor behavior before claiming repair.
4. **Secret replacement scope.** The management API POST upserts all six secrets, including the setup token. Verify that the target names are exactly the six expected ones and that no unrelated secrets are modified.
5. **Failure reporting.** The script currently collapses all post-write errors to `partial-setup`; ensure the owner sees that the outcome is uncertain and does not rerun automatically. Confirm logins are NOLOGIN after failure with a separate read-only query.

## Safety gates
- No reset of the project's `postgres` password.
- No secrets in GitHub, chat, screenshots, CI output or client-side game.
- Do not merge PR #49 or enable checkout.
- Do not run the recovery script on production until the above tests and independent code review are complete.
- Require an owner-run short-lived scoped PAT only at the actual approved maintenance window, and revoke afterward.

## Guidance
Current Mysten `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`: database credentials remain server-side. See Issue #55.

## Update — corrected CI and code re-review (2026-10-10)

- GitHub Actions [run 38018563371](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/38018563371), job 114114256587: **53 tests, all passed**, including HOLD-mode default, SQL guards and mocked integration failures.
- Reviewed `recover_existing.py` again: default entry point does not prompt for a token or write without `--execute`; rotation precedes secret update, which precedes role activation; on post-write exception it attempts NOLOGIN and reports partial setup; no automatic write retry.
- **Live approval remains HOLD.** Database and secret writes are non-atomic; failed rollback can leave login state uncertain. Mocked tests cannot prove production pooler authentication, and the code does not implement an independent direct verifier/secret correspondence check.
- Before any production invocation: independently review and approve credential rotation's partial-state recovery and verify a fresh role-state query can establish NOLOGIN after failures. Use only owner-held, short-lived, scoped Supabase PAT entered locally. Never expose token or connection strings in chat/CI.
- No credentials rotated, no payment enablement, no production deployment performed during this review.
