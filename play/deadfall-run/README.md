# Deadfall Run — Handling Lab 0.5.3

A downloadable development build for TREE Arcade. This handling lab has not been published to the live arcade.

## Start here

1. Extract the complete ZIP into a new folder.
2. Open **handling.html** in desktop Chrome, Edge, or Firefox with WebGL available. On Windows, **START_HANDLING_TEST.bat** opens the same file.
3. Choose a test and click **START HANDLING TEST**. Start with **Control the grade** and make brief left/right corrections to compare the familiar handling.
4. Use **RETRY** or **R** for the identical starting setup, or **TEST MENU** to choose another exercise.

The original Stormbreak Pass descent is also included: open **index.html** or **START_GAME.bat**. Its menu links to the handling lab. No installation, web server, account, wallet, or network connection is required to drive. The Back to Arcade link opens https://tree-token.xyz/play/.

## Materials, lighting and sound — 0.5.3

This build keeps the 0.5.2 physics, route, handling exercises and controller module byte-for-byte. It changes presentation in both the lab and the full descent:

- Clear-coated cab paint, reflective glass and brushed metal, with one generated sky used for both the backdrop and material reflections.
- Distinct asphalt, gravel, rubber and ground textures; occasional road repairs; warmer sunlight and tighter truck shadows.
- Slightly irregular, varied logs; trailer reflective tape, fasteners, suspension detail and light road dust on the cab.
- Original synthesized diesel, road noise, engine-brake chatter and an air release after service braking. Sound follows speed and throttle. The simulated audio RPM does not add a gearbox or change acceleration.

Clicking Start permits sound in browsers that allow it. If you start with a controller and hear nothing, open **SOUND → ENABLE SOUND** with your mouse or touch screen. The same menu has **MUTE SOUND** and a volume slider. Settings are remembered when browser storage is available. Pausing, opening controller setup, losing focus, ending a run or returning to the menu silences the truck. Sound failure does not prevent driving.

For this build's playtest, open **index.html** and complete the 1.8 km descent. Compare Chase, Hood and Inspect views. Check that the road is readable, the cab and logs feel more grounded, and the three sound cues are distinct: throttle, engine brake, then service-brake release. Pause and resume once and confirm the audio follows. Check **DETAIL → LOW** if the new materials reduce performance on your computer. These are procedural materials and sounds, not photographed assets or recorded truck samples.

## NES-style controller support — 0.5.2

1. Connect a USB controller, or pair a Bluetooth controller with your computer.
2. Open the game, press and release a controller button, then choose **CONTROLLER SETUP**.
3. Center the D-pad and release all buttons. Click **BEGIN SETUP** (or **REMAP BUTTONS**) and follow the eight prompts. Use the labels printed on your controller; this also fixes swapped A/B layouts.
4. Close the panel and press **START** to drive. The selected test or preset can be changed with the D-pad before starting.

| NES control | Driving action |
| --- | --- |
| D-pad Left / Right | Steer |
| A | Throttle |
| B | Service brake |
| D-pad Up | Engine brake |
| D-pad Down, held | Reverse, engaging only from a stop |
| Start | Start, pause, resume; retry from the results screen |
| Select | Change camera |

On the results screen, B returns to the menu. Standard-mapped controllers receive a default layout; use setup if the printed button labels differ. Raw adapters must be mapped first. D-pads exposed as buttons, two axes, or a single eight-way directional axis are supported. The left stick of a standard pad can also act as a digital D-pad.

The game pauses when the active controller disconnects or the window loses focus. Release the controls before resuming. Braking takes priority over throttle and reverse. Keyboard and touch controls remain available. Opening setup pauses the run; closing it leaves the game paused until you resume.

Completed mappings are saved for that controller in this browser when local storage is available. If saving is blocked, the mapping works for the current session. Different browsers, controller modes, or extracted file locations may require setup again. The controller must appear in the browser's Gamepad API; connect/pair it with the operating system first. No physical-controller compatibility has been claimed from automated tests alone.

## Check the trailer fix

Choose **Control the grade**, use SPACE to keep roughly 15–18 mph, and make a brief left correction followed by a right correction. Press **C** three times for the overhead view. The trailer should turn more gradually than the cab; its rear wheels should roll along their heading instead of sweeping sideways. Stop with S and keep holding it: the trailer should stay put. Then use **Keep it in line** to check inside tracking through the S bends.

The rear overhang can make a small outward sweep, and the trailer eventually follows the turn. It should not move sideways in lockstep with the cab.

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

Build 0.5.1 fixes trailer steering caused by body lean. The rear tandem now follows its heading, and the trailer follows signed hitch travel while its rear wheels track forward through a turn. Both directions and reversing retain the exact fifth-wheel/kingpin connection. Simulation uses a fixed 120 Hz step. The road, proving ground, signs, truck, logs, and textures are original procedural assets; Three.js is bundled with its MIT license.

## What this build does and does not establish

This is a 3D handling prototype using simplified kinematic vehicle motion, simulated roll/sway, and brake heat. It is not a full wheel/suspension rigid-body simulation. There is no tire deformation, physical rollover, breakable restraints, independent falling logs, crash deformation, or gear-shifting simulation. The results measure this model; they are not real-world truck safety or stopping-distance data.

The uploaded Hard Truck game was used as a reference for configurable steering and vehicle behavior. Its executable, DLLs, models, textures, sounds, and scripts are not included. Its compiled engine was not ported, and its driving behavior has not been measured here. See HANDLING_NOTES.md.

## Verification

Run **npm test** in this directory (or run the six .cjs scripts in tests/ individually). No dependencies need installing. The 72 checks use real Three.js geometry and simulation with stubbed browser/renderer interfaces. They do not establish GPU rendering, native input feel, speaker sound quality, or frame rate.

The 0.5.3 menu and unsupported-graphics fallback were inspected. This browser reports GL_VENDOR and GL_RENDERER as Disabled and cannot create a WebGL context. The actual generated canvas textures were inspected separately. The actual audio module passed an eight-second browser OfflineAudioContext render: finite output with no clipping, audible sections with nonzero output, and exactly silent pause/mute sections. This is not a listening test or rendered gameplay test. To repeat the audio check, open **tests/browser-audio.html**, click **RENDER SOUND CHECK**, then optionally listen to its locally generated clip.

Actual driving, visual appearance and audio character still require a desktop playtest. If you see an error, include the message, browser/device, chosen test, and a screenshot or short recording.

## Files

- handling.html / handling-route.js / handling-world.js / handling.js: test menu, course, scenery, and measurable criteria.
- index.html / route.js: original 1.8 km descent.
- physics.js: shared vehicle model and hitch constraint, with an injectable route for tests.
- vehicle.js / world.js: original procedural models, materials, and environment helpers.
- gamepad.js: device detection, calibration, saved mappings, and controller input.
- audio.js: locally synthesized engine/road/brake audio, mute, volume and lifecycle.
- tests/browser-audio.html: optional actual-browser PCM render and listening check.
- play.js / styles.css: controls, controller setup, cameras, HUD, and lifecycle for both modes.
- TEST_REPORT.md: checks and verification limits.
- vendor/three.min.js / third-party-notices.txt: bundled Three.js and license.

Deployment belongs under https://tree-token.xyz/play/deadfall-run/. This package is not a production site snapshot and must not be used to replace the complete TREE website or its backend functions.
