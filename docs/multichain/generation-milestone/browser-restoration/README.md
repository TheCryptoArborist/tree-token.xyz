# Browser continue restoration — source integration

The proposed browser controller and native render adapter are isolated source;
they are not mounted on the current site. No existing game, wallet, payment,
authentication, score or tournament module changed. The server's current
`restoreAuthorized: false` preparation responses are rejected **before activation**,
so this client cannot accidentally consume a shadow payment it cannot restore.

## Native restore behavior preserved

Exact native source snapshots are hash-pinned at `9974d7f` in `provenance.json`.
The recovered gateway validates the native snapshot, restores the existing local
progress fields and uses a new component key to mount `CanopyGame` in its game
scene. Its duplicate guard is an in-memory ref and does not survive refresh.

`paid-continue-controller.mjs` adds an exclusive Web Lock and a localStorage
journal scoped to account/run/continue sequence. It checks the session again
after asynchronous operations, verifies the prepared payment/sequence/lease and
checkpoint hash, and validates native snapshot fields with the unchanged
`prepareAuthorizedContinue` helper. The native snapshot must be carried inside
the reviewed checkpoint; a browser snapshot is never made trusted by this client.

Before activation it persists `activation-pending`. Only an explicitly positive
activation for the exact request/run/sequence permits rendering. It then persists
`restore-attempted` **before** invoking the renderer and `restored` afterward.
Any uncertain activation, stale response, session change or renderer failure
leaves a review marker. A refreshed page or another tab cannot automatically
retry that sequence. A separate paid sequence has a separate record.

`native-continue-renderer.mjs` checks the current native run and login epoch,
retains an in-memory attempt guard, restores progress through the unchanged
native helper, and synchronously enqueues the native scene props/component key.
The host's `commitResume` must enqueue React state synchronously; it must not start
an independent asynchronous restoration. The controller's session epoch must be
a non-secret login-generation identifier, never a raw bearer token.

## Limits and recovery policy

This guarantees at-most-once restore **attempts** under the tested honest-browser
conditions; it is not an exactly-once visual-rendering guarantee. React/Phaser may
fail after state is enqueued. Those cases stay review-only and must use the
separately reviewed consumed-but-unconfirmed recovery process. There is no button
or API here that clears the marker, recharges, or grants another continue.

Storage and Web Locks are browser reliability controls, not payment authority.
They are origin-scoped and can be cleared by the user. The server's durable
consumption record remains the cross-origin/device authority. Missing storage,
blocked writes or missing Web Locks fail closed. The journal stores public
identifiers and states, not wallet secrets, bearer tokens, client keys or snapshots.
No scoring or tournament entitlement is derived from restored browser progress.

The browser expects a future reviewed preparation response with
`restoreAuthorized: true` and a reviewed `nativeSnapshot`, followed by a matching
positive activation response. Current server source emits false. Do not flip that
flag to make a test pass or expose an HTTP route before runtime and checkpoint
integration are reviewed. `prepare` and `activate` are injected trusted transports;
this milestone creates no network endpoint or wallet/payment request.

## Chromium validation

Seventeen checks passed in real headless Chromium using Playwright 1.62.1. Every
request was intercepted at a virtual canonical `/play/` test path; no live site or
wallet request occurred and no test URL was published. Positive authorizations
are explicitly synthetic. Tests cover:

- Twelve competing clicks and two tabs sharing real Web Locks/localStorage.
- Refresh after success, lost response, rejected/stale activation and renderer
  failure, with no repeat activation or restore.
- Current shadow denial, modified checkpoint, wrong run/sequence, expired lease,
  changed login and unavailable storage/locking.
- Subsequent paid sequence and preservation of native snapshot/progress/scene props.

Tests execute the pinned native validation and progress helpers and assert the
state sent to the native component. They do **not** mount a full Phaser game or
claim end-to-end live rendering, live authorization or production source parity.
Results and browser version are in `chromium-validation.json`; CI runs this checker
alongside all existing contract, database and payment regressions.

```sh
npm ci --prefix vendor/continue-browser-test --ignore-scripts --no-audit --no-fund
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-continue-browser.mjs
```

Use Node 24. Set `CHROMIUM_PATH` to an installed Chromium/Chrome binary, or install
the Playwright browser with
`node vendor/continue-browser-test/node_modules/playwright/cli.js install chromium`
and omit `CHROMIUM_PATH`. No hosted credentials are used.

## Remaining integration

1. Verify current deployed native source/database identity and the native
   checkpoint trust policy. The recovered historical package is not asserted to
   match today's live backend.
2. Implement reviewed authenticated server transport and a versioned positive
   restore grant, retaining the common consumption boundary for both currencies.
3. Wire the adapters into the actual native gateway, mount Phaser in isolated
   acceptance tests, and verify session switching, scene teardown, recovery,
   existing Sui gameplay, scores and tournaments.
4. Review private canonical-domain acceptance and migrations using a fresh complete
   production inventory. No live activation or release is included here.

The first hosted attempt stopped before browser tests at PostgreSQL startup in an existing checker. All remaining temporary database runners now use private Unix sockets and retain startup diagnostics; 82 affected database checks passed locally. No application SQL changed. See `database-harness-validation.json`.

Hosted [CI 45528975439](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45528975439) passed on `8f293a4`, including all 17 Chromium checks, updated database harnesses and existing regressions. Machine-readable evidence is in `hosted-ci.json`.

Subsequent milestone: [server restore boundary and actual Phaser validation](../phaser-restoration/README.md) adds a release-policy digest and tests a real game mount against disposable PostgreSQL consumption. Production authorization remains unconfigured.
