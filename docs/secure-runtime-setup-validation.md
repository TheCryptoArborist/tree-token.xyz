# TREE secure runtime setup — implemented and validated

## Completed scope

Implementation and test revision: `501b5b65135ebf3f7324b89fdae609bedc7601a0`, on `feature/paid-continue-delivery`, draft PR #49. No production, auth-preview, or game branch was advanced.

The new `services/canopy-credits/runtime-setup/` directory contains a Python 3.10+ standard-library setup utility, a Windows double-click launcher, documentation, the read-only hosted checker source, and tests. The utility requires Tkinter for its GUI. It is an owner-run setup tool, not a payment gateway or a completed credential installation.

Native Supabase deployment succeeded for `tree-continue-runtime-check`, version 1, function ID `6c3e69cf-79c1-4749-9ac2-821b74af350d`, bundle SHA256 `fda66033305296386188f46c860346a46879bffa723583579dd4a3aa7712bc9d`. The source matches the committed checker. Platform JWT checking is disabled because the function implements custom dedicated setup-bearer authentication; it has no generic platform-key fallback. It does not call order, settlement, checkpoint approval, or gameplay activation functions.

## Owner action still required

Extract the provided utility folder and double-click `Start TREE Setup.cmd`. Create a short-lived Supabase personal access token using the utility's button to the official token page. Where project-scoped tokens are available, limit it to this existing project and the documented Project Settings Read, Database Read-write, Connection Pooling Read, and Edge Function Secrets Read-write permissions. Classic tokens have broader account access. Enter the token ONLY into the hidden field in the local utility; never into ChatGPT, source control, or screenshots. Revoke the temporary token after setup.

The utility verifies the project and disabled commerce policy, obtains the primary transaction-pooler configuration from Supabase, and refuses existing application-role or target-secret names. On explicit local confirmation, it creates five NEW restricted application logins in NOLOGIN state. Passwords are generated on the owner's computer; SQL contains SCRAM password verifiers rather than cleartext passwords. Each login inherits only its matching existing permission role with no ADMIN or SET-role right and a four-connection limit.

It stores the five connection values and a separate checker bearer directly in Supabase Secrets, then enables only its new batch-tagged logins and requests read-only hosted verification. Success is displayed only after actual login/permission checks and a final disabled-policy read: `RUNTIME CREDENTIALS VERIFIED`. That status confirms credentials, not payment readiness.

Secret names are `TREE_CONTINUE_ORDERS_DB_URL`, `TREE_CONTINUE_SETTLEMENT_DB_URL`, `TREE_CONTINUE_STORAGE_DB_URL`, `TREE_CONTINUE_DELIVERY_DB_URL`, `TREE_CONTINUE_RECOVERY_DB_URL`, and `TREE_CONTINUE_SETUP_TOKEN`. No wallet key, existing database password, project API-key reset, or checkout-signing key is involved.

If setup fails, it attempts to disable only the newly tagged application logins. It does not delete unrelated secrets, reset existing passwords, or retry credential writes. A partial result requires inspection, not repeated blind reruns. Database and secret-store writes are not one atomic operation. Supabase's upsert-secret endpoint has no conditional-create option; a separate simultaneous operator could race the name checks, so use a quiet configuration window.

## Executed validation

Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/37563350811
Job: `112605394566` (`runtime-setup`). Completed SUCCESS including cleanup. Its full completed log was read.

- 24 Python setup scenarios passed, with a controlled Management API fixture.
- 32 JavaScript request, URL, role, error-handling, and read-only-check scenarios passed, with injected database responses.
- 7 actual disposable PostgreSQL scenarios passed: SCRAM-verifier authentication, NOLOGIN denial, all five restricted session logins, incorrect-password denial, overlapping-role denial, existing-role protection, and batch-scoped disabling with purchases still off.
- 3 actual hosted negative HTTP scenarios passed: GET rejected with 405, browser-origin request rejected with 403, and unconfigured setup rejected with 503. All reported credentialsVerified=false, paymentsEnabled=false and restoreAuthorized=false.
- Total: 63 isolated scenarios plus 3 hosted negative scenarios, 66 distinct tests; no failures or skips in those suites.

The workflow used Node v22.23.3 and a disposable PostgreSQL 17.11 service with SCRAM host authentication. The real database tests used a CI-only connection factory mapping cloud-style descriptors to the disposable loopback database. They do NOT establish Supabase pooler compatibility, cloud database TLS acceptance, or a completed live Management API provisioning run. The hosted negative checks prove the deployed Deno handler responds and rejects those requests; they do not test authenticated hosted database connections.

Existing scoped-commerce regression run `37563350686`, job `112605395020`, and broad paid-delivery regression run `37563350680`, job `112605394427`, also completed SUCCESS including cleanup. Their completed step summaries were inspected. A new full raw-log review of those two regression jobs is not claimed. The older game/browser suites retain their documented fixture boundaries and are not live payment tests.

No Windows GUI acceptance, installed-wallet transaction, mainnet purchase, independent security audit, or full production-runtime acceptance is claimed. Test database password verifiers may appear in disposable PostgreSQL failure logs; they are not live credentials. The utility suppresses API response/error bodies and does not deliberately persist cleartext credentials locally. Python does not guarantee physical memory zeroization. Hosted SQL audit logs can retain SQL/verifiers; no promise of provider-side log deletion is made.

## Fresh hosted state after validation

A native read of commerce_policy and the five expected application-login names returned new_orders_enabled=false, settlement_enabled=false, deployment unconfigured, total_limit_raw='0', reserved_raw='0', and application_login_count=0. No real application logins or production secret values were provisioned by this turn. The setup bearer remains unconfigured, as confirmed by the hosted negative check.

The scoped migration `20261007015339 / tree_continue_scoped_commerce_v1` remains installed. Do not repeat it. Existing recovery and purchase-lookup Edge Functions were not replaced. The game preview was not redeployed, no simulation-credit balance was accessed or migrated, and no on-chain transaction was signed or submitted.

## Remaining release work and boundaries

The owner-run secure setup is the next action. After its live acceptance, the separate hosted payment gateway still needs connection to the restricted credentials, quote authority and actual reviewed checkout configuration, independently verified receipts, saved-flight eligibility authorization, and interrupted-delivery resolution. Approved pilot/gas/upgrade settings, paused mainnet publication, and restricted installed-wallet 20,000-TREE acceptance remain outstanding. Credential setup alone must not be described as checkout activation.

Supabase secrets are project-level. These separate database roles do not establish isolation from other Edge Functions or administrators that can access the same project secrets. Runtime isolation, key handling, and rotation remain monetary deployment review items.

Fixed price remains 20,000 TREE, three restored lives, same flight/wave/score, one continue per flight, free new games, and no separate Canopy Credits purchase. Admin remains `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`; pilot purchaser remains `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`; sales recipient remains `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.

## Current guidance checked

MystenLabs/skills current README, `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`; applicable accessing-data guidance; official Supabase personal-access-token, Edge Function secrets, Management API pooler/secrets/query references, and official Supabase CLI pooler response fixtures. The Management API query endpoint is documented experimental/beta; unexpected responses stop setup rather than being guessed.
