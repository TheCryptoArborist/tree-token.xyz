# Forest Kingdoms — Development Task List

Updated: November 19, 2026 (America/Chicago)

## Purpose

Build a continuing Tree Arcade adventure starring the Tree Hero: protect woodland communities, reclaim animal factions' ancestral homes, plant useful trees, develop settlements, and lead limited expeditions into other forests.

The immediate milestone is **one upgraded, playable Willowmere scene** using Phaser and a consistent original art style. The wider kingdom is the direction for later milestones.

## Working links

- [Current playable prologue](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/)
- [Source and draft PR #239](https://github.com/TheCryptoArborist/tree-token.xyz/pull/239)
- [Art direction and first-scene brief](ART_DIRECTION.md)
- [Concept 01 — Tree Hero and Willowmere](concepts/willowmere-concept-01.png)
- [Current implementation notes](../../play/forestkingdoms/test/README.md)

This file is the authoritative project checklist. Update its statuses and add the relevant preview or commit evidence as work finishes.

## Current position

**Completed foundation:** The Broken Crossing prologue already includes direct Tree Hero control, Bram, two raider waves, bridge repair, caravan rescue, a one-time grove harvest, ancestral workshop restoration, a working 20% material discount on one beaver recruit, and browser-local saves. Its mission, recruitment, and reload flow were played through in the browser. Phone-sized and tablet-sized layouts were reviewed; this is not physical-device certification.

**Implementation state:** The playable prologue uses a custom Canvas 2D renderer. The isolated character study now includes four-direction idle, walk, strike, root-cast, hit, and defeat artwork: 112 frames in the first full review set. Phaser has been researched and selected as the working upgrade direction; it has **not** been integrated yet. Integration, enemy artwork/reactions, and later story/economy systems remain pending.

**Active task:** FK-02 — Tree Hero sprite and animation set. Recovery and technical checks are verified, but directional walk cycles failed visual gait review following Peter's feedback. Correct the unnatural foot paths and alternating support/weight transfer before acceptance. See [FK-02 verification](FK02_VERIFICATION.md).

**Current build target:** Milestone A — Upgraded Willowmere scene.

## How we will work

- Keep one implementation task active at a time. Research and independent review may support that task without expanding its scope.
- Move a task from **Ready** to **In progress** only when its work starts. Mark **Done** only when the listed result exists and its checks have passed.
- End each visual or gameplay task with a concrete preview, image, or playable change. Record evidence rather than treating a plan as implementation.
- Collect Peter's feedback at useful milestones and incorporate it into the next task. Resolve routine technical details autonomously.
- Preserve the existing prologue as a comparison until the upgraded scene is accepted as the working direction.
- Work on feature branches and review previews. Follow the repository's current release instructions when a production release is requested.
- Check the current MystenLabs/skills README on each new request. Load relevant current Sui skill files before any wallet, SDK, transaction, or on-chain implementation decisions. Preserve the site's working integration and pinned dependencies unless that integration is the explicit task.

## Milestone A — One upgraded Willowmere scene

**Outcome:** Peter can play a short scene that demonstrates the Tree Hero, the forest's new appearance, movement, combat, and phone controls together.

### FK-01 — Define the first scene and art direction

Status: **Done — written specification and Concept 01**

- [x] Record the existing Tree Hero reference, palette, proportions, camera direction, scene contents, and readability requirements.
- [x] Define the first playable scene and its completion criteria in `ART_DIRECTION.md`.
- [x] Create and review a concrete visual reference using the supplied Tree Hero artwork.
- [x] Record the concept's provenance, complete prompt, composition decisions, and handoff to sprite production.

Evidence: the [art brief](ART_DIRECTION.md), [Concept 01 image](concepts/willowmere-concept-01.png), and [concept record](concepts/CONCEPT_01.md). This completes the visual specification and a reference illustration. Production sprites, animation, gameplay-scale/device checks, and engine integration remain separate tasks. Concept 01 is a working direction for Peter's review, not an assertion that every visual detail has been approved.

### FK-02 — Create the Tree Hero sprite and animation set

Status: **In progress — walk-cycle correction required after visual review**. Depends on FK-01. Recovery and verification evidence: [FK02_VERIFICATION.md](FK02_VERIFICATION.md).

- [x] Establish a first in-game character design matching the supplied purple/green/gold hero, including green eyes and the canonical broader build.
- [x] Create the first four-direction idle and walking set: four idle frames and eight walk frames per direction, 48 frames total.
- [x] Create a first four-direction strike, root-cast, hit, and defeat set: four frames per action/direction, 64 additional frames.
- [x] Prepare transparent movement atlases and explicit frame rectangles, ground pivots, per-direction scale measurements, and playback timing.
- [x] Inspect the movement preview at 88 CSS pixels and in a 390-by-844 browser viewport. Physical-device testing remains FK-08.
- [ ] Incorporate movement feedback and verify the complete combat/reaction set before marking FK-02 done.

Evidence: [character animation study](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/animation/), [movement notes](SPRITES_01.md), [combat/reaction notes](SPRITES_02.md), [movement prompts](SPRITE_PROMPTS_01.md), and [combat prompts](COMBAT_PROMPTS_01.md). The existing prologue remains the gameplay comparison; Phaser integration is FK-03.

Done when: a viewable animation preview and engine-ready assets exist; the full hero remains recognizable, proportions stay consistent between frames, and movement does not visibly slide or jump.

### FK-03 — Set up the Phaser scene and connect the hero

Status: **Planned**. Depends on FK-02.

- [ ] Add a version-pinned Phaser dependency to an isolated upgrade preview after checking its current documentation.
- [ ] Load the hero assets; connect directional movement, camera behavior, and the existing keyboard/pointer/touch controls.
- [ ] Keep gameplay state independent of rendering so the tested mission rules can be reused.
- [ ] Confirm the preview starts reliably and pauses/resumes without stuck movement.

Done when: the new hero walks and animates in a real Phaser browser scene on desktop and in a phone-sized layout. A static mockup does not complete this task.

### FK-04 — Build the Willowmere environment and supporting characters

Status: **Planned**. Depends on FK-03.

- [ ] Create a compact original asset set for the riverbank, crossing, grove, tent, workshop, terrain, and a small selection of recognizable trees.
- [ ] Add Bram and one raider type with matching visual treatment.
- [ ] Arrange the scene with clear paths, readable collision boundaries, and correct foreground/background ordering.
- [ ] Make obstructions fade where necessary to keep the hero visible.

Done when: the scene has a coherent style, the hero and objectives remain easy to see, and the crossing and workshop look good at desktop and phone sizes.

### FK-05 — Finish one combat encounter and the graphics comparison

Status: **Planned**. Depends on FK-04.

- [ ] Connect strike, enemy damage, root snare, and enemy defeat to the new animations.
- [ ] Add restrained lighting, water movement, root effects, and hit feedback.
- [ ] Keep attack warnings and input feedback readable during combat.
- [ ] Provide a playable comparison against the original prologue and record loading/performance observations.

Done when: Peter can move, fight, cast roots, and interact with Bram in the upgraded scene, and the visual difference is apparent during actual play. Incorporate concrete visual feedback before converting the remaining prologue.

## Milestone B — Complete and polish the upgraded prologue

**Outcome:** The entire existing adventure works in the new presentation, with understandable controls and dependable progress.

The polished prologue can become a public release candidate at the end of this milestone. Later chapters, expanded economies, and paid features are not prerequisites for that release; FK-16 supplies the release checklist whenever the chosen scope is ready.

### FK-06 — Move The Broken Crossing into the upgraded scene

Status: **Planned**. Depends on FK-05.

- [ ] Connect both raider waves, bridge repair, family movement, supplies, planting, workshop restoration, and discounted recruitment.
- [ ] Give structures and the grove visible before/after states.
- [ ] Preserve the mission's resource accounting, checkpoint recovery, and one-time rewards.
- [ ] Preserve compatible saves on the same origin, or implement an explicit tested migration; document that preview hosts have separate storage.

Done when: a complete playthrough reaches the ending, the guard can be recruited at the correct cost, and reload restores the correct world without duplicate rewards.

### FK-07 — Polish onboarding, story presentation, and sound

Status: **Planned**. Depends on FK-06.

- [ ] Explain movement, strikes, roots, and interaction as the player needs them.
- [ ] Refine dialogue portraits, objective text, journal, win/defeat screens, and navigation.
- [ ] Add consistent original or appropriately licensed sound cues and ambience with an obvious mute control.

Done when: a new player can understand the first objective and basic controls without outside instructions; story and sound support the action without obscuring it.

### FK-08 — Verify the prologue on desktop and real phones

Status: **Planned**. Depends on FK-07.

- [ ] Check the completed flow with keyboard, mouse, and touch.
- [ ] Test on representative physical iOS/Safari and Android/Chrome devices, recording the models and browsers used.
- [ ] Check portrait/landscape controls, safe areas, text, pause/background behavior, loading, and saved progress.
- [ ] Measure the actual download and frame behavior, then reduce artwork/effect cost where the evidence requires it.

Done when: the complete mission is playable on the tested devices without blocked objectives, obscured controls, or lost progress, and remaining limitations are documented.

## Milestone C — Give the kingdom a reason to grow

**Outcome:** A first continuing chapter demonstrates a developing settlement, a second faction, and an expedition with lasting consequences.

### FK-09 — Write the first continuing chapter and persistence rules

Status: **Planned**. Depends on FK-08.

- [ ] Outline the upstream mystery, its characters, missions, ending, and the next story hook.
- [ ] Define which choices and world changes persist and how returning players resume.
- [ ] Define replay and catch-up behavior so missing a release does not prevent following the story.
- [ ] Start with one common storyline and a small number of remembered choices; treat a branching campaign or shared world as later scope.
- [ ] Limit the chapter to the mechanics needed for FK-10 through FK-12.

Done when: a small, implementable chapter brief and progression/state checklist exist. Treat an approximately 30-day cadence as a future operating goal, not a release promise.

### FK-10 — Add the first repeatable settlement economy

Status: **Planned**. Depends on FK-09.

- [ ] Start with a small set of plant/resource roles, growth stages, and building upgrades.
- [ ] Establish production rates, storage caps, upgrade costs, and recruitment costs in a readable balance table.
- [ ] Decide how production behaves during play and while away; avoid assuming unlimited offline production.
- [ ] Keep earned food/materials/seeds clearly distinct from the $TREE token.

Done when: planting and building produce a repeatable, understandable loop that funds upgrades and recruits, with saved progression and no duplicate harvest claims.

### FK-11 — Add one additional animal faction and ancestral home

Status: **Planned**. Depends on FK-10.

- [ ] Design one faction with a distinct unit role, home, visual identity, and bonus; fox scouts are a working candidate.
- [ ] Implement its mission and the rules for claiming/restoring its ancestral home.
- [ ] Clearly show when its recruitment discount or resource bonus applies.
- [ ] Define bonus stacking and any loss-of-control behavior before adding it.

Done when: the faction changes a real player decision and its home bonus works correctly and survives reload. Rivers, lakes, and ponds remain eligible homes for later aquatic factions.

### FK-12 — Add one limited expedition and ship the chapter preview

Status: **Planned**. Depends on FK-11.

- [ ] Let the player choose a capped force and resource loadout for one new map.
- [ ] Define departure, victory, defeat, retreat, and return rules before enabling the journey.
- [ ] Keep the home settlement intact and reconcile returning resources/troops exactly once.
- [ ] Complete the chapter missions, consequence, journal update, and next-chapter hook.

Done when: a player can leave Willowmere, finish or retreat from the expedition, return to the persistent home, and see the chapter's result reflected in the world.

## Milestone D — Connect access, purchases, and release operations

**Outcome:** The proven game can become part of Tree Arcade's ongoing membership and content offering.

### FK-13 — Connect player identity and durable progress

Status: **Planned**. Depends on FK-12.

- [ ] Define save ownership, returning-player restoration, and how a guest save becomes an account save.
- [ ] Reuse the existing Arcade identity/session approach where suitable.
- [ ] Establish which progression must be server-validated before attaching paid entitlements or competitive outcomes.

Done when: an eligible returning player can restore the correct progress across supported sessions/devices and a modified browser save cannot manufacture a paid entitlement.

### FK-14 — Define and implement NFTree access

Status: **Planned**. Depends on FK-13.

- [ ] Set the exact free-prologue/full-campaign boundary and explain NFTree benefits clearly.
- [ ] Decide how ownership changes affect future access and retained story progress.
- [ ] Use the existing verified ownership/access approach; check current Mysten guidance and project constraints before implementation.

Done when: a guest can understand the offer, an eligible holder gets the intended access, and returning play does not unnecessarily interrupt the game with repeated wallet prompts. The paid-content policy is still to be defined; this roadmap sets no new price.

### FK-15 — Define and implement optional $TREE purchases

Status: **Planned**. Depends on FK-14.

- [ ] Choose the initial purchasable units, buildings, cosmetics, or expedition content and evaluate their effect on balance.
- [ ] Set prices and exact entitlement behavior only after the underlying gameplay loop has been tested.
- [ ] Reuse the approved checkout flow; cover wallet rejection, failed/pending payments, verified receipts, duplicate prevention, and recovery.

Done when: a completed purchase grants its intended benefit once, cancellation grants nothing, and a player can recover a verified purchase after returning. This roadmap sets no purchase prices.

### FK-16 — Prepare the public release and continuing chapter workflow

Status: **Planned — release checklist**. Use after FK-08 for a prologue release, after FK-12 for a chapter release, or after FK-15 when paid features are included. It does not require all earlier tasks if they are outside that release's scope.

- [ ] Choose whether the first public release is the polished prologue or the prologue plus the first continuing chapter.
- [ ] Prepare the Arcade cabinet, clear entry instructions, preview media, credits, and a feedback route.
- [ ] Define the chapter authoring/review process, keep prior story accessible, and prepare a small content buffer before promising a monthly cadence.
- [ ] Apply the repository's current release procedure to an explicitly requested production release, preserving the full live inventory.

Done when: the chosen release scope has passed its checks, the public entry reaches the correct game, the rollout is verified, and the next chapter has a concrete production plan.

## Later ideas — outside the next milestone

- Additional animal factions, aquatic territories, and biome-specific bonuses.
- More trees/plants and larger settlement specialization.
- Additional expedition maps and longer campaign branches.
- Seasonal story events and cosmetic collections.
- Co-op, PvP, competitive rewards, and shared-world outcomes, each requiring separate design and authority decisions.
- Full 3D, a rotating camera, native apps, or console versions if the project's direction later calls for them.

## Session closeout record

For each completed implementation task, append: task ID, changed behavior, preview link, checks actually performed, remaining issues, and the next task. Do not mark physical-device tests, future chapters, art, engine work, or payment integrations complete until they exist and have been verified.

### November 19, 2026

- FK-01 completed as a written specification.
- Roadmap created from the working prologue and Peter's requested direction.
- Next: FK-02, Tree Hero sprites and animation.
- No runtime changes or new release are part of this documentation step.

### November 19, 2026 — FK-01 visual reference

- Peter requested beginning Phase One, Task One. Expanded the existing written specification into a concrete visual target.
- Created Concept 01 with the supplied Tree Hero identity, Bram, the broken crossing, grove, timber workshop, and a coherent original illustrated woodland style.
- Reviewed the image for identity, complete body/proportions, scene composition, and the limits of translating a large illustration into game assets. No phone-size animation or physical-device result is claimed.
- Separated FK-01 completion checks from the later playable-scene acceptance checklist.
- Recorded the complete prompt, reference provenance, and production handoff in `concepts/CONCEPT_01.md`.
- Next: FK-02, beginning with consistent directional idle and walk artwork.
- The playable preview continues to show the original Canvas implementation; this art-direction step does not change the game runtime or production deployment.

### November 19, 2026 — FK-02 first movement pass

- Began FK-02 with four directional atlases: 16 idle frames and 32 walk frames. Kept the canonical green eyes and broader build with the purple/green/gold identity.
- Added an isolated animation viewer with direction/animation selection, pause/step, speed controls, contact guides, keyboard/pointer movement, and a simultaneous 88 CSS pixel view.
- Added explicit trimmed frame rectangles and relative ground pivots; kept the original generated PNG bytes and alpha. Saved complete prompts and provenance.
- Reviewed the browser preview and a 390-by-844 viewport, checked source/frame integrity and syntax, and fixed unused-pad blur and shifted-key-release issues. No physical-phone result is claimed.
- Expanded only the review builder's explicit static-file additions for the new viewer and artwork. The original prologue and production release configuration remain the comparison baseline.
- FK-02 remains in progress: incorporate feedback, then create strike, root-cast, hit, and defeat before advancing to FK-03.
