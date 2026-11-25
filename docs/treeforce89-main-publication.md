# Tree Force main-game promotion and festive cabinet — published

Main game: https://tree-token.xyz/play/treeforce89/
Arcade cabinet: https://tree-token.xyz/play/

Owner explicitly authorized main-game promotion and the cabinet countdown, then approved the festive messages. Ready/locked deployment `6b06668752cda878be6a57e9` was published from source `4e637d6`, preserving baseline `6b0663eb4b2316cfc7ad2bc8`.

## What changed

The main entry now loads reviewed r18, retaining the approved gameplay/audio/mobile improvements and holiday presentation. The selector reads **Normal / Holiday**. Cabinet and game title screen import one shared schedule and message module:

- Before November 27, 2026 at 06:00 UTC: “A little Christmas magic arrives in…”
- During the season: “Keep the Christmas spirit flying! Time remaining…”
- At January 1, 2027 at 06:00 UTC: cabinet seasonal notice disappears and new runs no longer select Holiday. Existing runs keep their captured theme.

The instants remain midnight Central Standard Time. Title-screen notice/selector hide during combat to preserve the phone playfield and controls. The cabinet countdown is within the existing linked Tree Force card and keeps its main-game destination.

Only `/play/index.html` and `/play/treeforce89/index.html` changed. All other 748 existing paths retain exact hashes; seven versioned scripts/modules were added, giving 757 total paths. All 61 complete backend/provider records, five schedules, runtime and API-visible configuration were preserved. Review routes remain available. No real payment, wallet signature, pricing/access change or multichain activation occurred.

## Verification and efficiency

[Publication run 45548197235](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45548197235) passed 38 preservation/unit checks, payload hashes, candidate and canonical browser checks, and final full inventory/configuration comparison. Candidate and live checks at 390/1000 cover cabinet opening countdown, seasonal transition, expiry hiding, unchanged cabinet destination, main r18 entry/CSS, wallet gate, three lives, continue-price copy, shared approved wording and synthetic Holiday selection. The game fixture uses injected time and no real wallet. All browser errors were empty. Earlier focused regression covers controls/continue and audio; the exact main r18 also passed all ten simulated wallet/session/save/share checks at 390px.

One combined Netlify publication uploaded nine payloads totaling 2,090,070 bytes; unchanged website and backend packages were reused, not rebuilt. Source commit uses `[skip netlify]`; publication was run only through the preservation workflow. Snapshot evidence is in `treeforce89-main-publication/`; extracted plan fingerprint independently verified.

Remaining phone review: real-device holiday readability, audio and performance after seasonal unlock. Owner previously accepted normal gameplay and the review countdown. Device-clock timing is cosmetic; same-mount theme continuity is covered, but full reload/replacement-mount theme persistence remains outside this feature. Future multichain host integration must preserve its own authorization and restoration contract.
