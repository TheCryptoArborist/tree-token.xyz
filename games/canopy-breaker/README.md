# Canopy Breaker

NFTree holder brick breaker for TREE Arcade. Canonical target: `/play/canopy-breaker/`.

## Current status

**Active in production since November 7, 2026:**
[Play Canopy Breaker](https://tree-token.xyz/play/canopy-breaker/).
The live Tree Arcade cabinet opens the NFTree access screen. The isolated game
host has its production saved-game migration applied and gameplay enabled.
The arcade release preserves all 43 existing function records, five schedules,
other static files, runtime configuration and site environment records.

All 76 automated tests, the build and hosted database/access checks pass.
Real NFTree-holder gameplay, a genuine 20,000 TREE restart and recovery, mobile
wallet round trips and physical NES controller acceptance remain unverified.
Automated checks do not establish those real-wallet or real-device outcomes.
See `docs/production-release-2026-11-07.json` for the exact release identities.

## Play

- Three lives; 30 screens across five themed forests; final Hollow Harvester boss.
- Concrete brick positions extracted directly from 30 gameplay frames in the
  supplied Arkannoyed.gam (1,540 placements), scaled for the browser field.
- Branch Reach, Root Tether, Wildfire Seed, Thorn Volley and Seedburst power-ups;
  Gale Force, Root Snare and Wild Wind hazards. The original seed controls lives,
  including while bonus seeds survive.
- Mouse, touch drag, A/D, arrows, Space to launch/fire, P to pause. Detected
  NES USB controllers support D-pad, A/B launch/fire and Start pause/resume.
  Standard and common four/eight-button USB layouts have defaults; Set controller
  buttons learns left/right, A, B and Start for other adapters and saves that
  mapping per controller in this browser. Select has no gameplay action.
  Disconnect pauses the run; reconnect requires released controls and an explicit
  resume. Physical NES hardware and iPhone wallet app round trips still require
  real-device testing.
- Original canvas art, event sounds, reduced-motion support and fullscreen.
- Carved wooden relics replace letter tiles: growing branch, root-held acorn,
  flame seed, twin thorns, seedburst, speed chevrons, binding roots and a wind
  spiral. Beneficial relics have leafy wood frames and gold fittings; hazards have
  weathered amber diamonds. Bricks use the live TREE homepage’s emerald, cyan
  and gold palette, with beveled faces, wood grain and leaf engravings.
  The field guide and pickup notices share the same icons and explain the effect.

## Access and restart rules

Sui Mainnet personal-message signature plus NFTree ownership (direct and
controlled standard/personal Kiosks) grants access. Sign-in is not a payment.
An origin-bound five-minute nonce is consumed once; an opaque 15-minute
HttpOnly/Secure/SameSite cookie holds the session. Ownership is rechecked at
least every 30 seconds during active play. Failed checks lock the game.
Protected JS modules are bundled privately in the isolated `breaker-access`
function, never shipped in the public static directory. Previously downloaded
code cannot be recalled; this is access control, not copy protection.

The first run is included. The server creates one durable active run per wallet;
reloading or signing in again resumes that run. It replays only bounded input
batches, owns lives and score, and rejects browser state and fabricated run IDs.
No rewards or token payouts are granted. Browser prediction may be up to one
unacknowledged batch ahead of the durable checkpoint; a reload discards that
unsaved interval. Network failures pause local prediction.

At zero lives, a new run requires **exactly 20,000 TREE**, plus normal SUI gas.
Restart resets to screen 1, score zero and three lives. A completed 30-screen run
can begin a new challenge without a defeat fee.

Checkout uses the existing configured ecosystem recipient
`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.
Prices use verified on-chain TREE decimals. The server validates the signature,
sender, exact transfer commands, coin ownership, recipient, amount, gas settings,
derived transaction digest and checkpointed successful receipt. Signed bytes are
recorded before execution; retries submit the same bytes. A unique receipt and
new run are written in one database transaction. Payment history recovers
uncertain submissions; only a finalized failed transfer can release a signed
reservation. No swaps, burns, reward splits or treasury sales are introduced.

## Develop and verify

Node 22.12+:

```sh
npm ci
npm test
npm run check
npm run build
npm run preview
```

`preview` is explicitly local and simulated. It never connects a wallet or
transfers TREE. The production bundle has no simulation switch or test route.

`tools/package-playtest.mjs /absolute/output.html` creates one offline HTML
mechanics test that opens directly in a browser. It is not a production package.

To re-read the uploaded source placements:

```sh
python3 tools/extract-layouts.py /path/to/arkannoyed.zip
```

The source record and exact scope are in `docs/source-inspection.json` and
`docs/source-adaptation.md`.

## Release boundaries

`dist/` contains only the public introduction, CSS, artwork/logo and bundled
wallet gateway. `.netlify/breaker-functions/` contains the single protected
function and compiler manifest. Never upload a project root as public static
files. The migration under `netlify/database/migrations/` adds only the isolated
`breaker` schema. It must reach hosted databases through Netlify's committed
migration/deploy workflow; never apply it by a direct production DB connection.

Activation uses `BREAKER_ENABLED=true` only after the migration and isolated
candidate pass validation. Disabled or missing backend configuration fails closed.
Follow `docs/release-plan.md`. Do not run an ordinary root dashboard build or
replace any existing production function to release this game.
