# STI connection and approval review — 2026-09-24

The user reports a brief wallet popup followed by a return to the STI quote,
without an explicit wallet connection choice. The recording does not establish
the underlying provider error. The exact iPhone/Slush failure is not reproduced.

Code findings addressed:
- STI previously selected approval based only on `window.playerAddress`.
- No connect/manage control was available within STI once that address existed.
- The approval click awaited balance, transaction build and simulation before
  invoking the wallet. Preparation is now a separate Review purchase action.

The final click checks the original quote expiry, amount, account, wallet and
generation, then passes the exact simulated bytes to the existing wallet adapter
without pre-sign network awaits. No automatic re-quote or transaction retry is
introduced. The pool, token, slippage, impact, gas reserve and simulation checks
are unchanged. Pending signing blocks additional submissions and displays a
waiting message; a missing digest tells the user to check wallet activity.

Verification:
- 50 focused local checks pass, including 11 new widget event-flow regressions.
- Production verification/build matches all 193 published files and 2 available
  function archives; the other 35 deployed packages remain untouched.
- Three browser viewports (1440, 390, 320) pass connection via the actual wallet
  manager, six-second simulated preparation, fresh user activation at the wallet
  boundary, rejection, no automatic re-quote, no overflow, and disconnect.
- All six delayed wallet restoration/cancellation browser cases pass.
- Browser tests use mocked SDK/provider boundaries: no keys, signatures or
  transactions. They do not assert real iOS or actual Slush approval success.
- Required initial CI checks pass; the pre-existing non-blocking legacy snapshot
  diagnostic remains failing.

The published bytes of the three modified frontend files are preserved under
`production/sti-release-static/`. The production manifest only changes source
locations, not deployment identities or hashes. Feature previews overlay the
editable files. Historical release inventory tests now resolve published bytes
through that manifest instead of treating preview edits as production changes.

PR #35 is non-production review only. Confirm the connection/approval experience
on the user's phone before authorizing release. Do not promote the read-only
review backend as a production backend.
