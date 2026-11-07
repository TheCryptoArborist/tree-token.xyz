# Deadfall Run — Handling Lab 0.5.6

A downloadable development build for TREE Arcade. This handling lab has not been published to the live arcade.

## Start here

1. Extract the complete ZIP into a new folder.
2. Open **handling.html** in desktop Chrome, Edge, or Firefox with WebGL available. On Windows, **START_HANDLING_TEST.bat** opens the same file.
3. Choose a test and click **START HANDLING TEST**. Start with **Control the grade** and make brief left/right corrections to compare the familiar handling.
4. Use **RETRY** or **R** for the identical starting setup, or **TEST MENU** to choose another exercise.

The original Stormbreak Pass descent is also included: open **index.html** or **START_GAME.bat**. Its menu links to the handling lab. No installation, web server, account, wallet, or network connection is required to drive. The Back to Arcade link opens https://tree-token.xyz/play/.

## Tree impact and crash aftermath fix — 0.5.6

The old failure screen immediately stopped the tree animation, particles and suspension and silenced the impact when damage reached 100%. That could make a tree strike look like only a “Truck disabled” message.

Impacts now give the sprung cab/trailer and secured load a short directional jolt. If accumulated damage reaches 100%, the engine stops and driving input is locked while the scene settles for 2.6 seconds. The impact sound finishes, debris clears, and tree reactions continue. The camera eases to Inspect after the initial impact. A smaller results panel leaves the scene visible, identifies the object, contact body and impact speed, and offers **RESTART DESCENT**. Drag to look around, or use C / SELECT to change camera. START also restarts after results appear.

Smaller impacts still allow you to brake and reverse clear with V, or use R to recover with the existing damage penalty. A large tree stays solid; a small tree can fall when struck hard enough. Collision blocking, damage thresholds, steering and trailer tracking are unchanged. This fix adds crash feedback and a working aftermath, not crushed body panels, free-flying logs or a rigid-body rollover simulation.

### Test this fix first

1. Extract the new ZIP into a separate folder and open **index.html**. Leave the road where there is no guardrail. Approach a tree slowly, release throttle, and check the jolt and tree reaction. Brake, then hold V to back away.
2. In a fresh run, try a harder impact. Watch the damage meter: reaching 100% should stop the engine but leave the impact visible before the result panel appears. A hard first hit may leave the truck drivable if accumulated damage stays below 100%.
3. During the aftermath, pause and resume. After results appear, drag to inspect, then choose **RESTART DESCENT**. Check that damage is zero, all five logs are present and scenery has reset.

Please report approximate impact speed, damage before the hit, tree size and camera view if the response still looks wrong. A recording of the impact would help distinguish contact behavior from animation.

## Suspension and secured cargo update — 0.5.5

The cab and trailer now have separate damped pitch and lean responses. Braking produces a small nose dip; road height is sampled at each axle so uneven ground reaches the front wheels before the trailer. Roughness increases on gravel and grass and depends on distance travelled, so the parked truck does not keep bouncing. Wheels follow the sampled terrain, and visible dampers connect the axles to the moving frames.

The five logs move as one restrained bundle, with at most 2.6 cm of sideways travel and 3.5 cm fore/aft. Straps follow the bundle while their end anchors stay on the trailer. Exhaust particles originate at the moving stack tips. Pause freezes the response, and retry/recovery resets it without a false acceleration jolt.

This is a secondary visual suspension model. The established steering, braking, collision and fifth-wheel calculations are unchanged. Both sprung frames pivot at their coupling anchors, preserving the visible connection. It does not add wheel forces, a physical rollover or independently falling logs.

### Test the new motion

1. Open **handling.html**, choose **20 mph stop**, start, and press C twice for Inspect. Accelerate and brake; look for a small nose dip and a prompt, damped return at rest. The body should not bounce continuously.
2. Repeat **Control the grade** and **Keep it in line**. Use brief left/right corrections and watch for slight outward load movement and a slower trailer response. The rear wheels should retain the handling you already tested.
3. Open **index.html** and leave the road slowly where there is no guardrail. Compare the movement on pavement, gravel and grass. Keep speed low enough to see each axle react, then check that both exhaust plumes still start at their stack tips.
4. Pause, resume, recover with R, and retry. Look for sudden jumps, floating tires, a separated hitch, loose-looking straps or motion continuing while paused. Compare left and right turns and try your NES controller.

Please include the course, camera, approximate speed and surface if the movement looks excessive or unnatural. A short recording is useful for tuning the amount of suspension travel.

## Collision, exhaust and engine update — 0.5.4

This build addresses the test feedback about scenery having no physical response and the synthetic engine sound:

- Both the tractor and trailer now collide with guardrails, standing tree trunks, road hazards and rock outcrops. Swept contact checks prevent crossing thin obstacles between physics steps. Head-on hits stop the rig; shallow rail scrapes can slide along it. Impact damage depends on closing speed, with a cooldown so resting contact does not drain health every frame.
- Large trees remain solid and shake on impact. Smaller trees can fall after a sufficiently hard hit; fallen road timber can be pushed aside. Wood/leaf particles, rock dust and rail sparks give visible feedback. A fresh run restores damaged scenery.
- Both exhaust stacks emit faint smoke at idle and darker smoke under throttle. Smoke is left in world space as the truck moves. Off-road driving adds dust.
- Pavement, gravel and grass use different grip/resistance. The rear trailer axle also counts when determining the surface. Off-road body lean follows the cross-slope of the ground. The speed display identifies the current surface.
- A locally bundled, edited truck-engine recording replaces the main synthesized buzz. Throttle and simulated RPM change its sound; the engine brake has an irregular exhaust-pulse layer. Air release, impacts and scraping have separate sounds. See third-party-notices.txt for the recording's CC0 credit.

The fifth-wheel solver, steering presets, NES mappings, courses and four handling exercise criteria are retained. Contact response is a swept kinematic approximation; it does not model chassis deformation, dynamic tire/suspension forces or a physical rollover. Small fallen trees and displaced limbs cease blocking the rig; they are animated scenery after the hit, not freely simulated rigid bodies. Reflector markers, signs and the mill are still scenery. Lab cones remain scoring markers.

Clicking Start permits sound in browsers that allow it. If you start with a controller and hear nothing, open **SOUND → ENABLE SOUND** with your mouse or touch screen. The same menu has **MUTE SOUND** and a volume slider. Settings are remembered when browser storage is available. Pausing, opening controller setup, losing focus, ending a run or returning to the menu silences the truck. Sound failure does not prevent driving.

## Retest collisions and sound

Use **index.html** for the full descent. Choose **HEAVY** for deliberate driving, and use a fresh run for each destructive test.

1. Idle, accelerate, then hold SPACE while moving. Compare the diesel engine and engine-brake sound; release S after braking to hear the air release. Pause/resume and check mute once.
2. Change to Inspect with C and orbit to see the two exhaust tips. Compare smoke at idle and while accelerating.
3. Approach the first left-side guardrail, about 160 m into the course, slowly. Try a shallow scrape, then a more direct hit in a fresh run. Neither body should cross it. Brake to a stop, then hold V to back clear; use R if wedged.
4. Leave the road where there is no guardrail. Check the surface label, drag, body lean and dust. Try a slow trunk impact, then compare a small tree and a larger tree at higher speed in separate runs.
5. Back the trailer into a trunk or rock to check trailer-only contact. The fifth wheel must stay attached. R should recover to a clear road position; restarting should restore scenery.
6. Open **handling.html** and repeat the grade, S-bend and reverse tests with your NES controller to check the previously improved handling.

Please report the object, approximate speed, cab or trailer contact, and camera view if anything still passes through or reacts oddly. A short recording is especially useful. Audio character and rendered effects still need desktop feedback.

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

This is a 3D handling prototype using simplified kinematic vehicle motion, a secondary damped suspension/load response, and brake heat. It is not a full wheel/suspension rigid-body simulation. Suspension travel is bounded and does not feed forces back into steering or grip. There is no tire deformation, physical rollover, breakable restraints, independent falling logs, crash deformation, or gear-shifting simulation. The results measure this model; they are not real-world truck safety or stopping-distance data.

The uploaded Hard Truck game was used as a reference for configurable steering and vehicle behavior. Its executable, DLLs, models, textures, sounds, and scripts are not included. Its compiled engine was not ported, and its driving behavior has not been measured here. See HANDLING_NOTES.md.

## Verification

Run **npm test** in this directory (or run the nine .cjs scripts in tests/ individually). No dependencies need installing. The 98 checks use real Three.js geometry and simulation with stubbed browser/renderer interfaces. This includes nine suspension/load checks, five new crash lifecycle checks and an audio regression ensuring engine shutdown does not cancel the impact. They do not establish GPU rendering, native input feel, speaker sound quality, or frame rate.

The 0.5.6 menu and unsupported-graphics fallback were inspected. This browser could not create a WebGL context, so rendered crash movement and the results layout could not be reviewed here. The audio module previously passed an eight-second browser OfflineAudioContext render in 0.5.4: finite output with no clipping, audible sections with nonzero output, and exactly silent pause/mute sections. That audio render was not repeated for 0.5.6; its new engine-shutdown branch has an automated graph/lifecycle check. To repeat the browser render, open **tests/browser-audio.html**, click **RENDER SOUND CHECK**, then optionally listen to its locally generated clip.

Actual driving, visual appearance and audio character still require a desktop playtest. If you see an error, include the message, browser/device, chosen test, and a screenshot or short recording.

## Files

- handling.html / handling-route.js / handling-world.js / handling.js: test menu, course, scenery, and measurable criteria.
- index.html / route.js: original 1.8 km descent.
- physics.js: shared vehicle model and hitch constraint, with an injectable route for tests.
- ride.js: separate damped suspension and restrained-load response, reading but never changing driving state.
- vehicle.js / world.js: original procedural models, materials, and environment helpers.
- gamepad.js: device detection, calibration, saved mappings, and controller input.
- engine-sample.js / audio.js: bundled engine recording, brake/road/impact layers, mute, volume and lifecycle.
- collision.js: swept contacts for both articulated bodies.
- effects.js: exhaust, dust and impact particles.
- tests/browser-audio.html: optional actual-browser PCM render and listening check.
- play.js / styles.css: controls, controller setup, cameras, HUD, and lifecycle for both modes.
- TEST_REPORT.md: checks and verification limits.
- vendor/three.min.js / third-party-notices.txt: bundled Three.js and license.

Deployment belongs under https://tree-token.xyz/play/deadfall-run/. This package is not a production site snapshot and must not be used to replace the complete TREE website or its backend functions.
