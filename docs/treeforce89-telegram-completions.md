# TREE FORCE ’89 completed-mission Telegram alerts

The existing score endpoint has a public, read-only completion feed at
`/api/treeforce89-leaderboard?completions=1`. It reads saved standard-game ending
records, including scores outside the top 50. No wallet, raw run ID, bearer token,
or payment data is returned. Primary SuiNS names are resolved server-side; public
pilot usernames remain the fallback. Practice/debug runs are already rejected by
the score-saving handler.

Current trigger: the player finishes a mission and clicks **Save score**. The game
client currently requires this save; this release does not introduce automatic
score submission or change gameplay. Subsequent higher saved scores in the same
paid-continue run can produce a new alert. Repeated saves of the same run/score
are deduplicated. These remain client-simulated community scores, not verified
prize eligibility.

The Railway bot starts from a current baseline and skips historical records. It
retries failed Telegram sends without advancing its cursor. Alerts include pilot
name, score, wave reached, achievement count, boss-clear result and game link.

Release only replaces `treeforce89-scores`; its route, runtime, memory, traffic
rules and region must match the current function. The release script captures the
complete current production inventory, preserves all other functions/provider
records, every static digest and all five schedules, verifies the candidate, then
checks for concurrent publication before publishing. No migrations, environment
changes, wallet actions or frontend edits are included.

Deployment status: blocked by Netlify HTTP 403, "Account credit usage exceeded - new deploys are blocked until credits are added". No candidate was created or published. The Railway listener is saved on a feature branch and has not been activated. Existing production remains unchanged.
