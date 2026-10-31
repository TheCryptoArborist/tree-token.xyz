# TREE Arcade Daily Growth visual update

The Daily Growth panel previously showed attendance as plain text and presented
wallet choices inline in the dashboard. This update makes monthly goals and
saved progress visible and gives wallet selection a dedicated dialog.

## Player experience

- Violet, mint, and gold styling with a season label and illustrated growth
  emblems that match the arcade's existing visual direction.
- A visible monthly badge path: Seedling at 3 check-ins, Sapling at 7,
  Deep Roots at 14, and Full Canopy at 21. These are accumulated monthly
  check-ins, not consecutive-day streaks.
- An attendance ring showing saved check-ins out of the server's calendar
  length, plus a bar showing progress toward the next attendance milestone.
- Separate meters for the daily quest and required monthly Passport games.
- Distinct calendar states and illustrated earned badges with their saved month.
- A native modal wallet picker with detected wallet icons, keyboard focus
  containment, Escape/backdrop dismissal, focus restoration, visible connection
  errors, retry, and a compact mobile sheet.

## Progress and wallet behavior

All player counts, completion flags, and earned badges still come from validated
service responses. Before sign-in, the badge path previews the existing goals
and meters have no numeric values. Failed reads do not turn saved progress into
zero. Stale progress remains labeled, and account changes clear the old account's
displayed progress.

Wallet discovery, account connection, personal-message sign-in, request epochs,
session expiration, ownership checks, and server APIs retain their existing
implementation. The picker displays only wallets returned by the existing
adapter. Rendering a provider icon accepts supported data-image URLs; names and
messages are inserted as text.

The existing game rules remain:

- An authenticated fresh TREE FORCE '89 run reaching its first wave can satisfy
  the daily quest and earns an optional monthly participation stamp.
- Garden Bot, PvP Battle, and Arborist Trials remain the three required games
  for the optional monthly Arcade Passport goal.
- Paid PvP is not required for daily attendance or a daily quest.
- Arboretum and Canopy Clash do not receive new tracking from this update.
- Opening a game link alone does not grant progress.

## Release scope

Starting source: `625dac2962041b7f36a5881d31a9e62b532f3cf4`.

Starting published deployment: `6ae666a66f1d3899025a76af`.

Only three existing public files change:

1. `/play/index.html`
2. `/scripts/arcade-daily-growth.js`
3. `/styles/tree-arcade-suite.css`

The bounded release helper retains all 241 public paths, the other 238 static
file identities, all 40 complete backend function records, and all five
scheduled jobs. It refuses any function upload, unrelated static change,
dependency change, changed runtime identity, or changed current publication.
It preserves the current per-deploy isolated TREE FORCE database binding and
paid-continue setting. The compiled wallet adapters and game/payment assets
are retained byte-for-byte.

## Validation

- 27 controller/UI regression cases, including seven focused dialog and meter
  cases, pass with the real HTML/controller and an isolated DOM fixture.
- 12 release guard cases pass against the complete recorded live inventory.
- Native browser screenshots and layout/focus checks use explicitly synthetic
  local fixtures; they do not award real progress or use an owner's wallet.
- Hosted file comparisons and the published release inventory are recorded
  separately after deployment.

## Guidance consulted

The current MystenLabs repository README was checked before implementation.
Current `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`, and
`frontend-apps/limitations.md` were read through the GitHub connection. Following
this repository's `AGENTS.md`, guidance was applied to the installed integration
and the requested UI scope; package versions and the wallet adapter were kept
at their existing pinned implementation.

References:

- https://github.com/MystenLabs/skills
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/non-react.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/limitations.md
