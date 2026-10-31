# TREE Arcade integration — 0.4.1

Canonical play URL: https://tree-token.xyz/play/deadfall-run/

Back to Arcade: https://tree-token.xyz/play/

Free 3D play-test build; no wallet, TREE payments, marketplace, or Daily Growth quest integration. Published using the current live site digest inventory, preserving all unrelated static files, all 40 function packages/configurations, and five schedules. Run `node tests/run.cjs` in this folder. These tests use a stub renderer; real-browser WebGL checks are recorded separately in the release report.

# Deadfall Run — 3D Field Test 0.4

TREE Arcade · Stormbreak Pass · September 22, 2026

The previous build already used Three.js. This release upgrades that real-time 3D scene and its vehicle models; it is not a 2D-to-3D conversion or a finished photorealistic simulator.

## Start the downloadable game

1. Extract the COMPLETE ZIP into a NEW folder. Do not open index.html from inside the ZIP or mix these files with an older version.
2. Open `index.html` in a desktop browser with WebGL and hardware acceleration enabled. On Windows, `START_GAME.bat` opens that same file; Python is not required.
3. Wait for “3D ready · Works offline · Build 0.4”, choose a handling preset, and click BEGIN DESCENT.

All scripts, models and textures are local. There are no CDN requests, accounts, wallet prompts, telemetry, payments or installations. The classic Three.js script is deliberately bundled to retain double-click launching; its deprecation warning is not a startup failure. A local HTTP server is optional, not required by the package.

The LOW / BALANCED / HIGH detail button changes rendering resolution and dynamic shadows. Start on BALANCED; use LOW if the game stutters. Desktop is the primary testing target. Touch controls are included, but this build has not been tested on a phone or tablet.

## What changed

- A shaped day-cab and bonnet, split windshield, mirrors, exhaust stacks, steps, fuel tanks, grille, headlights and brake lamps.
- Eighteen individual rolling wheels, steerable front wheels, detailed hubs and tyre tread; rear tandem axles on the log semitrailer.
- Five tapered, bark-textured logs with end-grain rings, upright stakes and visible restraints.
- Continuous road and cut terrain meshes instead of separate flat boxes. A mountain valley, layered forest, rock outcrops, distant ridges, road markings, warning signs and a recovery mill.
- Directional sunlight, dynamic shadows, an atmospheric sky gradient and distance fog.
- Chase, hood and draggable 3D inspection cameras. The whole rig fits the chase view in the tested desktop camera projection.
- A full 3D hitch constraint: the trailer kingpin and fifth wheel coincide through yaw, pitch and roll.
- A fixed 120 Hz simulation step, smooth road heights, brakes that do not push the truck into reverse, and sustained reverse from a stop.
- Automatic pause and released controls on focus loss. Restart restores every log; recovery does not restore lost cargo or erase existing damage.
- Startup errors are displayed instead of leaving an unexplained unresponsive start button.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Throttle, with gradual response |
| S / Down | Service brake; extended braking generates heat and fade |
| A / D or Left / Right | Speed-sensitive steering |
| Space | Engine brake; does not add service-brake heat |
| V, held | Reverse; only engages from a stop |
| R | Recover to the road; adds 5% damage |
| C or CAMERA button | Chase → hood → inspect |
| Drag in INSPECT | Orbit the camera horizontally and vertically |
| Mouse wheel in INSPECT | Zoom |
| Escape or PAUSE | Pause / resume; inspection still works while paused |
| F3 | Frame rate, draw calls, articulation and hitch-gap diagnostics |

Easy, Standard and Heavy are handling presets, not different content unlocks. Standard is the reference balance. On touch devices, use the steering slider and the on-screen throttle, brake, engine-brake, reverse and recovery buttons.

## Suggested first playtest

1. Start, accelerate gently, brake to a full stop, then hold V to reverse.
2. Drive a slow left-right S-turn in chase view. The trailer should follow and stay physically joined at its front.
3. Pause and switch to INSPECT. Drag around the rig to inspect its hitch, axles, logs and clearance. Switch to HOOD and resume.
4. Compare service-brake heat with engine braking on the long grade. Try a road hazard with the tractor and with the trailer.
5. Recover once; confirm a 5% damage charge. Finish or fail a run, click DRIVE AGAIN, and confirm five logs and zero damage.
6. Try LOW and HIGH detail. Include your device/browser, view, speed, and a screenshot or short recording when reporting a problem. F3 helps identify performance or coupling problems.

## Validation and limits

`node tests/run.cjs` runs the included dependency-free regression suite. It constructs the actual Three.js geometry and checks transformations and simulation behavior. The renderer and DOM are stubs in these tests; this does NOT verify GPU shader compilation, browser input behavior, rendered appearance, touch layouts or real-device frame rate. Local-file browser preview was blocked in the build environment. Please treat 0.4 as a test build, not visually certified release software.

Vehicle movement remains a kinematic approximation with simulated roll, sway and brake heat. It is not full wheel/suspension rigid-body physics. Collision footprints are approximate; roadside trees, guardrails and buildings are scenery, not solid barriers. Lost logs disappear rather than falling as independent physics bodies. Restraints are visual and do not simulate breakage. There are no physical rollovers, crash deformation, audio, saved progress, persistent scores, TREE economy, wallet or marketplace in this build.

## Source layout

- `route.js`: shared road coordinates, height field and route projection.
- `physics.js`: fixed-step vehicle dynamics and exact transformed hitch constraint.
- `world.js`: terrain, road, lighting, instanced forest and local texture generation.
- `vehicle.js`: procedural truck/trailer geometry and visual animation.
- `play.js`: initialization, controls, cameras, HUD and run lifecycle.
- `tests/run.cjs`: CPU/DOM-stub regression tests.
- `vendor/three.min.js`: bundled Three.js r160; see THIRD_PARTY_NOTICES.txt.

No package manager or build step is needed to play.
