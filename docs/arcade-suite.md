# TREE Arcade cabinet suite

Published and verified at `https://tree-token.xyz/play/` as deployment `6ae580fad3f05a19757996a5`, from source commit `84f907715cd33319b4b4986a7a802c44dfd63476`. Production is ready and locked. Final evidence is in `arcade-suite-published.json`; the live full-page screenshot is in `review/arcade-suite-live-6ae580fa.jpg`.

The `/play/` landing page now gives each destination its own retro arcade cabinet. The desktop floor contains nine cabinets in three rows, with two columns on tablets and one column on narrow screens.

| Cabinet | Destination | Availability shown |
| --- | --- | --- |
| 01 — Garden Bot | `https://nftree.net/battle/garden-bot` | Live |
| 02 — PvP Battle | `https://nftree.net/battle/pvp` | Live |
| 03 — Arborist Trials | `https://nftree.net/battle/trials` | Live |
| 04 — Canopy Clash | `https://nftree.net/battle/canopy-clash` | Preview; tournament play coming soon |
| 05 — Arboretum | `https://treegrow.xyz/` | In testing; tester access |
| 06 — TREE FORCE ’89 | `/play/treeforce89/` | In testing |
| 07–09 — Future games | No destination | Coming soon |

Each named cabinet has its own marquee, existing official artwork, CRT-style screen, decorative joystick/buttons, availability label, description, and explicit destination link. The three future cabinets are static placeholders without links or focusable play controls. The header and access area retain routes to TREE home, the app, NFTrees, and Buy TREE.

## Scope

The published overlay consists only of `/play/index.html`, a new `/styles/tree-arcade-suite.css`, and four images under `/assets/arcade/`. Existing shared CSS is retained. The landing page has no JavaScript, wallet initialization, signing, payment logic, SDK migration, dependency changes, backend rebuilds, or database migrations.

The Garden Battles images are exact copies of the existing public mode artwork at `nftree.net/battle/assets/`: `mode-crests/garden-bot-crest.png`, `mode-crests/pvp-battle-crest.png`, `arborist-trials-logo.webp`, and `mode-crests/canopy-clash-crest.png`. Arboretum and TREE FORCE use the existing TREE website assets.

## Verification

- Browser preview confirmed nine cabinets, six named destination links, and three future placeholders.
- Desktop visual review covered all three rows, artwork, physical cabinet controls, actions, and footer.
- Mobile iframe previews at 390px and 320px outer widths had no horizontal overflow or overflowing cabinet headings, metadata, or actions. Their actual content widths were 375px and 305px with browser scrollbars.
- All six destinations returned HTTP 200. Arboretum redirects to `https://www.treegrow.xyz/`; Arborist Trials redirects to its trailing-slash route.
- Clicking the Canopy Clash cabinet reached its dedicated preview page and confirmed its Coming Soon status.
- Keyboard focus, a skip link, meaningful heading hierarchy, 44px or larger play actions, decorative-only control markup, and reduced-motion styles are included.
- Validation does not represent a new wallet-signing or paid gameplay test. Those game implementations are outside this presentation change.

## Preserved release

The current release workflow captures and compares the actual published deployment, initially `6ae57caa6fee52d4fb3bfd18`, rather than using main's older production manifest as a complete release. It requires all 219 existing static paths, 39 complete function records, five schedules, the existing isolated TREE FORCE database identity, and its enabled paid-continue setting to remain intact. Only the arcade landing HTML changes among existing paths; the stylesheet and four images are added.

The exact candidate, source commit, file digests, and final publication verification are recorded by `scripts/release-arcade-suite.mjs`. Automatic publication stays locked.

## Guidance consulted

The current MystenLabs/skills README was checked through the GitHub connector during this request (README blob `8be2c5d51d94c953a007e286f63df38372faa8d0`). Applicable references were `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`. Together with this repository's AGENTS.md, they support keeping wallet and secret-bearing functionality inside the existing applications and limiting this work to presentation and navigation. No external skill was installed.
