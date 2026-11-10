# Tree Army: Defend the Grove — prototype 0.2

Original self-contained HTML/CSS/JavaScript implementation. No code, artwork, audio, or assets copied from the uploaded Army of Darkness remake. Procedural canvas art is placeholder art for review.

## Play

Intended canonical test route: https://www.tree-token.xyz/play/tree-army/test/
This source commit does not publish the route. Do not substitute a Netlify preview hostname for user testing.

The Tree Hero moves horizontally and automatically fires at nearby enemies. Defend the Tree of Life on the left. Regenerating sap summons Seedlings (25), Acorn Archers (45), and Oak Guardians (75). Q triggers a piercing Acorn Cannon; E heals and shields the grove and reduces damage for five seconds. Seeds earned from enemies and completed waves fund hero, sap, and grove upgrades between waves. There are ten waves, ending with the Iron Stump boss. Hero or grove defeat ends the run. Restart resets all progress. Upgrades last for the run; no persistence or score submission is implemented.

Touch movement, three summon buttons, and two ability buttons are included. A/D or arrows move; 1/2/3 summon; Q/E activate abilities; P or Escape toggles pause. Switching tabs pauses combat. No wallet, payments, tokens, server requests, reward qualification, or backend changes are included.

## Validation

Run `node tests/tree-army-logic.cjs`. Assertions cover purchase costs and cooldowns, insufficient sap, pause freezing, camp transition, upgrades, wave-10 spawning and victory, hero/grove defeat, and restart reset. A mocked canvas smoke check covers draw and HUD execution, not visual correctness. Browser checks were attempted but Chromium cannot create the required sockets in the build environment; phone layout, touch input, and visual appearance need browser review before publication.

## Canonical-domain release

Capture the full CURRENT published inventory first, following root AGENTS.md and production/README.md. Preserve all current static paths, backend packages, runtime/provider records, functions, schedules, and configuration. Overlay only `/play/tree-army/test/index.html` onto that current baseline, not the historical root snapshot. No existing lobby card or routing/configuration is changed by this prototype. Check for applicable existing redirects before release. Keep the test marked noindex and free play. Record candidate and published inventory and source commit, then verify the canonical route. Do not promote the historical root build or rebuild unrelated functions. Source commits use [skip netlify] to avoid queued historical builds.

## First-play improvements — 0.2

Added a three-step skippable field guide covering the objective, hero movement/automatic attacks, and army/ability controls. Battle hints respond to movement, first summon, and low grove health. Troop buttons show cooldowns and the army cap. The first wave spawns closer to the opening view, reducing empty travel time. Controls have 48px minimum height and briefing cards allow scrolling on short screens. Unit checks also exercise the full briefing sequence, keyboard movement, contextual hints, and first-wave entrance position. The canvas battlefield has been rendered with an actual canvas implementation for an internal art check; this does not substitute for browser layout or touch review.

Deployment access check: the Netlify dashboard is accessible and shows automatic publication locked. Current publication observed on November 10 is 6af34e39760c3d568bd12519 (Tree Force approved retro ending/session return), newer than the root historical baseline. No deployment or publication settings were changed. Available Netlify connector operations do not expose the full inventory capture and preserved-package release operations needed here. The new test route remains unpublished.
