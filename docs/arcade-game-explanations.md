# TREE Arcade: game explanations

## Scope

This presentation-only update explains what a newcomer actually does in the four Garden Battles modes. It retains their direct destinations and availability, adds short subtitles and decision-making facts, marks Garden Bot as the recommended starting point, and introduces the shared card-battle mechanics before the posters. PvP's action becomes **BATTLE A PLAYER** and Arborist Trials' action becomes **PLAY TODAY’S TRIAL**.

The combined pending release includes the already reviewed removal of the third future slot: **eight posters**, comprising six game destinations and **two Coming Soon** placeholders, with four columns on desktop. The welcome guide remains below the posters. This update does not change game rules, wallets, payments, contracts, backend packages, or database configuration.

## Approved copy

Shared introduction:

> **Four ways to play Garden Battles**
>
> Grow your tree through strategic card play—against the computer, another player, a daily challenge, or in upcoming tournaments.

The introduction's eyebrow is **TURN-BASED CARD STRATEGY**.

| Poster | Subtitle | Facts | Action | Availability |
| --- | --- | --- | --- | --- |
| Garden Bot | Solo strategy card battle | Computer opponent · Repeatable battles | PLAY GARDEN BOT | LIVE; START HERE recommendation |
| PvP Battle | A strategy card duel against another player | Live opponent · Paid entry | BATTLE A PLAYER | LIVE |
| Arborist Trials | A daily strategy card challenge | One ranked run daily · Practice available | PLAY TODAY’S TRIAL | LIVE |
| Canopy Clash | Garden Battles tournaments | Coming soon · Tournament preview | PREVIEW CANOPY CLASH | PREVIEW |

**Garden Bot:** Play cards to grow your tree, block attacks, and slow a computer opponent. Reach the Growth target before the bot to win.

**PvP Battle:** Challenge another player in a turn-based race to grow your tree. Choose when to grow, attack, or defend—and reach the Growth target before your rival.

**Arborist Trials:** Face the day’s shared card battle against Garden Bot. Adapt to special rules, win in fewer rounds, and compete on the daily leaderboard.

**Canopy Clash:** A tournament mode is coming to Garden Battles, with scheduled matches, brackets, and championship prizes. Preview the next way to compete.

Each poster remains a single complete link. Its status, subtitle, description, and facts are included in its accessible description. Arboretum remains In Testing; TREE FORCE ’89 retains its previously approved red Live badge and Play action.

## Source audit

The public mode hub is [Garden Battles](https://nftree.net/battle/). Its direct destinations are [Garden Bot](https://nftree.net/battle/garden-bot), [PvP Battle](https://nftree.net/battle/pvp), [Arborist Trials](https://nftree.net/battle/trials), and [Canopy Clash](https://nftree.net/battle/canopy-clash).

The readable source references below are pinned to `TheCryptoArborist/gardenbattles` commit `9116ec8599d61c4044a5e53f6269b3ef04bf4b13`, from branch `codex/recovered-gardenbattles-20260624`:

| Source | Evidence used |
| --- | --- |
| [HowToPlay.tsx](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/components/HowToPlay.tsx) | The goal is to reach the Growth target before the opponent. Players select a move or ability each turn; effects include growth, attacks, protection, and utility. Trials are a shared daily Garden Bot challenge. |
| [BattleHub.tsx](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/pages/BattleHub.tsx) | Mode names, direct links, repeatable solo play, human PvP, ranked daily play, and the tournament preview. |
| [sui-config.ts](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/lib/sui-config.ts) | Card descriptions distinguish increasing your Growth, reducing the opponent's Growth, and hybrid effects such as blocking or clearing harmful effects. |
| [shared/arborist-trials.ts](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/shared/arborist-trials.ts) | Daily seeded setups and rotating special rules. Scoring rewards victory, round efficiency, Growth margin, card variety, and specialty bonuses. |
| [lib/arboristTrials.ts](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/lib/arboristTrials.ts) | Trials use the shared practice card-battle engine; rule variants change the strategic challenge. |
| [ArboristTrials.tsx](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/pages/ArboristTrials.tsx) | Official ranking requires NFTree ownership; practice is open to everyone. One official ranked score is saved per wallet and UTC day. Saving the completed score requires a message signature. |
| [CanopyClash.tsx](https://github.com/TheCryptoArborist/gardenbattles/blob/9116ec8599d61c4044a5e53f6269b3ef04bf4b13/apps/garden-battles/battle-gardenfrontend/src/pages/CanopyClash.tsx) | Scheduled tournament events, brackets, and championship play are planned; the page remains Coming Soon. |

The relevant hub descriptions, gameplay labels, trial rule identifiers, practice-access wording, and tournament status were also checked in the [bundle referenced by NFTree's public battle index](https://github.com/TheCryptoArborist/nftree_landing/blob/f8f014c2869dbaed04735c43f94d01a1a818abaa/public/battle/assets/index-CyHJZgzO.js), pinned to `TheCryptoArborist/nftree_landing` commit `f8f014c2869dbaed04735c43f94d01a1a818abaa`. This corroborates the relevant mechanics without treating the older `gardenbattles/main` frontend as the current release.

## Copy boundaries

- Describe choosing move cards and card strategy, not player-built decks or deck-building.
- Describe reaching the Growth target first; do not hardcode 50 Growth in this introductory copy.
- A shared daily challenge does not guarantee identical hands: optional fifth-card eligibility can differ.
- Arborist Trials practice does not require an NFTree. NFTree access applies to the official ranked run.
- Prefer one ranked score per day to wording that implies practice is limited or the system measures mouse-click speed. Trial efficiency is measured in rounds.
- Canopy Clash remains an upcoming tournament preview. Do not imply registration, rounds, payouts, or prizes are currently available.
- Do not introduce hardcoded entry fees, guaranteed rewards, or blanket zero-cost claims.

## Shared gameplay visual

The supporting visual at `/assets/arcade/garden-battles-gameplay.jpg` was captured from the actual Garden Bot free practice interface, showing Growth meters and move-card choices. It is a 1348 × 926 JPEG (119,046 bytes), with matching HTML dimensions. Its caption is **Practice gameplay · View larger ↗**; the thumbnail opens the original capture in a new tab. CSS frames the relevant gameplay area without changing the source image. It illustrates the common card-battle concept without implying that every mode has identical rules. No wallet was connected, no ranked game was entered, and no transaction was submitted to capture the image.

## Browser verification

The first four posters have aligned actions on desktop and tablet. Their added subtitles, descriptions, and facts remain readable without horizontal overflow at the checked desktop, 1110px, 768px, 390px, and 320px widths. All accessible description references resolve. The new gameplay image loads, and keyboard navigation from its full-size link reaches Garden Bot with the existing 3px focus outline.

All eight posters remain in the requested order, with two future placeholders and a full-width welcome guide below. TREE FORCE ’89 still displays LIVE in red (`rgb(255, 118, 118)`). All six game destinations remain unchanged. `git diff --check` and the bounded release script's syntax check passed. The current MystenLabs/skills README was checked and remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`.

The reviewed desktop preview is saved in `review/arcade-game-explanations-preview.jpg`.

## Published release

After the owner explicitly approved the requested Netlify CLI access, the reviewed source `8a8861c7f35650503b3795c6633a7f69f6485d9b` was published as locked deployment `6ae6175066e3bb789eca5a69` on October 31, 2026 at 11:29:36 a.m. CDT (16:29:36 UTC).

The bounded release changed only the existing arcade HTML/CSS and added the gameplay image. All 232 public paths were verified, including the other 229 static files unchanged from baseline `6ae5895193ef2a292283c697`. All 39 complete function records, five schedules, runtime context, isolated database binding, enabled paid continues, and publication lock were preserved.

The canonical `https://tree-token.xyz/play/` page was checked after publication. It shows the new subtitles, action labels, introduction, loaded gameplay image, eight posters in the requested order, two future slots, full-width welcome guide, and red TREE FORCE LIVE badge. No horizontal overflow was present. Live visual evidence is saved in `review/arcade-game-explanations-live-6ae61750.jpg`; complete file and backend verification is recorded in `arcade-game-explanations-published.json`.
