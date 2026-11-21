# Forest Kingdoms — The Broken Crossing

An original, browser-playable Tree Arcade prologue starring the purple-and-green Tree Hero. This first playable slice establishes a continuing forest adventure: rescue woodland families, rebuild an outpost, grow its economy, and restore an animal faction's ancestral home.

## Development plan

The [development task list](../../../docs/forest-kingdoms/ROADMAP.md) tracks the graphics upgrade and later campaign work one task at a time. The [first-scene art brief](../../../docs/forest-kingdoms/ART_DIRECTION.md) defines the next visual milestone. The current playable version still uses its original Canvas 2D renderer; Phaser integration is a planned task.

## Play

Preview entry: `/play/forestkingdoms/test/`

- **Move:** WASD, arrow keys, or click/tap a destination. Small screens also have a drag joystick.
- **Strike:** hold Space or the Strike button.
- **Root snare:** Q or Root snare. Nearby raiders are held briefly; the ability has a cooldown.
- **Interact:** E or the contextual Interact button near the objective.
- **Journal:** J or the journal icon. Pause: Escape or the pause button.

The mission introduces Bram, a beaver engineer. Defend the caravan against two raider waves, spend eight materials to repair the crossing, wait for all three families to cross, recover the supply cache, plant a grove, and spend ten materials to restore the Beaver Guild workshop. The restored ancestral home reduces the guard's material cost from ten to eight. One guard can be recruited for eight materials and four food.

The grove's first harvest grants six food once. This prototype does not yet simulate recurring harvests or an open-ended settlement economy.

## Scope and persistence

This is a self-contained single-player prologue with original canvas-drawn scenery and characters. `assets/hero.jpg` is the project owner's supplied Tree Hero title artwork. No third-party game code, graphics, audio, or mission layouts are included.

Progress is saved in this browser's local storage under `tree-arcade:forest-kingdoms:prologue:v1`. Saves are validated and versioned. Storage may be unavailable in restricted browser modes. Saves do not sync between devices or preview origins. Starting a new adventure asks before replacing the local save.

There are no wallet connections, NFT access checks, token purchases, multiplayer services, analytics, or external network requests in this game. The prologue ends with an upstream story hook; the next chapter is not implemented.

## Files and preview integration

- `engine.mjs`: mission state, combat, river collision, resource costs, rewards, recruitment, checkpoint recovery, and save validation.
- `renderer.mjs`: original canvas terrain, animated characters, effects, structures, and responsive camera.
- `app.mjs`: keyboard, pointer, joystick and action controls; modal story; browser saves; optional synthesized sound; bounded simulation catch-up for dropped frames.
- `index.html` and `styles.css`: title, HUD, help, journal, and result screens.
- `engine-check.mjs`: focused logic checks; not copied into the runtime preview.

The root `scripts/build-feature-preview.mjs` has an additive six-file allowlist entry for this prologue. It uses the repository's existing deploy-preview build. No production build settings or existing game, wallet, payment, session, or backend files are modified.

## Verification

Run the focused engine checks from the repository root:

```sh
node play/forestkingdoms/test/engine-check.mjs
```

They cover the complete mission, both combat waves, bridge collision, resource costs, the 20% discount, one-time rewards, partial caravan rescue and save recovery, invalid saves, and combat checkpoint recovery.

Browser review covers the mission ending, recruitment, reload/continue persistence, and responsive layouts. A phone-sized browser viewport is not a substitute for testing on physical iOS and Android devices before release.

This branch is intended for review previews. Follow the repository's release and preservation instructions before any production release.
