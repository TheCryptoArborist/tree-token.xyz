# Garden Battles card descriptions

## Requested change

Replace the oversized “Four ways to play Garden Battles” introduction with a
plain Garden Battles heading. Remove its overview paragraph and right-side
practice screenshot. Explain each mode directly on its card.

| Game | Subtitle | Description |
| --- | --- | --- |
| Garden Bot | Turn-based card strategy · Solo | Play your cards against Garden Bot. Grow your tree, block attacks, and slow the bot’s progress to reach the Growth target first. |
| PvP Battle | Turn-based card strategy · PvP | Challenge another player in a tactical card duel. Choose when to grow, attack, or defend, and reach the Growth target before your rival. |
| Arborist Trials | Daily strategy · Predetermined cards | Take on the day’s challenge with predetermined cards. Plan the best sequence of moves and compete on the daily leaderboard. |

The existing game links, artwork, status labels, access facts, and Canopy Clash
card remain intact. The user supplied the clarification that the daily Trials
use predetermined cards. This is a presentation change, with no gameplay rule
or result-tracking changes.

## Release scope

Starting deployment: `6ae67337da46ecbf141c68f5`.
Starting source: `730ddc8195fa205ca3d25914f5723ed1b1a0b3b9`.
Feature branch: `feature/garden-card-copy-20261031`.

Only `/play/index.html` may change in the public inventory. Its content before
and after the Garden Battles section is byte-identical to the starting source.
The bounded release helper preserves all 241 public paths, the other 240
static identities, all 40 complete backend function records, and five scheduled
jobs. Existing JavaScript, CSS, wallet adapters, dependencies, runtime settings,
and the isolated TREE FORCE database binding are pinned.

Current MystenLabs guidance was checked at its README. This HTML-only edit
requires no SDK, wallet, transaction, or contract changes.

Final publication and hosted verification are recorded separately after the
release in `garden-card-copy-published.json` and `garden-card-copy-verification.json`.
