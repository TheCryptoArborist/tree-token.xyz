# Tree Arcade attendance forest

## Implementation status and evidence

The attendance forest is implemented, candidate-tested, and merged through
[PR #283](https://github.com/TheCryptoArborist/tree-token.xyz/pull/283).
The reviewed candidate was published and locked on November 21, 2026 at
23:56:03.580 America/Chicago (November 22, 05:56:03.580 UTC). Publication
[workflow 44991408033](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44991408033)
passed complete verification at `2026-11-22T05:56:07.980Z`.

See the [publication report](arcade-attendance-forest-release-20261121.json),
[browser report](arcade-attendance-forest-browser-20261121.json), and
[independent canonical audit](arcade-attendance-forest-canonical-20261121.json).
The audit distinguishes its direct observations from workflow evidence.
Publication control: `081bb5269e243270ad1fb177fbef9fe5ed1cf63b`.

| Record | Value |
| --- | --- |
| Reviewed source | `ac4696ea26e72fca6a3a997f1b0370acc37184d6` |
| Source tree | `50aa9355a12d1d42e19524882aa514c131a3125d` |
| Merged main | `2d4e356d56dcaf6667f94f3c256646f8033d2310` |
| Prepared candidate | `6b0282d222b49cfa17fa3731` |
| Successful prepare | [44991099455](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44991099455) |
| Browser evidence checked | `2026-11-22T05:52:15.004Z` |

## Attendance, trees, and the UTC deadline

Daily now shows saved check-ins for the current UTC month and the current
consecutive attendance streak. The monthly count resets with the month;
the streak can continue across month boundaries. Both come from the accepted
monthly attendance response, rather than combining different API snapshots.

The grove contains one tree per saved date in that month, including recovered
dates. A newly confirmed ordinary check-in adds a sapling animation. Existing
trees are retained when a streak lapses; a confirmed zero streak with known
earlier attendance shows an ember patch. A new wallet's missing earlier dates
do not invent lost trees or a previous streak.

Before today's check-in, an active streak must be continued before the next
00:00 UTC. After today is saved, the main timer shows when the next day opens;
the separate streak deadline is 00:00 UTC after that next day. That deadline
is 24–48 hours ahead immediately after a check-in, depending on its UTC time.

The clock uses the accepted response's HTTP Date plus elapsed monotonic time.
The response date must agree with the attendance UTC day. Session expiry is
never used as a streak clock. At midnight the widget requests fresh attendance
and shows an updating state before declaring a server-confirmed lapse.

## Recovery and feedback

Review missed days opens the existing Monthly recovery controls and selects
the requested or latest available missed date. It does not initiate payment.
An existing checkout stays associated with its original wallet and digest.

Rain requires successful backend verification for the current wallet and an
actual receipt matching the checkout date, submitted digest, and `20000` price.
A pending digest, rejection, error, or missing/mismatched receipt cannot
authorize rain. Repeated receipt events are deduplicated within the mounted
widget. Verification while Monthly is visible queues rain until Daily opens;
the success notice provides a **View your grove** link without auto-navigation.

Recovering an older, unrelated gap can add a tree while the streak stays paused.
Recovering the gap that reconnects attendance updates the actual streak and
extinguishes the ember patch. A previous-month receipt does not plant a tree
in the new month's grove. Reduced-motion settings show the confirmed result
without planting or rain animation.

The existing recovery costs **20,000 TREE plus SUI gas per date**. Existing
eligibility, checkout expiry, month-end cutoff, and reconciliation rules remain
in force. Recovery restores attendance and adds no verified quest-day credit.

## Identity, stale responses, and implementation scope

Sign-out or wallet change immediately clears the previous wallet's grove,
clock, and queued animation. Obsolete replies cannot republish that identity.
Unavailable or malformed attendance is visibly stale/unknown, rather than
resetting saved progress to zero or inventing a lapse. Presentation events
contain public identity/progress and clock data, never bearer tokens.

Starting a recovery action aborts and invalidates an older in-flight status
read. Its late response is rejected even when transport ignores cancellation;
it cannot replace verified recovered attendance with the earlier count/fire.

Delivery changes exactly four frontend assets: `scripts/arcade-organization.js`,
`scripts/arcade-monthly.js`, `styles/arcade-organization.css`, and the new
`scripts/arcade-attendance-forest.js`. The organization module mounts the grove;
the monthly controller supplies accepted state and verified recovery events.
Existing wallet/payment bundles, backend rules, dependencies, and database schemas
are preserved. `docs/arcade-attendance-forest-release.md` defines the release gates.

## Validation and guidance

The successful candidate passed **111 code tests** and **18 browser scenarios**:
six flows at 320, 390, and 1280 pixels. They cover growing attendance, free
check-in, rejection/pending/confirmed recovery, UTC lapse, month rollover,
reduced motion, wallet isolation, stale data, tab navigation, and asset/layout
checks. The status-read race has a regression that failed before its fix.

The browser harness uses the candidate's served assets with synthetic Wallet
Standard identities, API responses, and a mocked payment boundary. It performs
no real wallet signature, backend mutation, or chain transaction. It does not
establish installed-Slush or physical-device acceptance.

The live [MystenLabs skills README](https://github.com/MystenLabs/skills) was checked.
Guidance used: `frontend-apps/SKILL.md`, `non-react.md`, `transactions.md`, and
`limitations.md`: account-scoped state, cleanup, pending/error handling, and
confirmation before success. This change does not introduce an SDK migration.
