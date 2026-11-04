# Deadfall Run — Handling Lab 0.5.0

A downloadable development build for TREE Arcade. This handling lab has not been published to the live arcade.

## Start here

1. Extract the complete ZIP into a new folder.
2. Open **handling.html** in desktop Chrome, Edge, or Firefox with WebGL available. On Windows, **START_HANDLING_TEST.bat** opens the same file.
3. Choose a test and click **START HANDLING TEST**. Start with **20 mph stop**.
4. Use **RETRY** or **R** for the identical starting setup, or **TEST MENU** to choose another exercise.

The original Stormbreak Pass descent is also included: open **index.html** or **START_GAME.bat**. Its menu links to the handling lab. No installation, web server, account, wallet, or network connection is required to drive. The Back to Arcade link opens https://tree-token.xyz/play/.

## Four repeatable exercises

| Test | Goal |
| --- | --- |
| 20 mph stop | Cross the white line with the front bumper at 18–22 mph. Brake with S and stop within the 35 m zone. Hold the brake for one second. |
| Downhill control | The rig starts rolling at 16 mph on a 7% grade. Stay at 12–22 mph for at least 75% of the run; peak speed must stay at or below 25 mph. |
| Trailer tracking | Clear three cone gates through an S bend, keeping below 18 mph and carrying all five logs. Both tractor and trailer can touch cones. |
| Reverse docking | Back from a slightly angled, offset start into the gold bay. Fit the whole trailer inside, center it, straighten the rig, and hold S at rest for two seconds. |

Cones are contact/scoring markers, not solid collision objects. Test results include peak speed, brake heat, hitch gap, articulation, and the relevant stopping or course measurements. Recovery in the lab restarts the attempt; it cannot preserve progress toward a pass. Results are local to the current session.

## Controls

| Key | Action |
| --- | --- |
| W / Up | Throttle |
| S / Down | Service brake; hold to stop and remain stationary |
| A / D or Left / Right | Steering; return toward center when released |
| Space | Engine brake |
| V, held | Reverse, engaging only from a stop |
| C | Chase → hood → inspect → overhead (lab only) |
| Mouse drag / wheel in Inspect | Orbit / zoom |
| R | Restart this handling test; recover with damage penalty in the original descent |
| Escape | Pause / resume |
| F3 | Hitch and rendering diagnostics |

The reverse test starts with the overhead camera. Make small corrections and pull forward to straighten if needed. Touch controls are included, but desktop is the current testing target.

## Handling changes

The lab has a separate loaded-rig tune: a 20°/second steering-rate limit, greater low-speed steering travel, gentler acceleration, slower reverse, lower braking acceleration, and gradual fade as service brakes heat. Service braking suppresses throttle thrust in the lab. The original Easy/Standard/Heavy descent presets retain their prior tuning.

The fifth wheel and kingpin use the same exact transformed-position constraint as build 0.4.1. Simulation uses a fixed 120 Hz step. The road, proving ground, signs, truck, logs, and textures are original procedural assets; Three.js is bundled with its MIT license.

## What this build does and does not establish

This is a 3D handling prototype using simplified kinematic vehicle motion, simulated roll/sway, and brake heat. It is not a full wheel/suspension rigid-body simulation. There is no tire deformation, physical rollover, breakable restraints, independent falling logs, crash deformation, or gear-shifting simulation. The results measure this model; they are not real-world truck safety or stopping-distance data.

The uploaded Hard Truck game was used as a reference for configurable steering and vehicle behavior. Its executable, DLLs, models, textures, sounds, and scripts are not included. Its compiled engine was not ported, and its driving behavior has not been measured here. See HANDLING_NOTES.md.

## Verification

Run **npm test** in this directory (or run the three scripts in tests/ individually). No dependencies need installing. The 44 checks use real Three.js geometry and simulation with stubbed browser/renderer interfaces. They do not establish GPU rendering, native input feel, or frame rate.

The cloud-browser menu and unsupported-graphics fallback were inspected. That browser reports GL_VENDOR and GL_RENDERER as Disabled and cannot create a WebGL context. Actual driving and visual appearance still require a desktop playtest. If you see an error, include the message, browser/device, chosen test, and a screenshot or short recording.

## Files

- handling.html / handling-route.js / handling-world.js / handling.js: test menu, course, scenery, and measurable criteria.
- index.html / route.js: original 1.8 km descent.
- physics.js: shared vehicle model and hitch constraint, with an injectable route for tests.
- vehicle.js / world.js: original procedural models, materials, and environment helpers.
- play.js / styles.css: controls, cameras, HUD, and lifecycle for both modes.
- TEST_REPORT.md: checks and verification limits.
- vendor/three.min.js / third-party-notices.txt: bundled Three.js and license.

Deployment belongs under https://tree-token.xyz/play/deadfall-run/. This package is not a production site snapshot and must not be used to replace the complete TREE website or its backend functions.
