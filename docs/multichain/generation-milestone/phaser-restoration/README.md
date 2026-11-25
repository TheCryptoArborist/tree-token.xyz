# Server restore authorization and actual Phaser integration

This source milestone adds an explicit server authorization boundary and proves
the isolated path from shared PostgreSQL consumption through the browser journal
to the recovered **actual Phaser game**. No live route or release policy is
installed. The shared engine remains shadow-only when called directly.

## Server boundary

`continue-restore-authorization.mjs` defaults to denial and never calls delivery
without a fresh trusted release-policy observation. A host-supplied server adapter
must establish runtime verification, canonical origin, reviewed game/source
identity, the native non-reward checkpoint policy, and a short unexpired approval.
No browser request can supply that adapter or release policy. No environment flag
or production implementation of the policy reader is included here.

The boundary validates prepared bindings, checkpoint hash and native snapshot
shape before returning a positive preparation. It hashes the stable release
identity into `policyDigest`. The browser passes that digest to activation and
checks it on the response. A changed release between preparation and activation
is denied before consumption. A changed/disabled release after consumption denies
the browser grant without pretending that committed consumption was rolled back.
Those cases stay review-only. Replays and other non-consumed results never become
positive grants.

The native checkpoint policy is explicitly client-reported **non-reward gameplay**,
matching the recovered native service. It does not establish server-authoritative
score, Game Over or tournament eligibility. Runtime approval of that policy is a
future release decision; passing an isolated test does not approve production.

## End-to-end validation

The disposable native SQL checker creates Sui-typed and BNB-typed fixture payments
and real shared/native database state. For each payment type, intercepted browser
requests call the actual authorization boundary and shared delivery engine.
Consumption advances the actual native row and shared claim exactly once, then
the browser controller and native render adapter mount the unmodified recovered
Phaser code. The assertions verify:

- One activation and one game mount despite competing clicks.
- Three restored lives, original native run ID, score 55 and wave 2.
- An active game scene and canvas, followed by successful canvas teardown.
- Refresh denial with no additional server activation or game mount.
- One native counter increment and one consumed shared claim in PostgreSQL.

The first test setup used a browser expiry shorter than its database session;
the controller correctly refused it. The fixture now uses the actual SQL expiry.
The test pauses the scene after capturing restored state, while leaving the game
loop available for normal Phaser teardown.

Source files and their locations are hash-pinned in `provenance.json`. Phaser is
pinned to 3.90.0, matching the recovered game's major/version requirement; esbuild
and Playwright are isolated pinned test dependencies. The native game files are
not patched or published. Asset requests receive explicit placeholder textures:
these tests validate restoration, not artwork, visual polish or current live
asset parity. Every browser request is intercepted; zero live site/wallet calls
occur. The React gateway and a real wallet session are not mounted in this test.

Payment evidence, ownership, runtime approval and reviewed checkpoint inputs are
explicit fixtures. Financial settlement is tested separately in the same native
suite; the Phaser fixture uses a no-op settlement adapter to isolate the already
recorded payment-to-consumption-to-render path. It does not make a real payment.

Evidence: 11 authorization tests, 18 browser interruption/concurrency checks and
34 native database checks (including the combined Sui/BNB Phaser check). Detailed
results and Chromium version are saved alongside this README. CI runs this path
with existing contract, payment, database and endpoint regressions.

## Reproduce

From the repository root with Node 24 and PostgreSQL tools, as a non-root user:

```sh
npm ci --ignore-scripts
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
npm ci --prefix vendor/continue-browser-test --ignore-scripts --no-audit --no-fund
node --test tests/multichain-restore-authorization.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-continue-browser.mjs
CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Set `BNB_PG_SHARE` for unpacked PostgreSQL. Use an installed Chrome/Chromium binary,
or install Playwright Chromium and omit `CHROMIUM_PATH`. Database and browser
contexts are disposable; no hosted credentials are accepted by the checker.

## Production boundary and remaining work

The newer inventory audit at `audit/treeforce-inventory-20261125`, commit
`72239a3`, records 693 static paths, 61 backend records and five schedules at
locked deploy `6b063e9462762ae02c0fd5db`. It explicitly makes no native source-parity
claim. It was inspected read-only and is not a reusable authorization to overwrite
production. Another chat's branch and artifacts were left unchanged.

Before an enabled canonical integration: establish current backend/source/database
parity; implement and review the trusted release-policy reader and authenticated
transport; wire the real gateway/session lifecycle; verify wallet switching,
full React/Phaser teardown, existing Sui behavior, scores and tournaments; and
review consumed-but-unconfirmed recovery. Any release requires a newly captured
complete inventory and separate approval. No current Sui authentication, game,
score, payment or tournament behavior changed during this milestone.

Hosted [CI 45531435035](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45531435035) passed on `5f41b6c3`, including release-boundary tests, browser interruption checks, actual Phaser/database integration and existing regressions. See `hosted-ci.json`.
