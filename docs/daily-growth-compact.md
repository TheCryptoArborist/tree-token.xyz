# TREE Arcade — compact Daily Growth redesign

## Requested direction

The user asked for Daily Growth to occupy less of the lobby, keep the games
visible, and use actual TREE ecosystem artwork. The supplied `social.jpg`
reference establishes the direction: warm gold, leaf green, a dark forest
atmosphere, and recognizable characters and game artwork.

This revision gives Daily Growth a compact summary strip with the TREE hero,
the player's current action, and saved progress. Detailed goals and history
open through **View quests & badges**. The disclosure starts closed so the
game lineup remains close to the top of the lobby.

## Interface changes

- The summary strip keeps Connect wallet, Sign in, or Check in today available
  according to the current session. Authenticated players see their saved
  monthly count and attendance meter. The expanded view retains the next-badge
  meter and milestone details.
- The expanded section contains today's quest, monthly attendance calendar,
  the badge path, Arcade Passport, and earned badges.
- Gold borders and headings, leaf green actions and progress, and dark forest
  backgrounds follow the requested visual reference.
- Existing published artwork supplies the TREE hero, NFTree identity, game
  quests, milestone illustrations, and Passport stamps. Game selection updates
  the quest's artwork to the selected game.
- The wallet picker remains a dedicated native dialog, with detected wallet
  choices, keyboard focus handling, dismissal, and visible connection errors.

## Existing artwork

The implementation reuses files already present in the published inventory.
No new public artwork path or image replacement is part of this release.

| Use | Existing artwork |
| --- | --- |
| Lobby hero | `/assets/arcade/tree-arcade-social.jpg` |
| Compact Daily Growth strip | `/assets/tree-hero-poster.webp` |
| NFTree illustration | `/assets/profile-nftree-art.jpg` |
| Wallet identity, Full Canopy, and Passport | `/assets/tree-command-logo-v2-512.png` |
| Garden Bot | `/assets/arcade/garden-bot-poster.webp` |
| Arboretum illustration | `/assets/arcade/arboretum-poster.webp` |
| PvP Battle | `/assets/arcade/pvp-battle-poster.webp` |
| Arborist Trials | `/assets/arcade/arborist-trials-poster.webp` |
| TREE FORCE '89 | `/assets/arcade/tree-force-89-poster.webp` |

Artwork used for an attendance milestone is illustrative. It does not add
gameplay requirements or enable progress tracking for preview games.

## Progress rules retained

Player counts, completed quests, Passport stamps, and earned badges continue
to come from validated service responses. Signed-out visitors see goal labels
without invented progress. Saved progress remains labeled when a refresh is
unavailable, and changing accounts clears the previous account's progress.

- Monthly attendance milestones remain Seedling at 3 check-ins, Sapling at 7,
  Deep Roots at 14, and Full Canopy at 21. They count accumulated check-ins
  within the month; missed days do not erase earlier attendance.
- A fresh authenticated TREE FORCE '89 run reaching its first wave can satisfy
  the daily quest and earn an optional monthly participation stamp.
- Garden Bot, PvP Battle, and Arborist Trials remain the three required games
  for the optional monthly Arcade Passport goal.
- Paid PvP is not required for daily attendance or a daily quest.
- Arboretum and Canopy Clash gain no new tracking through this redesign.
- Opening a game link alone does not grant progress.

## Release scope and evidence

The starting evidence commit is
`dbafaefb60ad53e764b65db128c360111fbd9e0c`. The current published baseline is
`6ae66f6c82e32369a34b6d1d`, recorded in `daily-growth-polish-published.json`.

Only these three existing public files may change:

1. `/play/index.html`
2. `/scripts/arcade-daily-growth.js`
3. `/styles/tree-arcade-suite.css`

The separate `release-daily-growth-compact.mjs` helper preserves all 241 public
paths, the other 238 file identities, all 40 complete backend function records,
and all five schedules. Root dependencies, compiled wallet adapters, wallet
source files, runtime configuration, the isolated TREE FORCE database binding,
and the paid continue setting remain pinned. The previous release receipts
and helper remain historical evidence.

The hosted verifier compares the complete candidate Git tree and all three
overlay files with the reviewed source, accommodating a connector-created
commit ID only when its complete tree is identical. Its remote checks use GET
requests for the three files and public status. HTML comparison permits only
the exact existing hosting snippet, calibrated against the prior deployment.

## Layout and behavior verification

The same native browser and viewport sizes were used before and after the
revision, with fixed synthetic progress and no external requests. Measurements
start at the top of the page, without test banners or automatic scrolling.

| Viewport | Previous panel height | New default panel height | Previous first cabinet top | New first cabinet top |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 900 | 974 px | 147 px | 1592 px | 526 px |
| 390 × 844 | 1827 px | 217 px | 2640 px | 584 px |
| 320 × 844 | 1898 px | 213 px | 2777 px | 597 px |

The panel is approximately 85–89% shorter. Signed-in fixture states also keep
the first cabinet in the initial viewport. Routine refresh notices appear in
the expanded details; errors, wallet prompts, and successful actions remain
visible when the details are closed.

All 29 UI/controller cases and 13 release guard cases pass. The native browser
passed 40 focused checks across four viewport sizes, covering closed/open
progress, all tabs, saved/unknown data, artwork loading, and wallet-dialog focus
and dismissal. No horizontal overflow, JavaScript errors, or console errors
were recorded. Source hashes and full measurements are recorded in
`daily-growth-compact-browser.json`; baseline measurements and representative
screenshots are under `review/daily-growth-compact-*`.

These fixtures use synthetic account data. Real extension approval, real
wallet signing, transactions, and production progress writes were not tested.
Candidate and canonical hosted verification will be recorded separately after
publication.

## Current guidance

The current MystenLabs README, `frontend-apps/SKILL.md`, and
`frontend-apps/non-react.md` were read through the GitHub connection for this
revision. The repository's `AGENTS.md` limits the work to the requested
interface changes and the existing installed wallet integration. No SDK
migration, dependency upgrade, or wallet adapter rewrite is included.

- [MystenLabs skills README](https://github.com/MystenLabs/skills)
- [Frontend skill](https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md)
- [Vanilla JavaScript guidance](https://github.com/MystenLabs/skills/blob/main/frontend-apps/non-react.md)
