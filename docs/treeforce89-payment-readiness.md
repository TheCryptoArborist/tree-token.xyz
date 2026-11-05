> Historical readiness record. Resolved by scoped deployment `6aec99bf240f589972b4b367`; paid continues are now enabled. See `treeforce89-scoped-api.md`.

# TREE FORCE paid-continue activation readiness — November 5, 2026

The canonical game remains on locked deploy `6aec00c92d9060d410e986e0`. **Paid continues remain disabled.** No real payment was signed, submitted or charged.

## Checks completed

Readiness run [42046980647](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/42046980647) passed all 36 wallet/gameplay/checkout tests and PostgreSQL 16 integration checks. These cover the exact 20,000 TREE price, confirmed treasury, same run/wave/score with three restored lives, delayed and fresh-login recovery, duplicate receipts, concurrent redemptions, incorrect sender/recipient/coin/amount, failed/stale/uncheckpointed transactions, logout races and disabled-mode rejection. The separate activation environment-delta guard test passed locally and in candidate CI.

The hosted readiness pass used unfunded ephemeral personal-message keys: mainnet non-holder denial, nonce replay rejection, forged signature/eligibility rejection, cross-origin refusal, session checks and ready isolated payment schema all passed. This was not a real holder login or wallet payment.

## Why activation stopped

The site did not have a persistent `TREEFORCE89_PAID_CONTINUES_ENABLED` variable. A non-secret production-only, functions-only `true` value was temporarily added. The candidate reused the exact 293-file inventory, complete 43-function digest/config map and five schedules.

Netlify candidate `6aec95af5a7ac5a4b35df7d3` then requested **43 function uploads** and zero file uploads. The uploader deliberately refused all uploads. No candidate publication, function rebuild/upload, static upload or migration occurred. The temporary flag was removed completely, restoring the original environment inventory. Do not publish this incomplete candidate.

Read-only verification run [42048029387](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/42048029387), step “Verify original live deployment and complete protected environment”, passed: original locked deployment, every static digest, all 43 complete backend records, five schedules, runtime settings, database binding identity and API-visible environment records match the captured baseline exactly. The full baseline is committed in `treeforce89-payment-readiness-baseline.json`; PostgreSQL results are in `treeforce89-payment-readiness-postgres.json`; sanitized outcomes are in `treeforce89-payment-readiness.json`.

The full final workflow did **not** pass: the later hosted smoke timed out after 45 seconds on a replayed `tree-session` request, after successfully issuing a challenge and denying a genuine non-holder. An earlier hosted attempt also timed out on ownership verification; one full hosted run passed in between. The evidence does not establish whether this is transport, provider, database or handler latency. Do not describe hosted authentication as consistently healthy.

The canonical home finished loading in the browser after restoration, including wallet access, Buy TREE, Back to Arcade and the pickup/hazard legend.

## Next implementation

Prepare a namespaced payment-API activation that changes only the intentional TREE FORCE handler while preserving the other 42 functions, schedules, complete static inventory and isolated database binding. The current global function environment approach cannot satisfy exact preservation. Diagnose and bound the intermittent hosted authentication delay, then repeat hosted checks before a real holder payment test. A new activation release needs explicit verification of its narrowly intended runtime/package change; it cannot be represented as the unchanged 43-function gameplay release.

Current MystenLabs references reviewed live: README.md, frontend-apps/SKILL.md, frontend-apps/transactions.md, accessing-data/SKILL.md, accessing-data/grpc.md and accessing-data/graphql.md. No SDK migration, wallet configuration or dependency lock change was made.
