# Deadfall Run 0.5.5 verification

Date: November 6, 2026 (America/Chicago)

## Suspension and restrained-load update

Added a secondary motion model that reads the approved driving state without writing to it. Damped springs respond to acceleration, turning and road height at the ten left/right axle contact positions. Spatial roughness increases off road; it is not driven by elapsed time. The cab and trailer have separate spring rates and rotate about their existing coupling anchors. Wheels remain terrain-referenced and ten visible dampers connect them to the sprung frames.

The log bundle moves together within 2.6 cm laterally and 3.5 cm longitudinally. Its small pitch/roll is also bounded. Strap middle points follow the bundle while the two deck anchors stay fixed. Existing tube buffers are deformed instead of allocating new meshes. Smoke starts at the actual stack tips after the sprung-frame transform. Reset/recovery initializes the springs from the current pose and speed; pause does not advance them.

The driving physics, collision solver, controller module, routes, handling exercise criteria and audio are byte-identical to 0.5.4. The vehicle scene now contains 440 mesh objects / 203,167 stored vertices, an increase of ten dampers and 520 vertices. This is a geometry count, not a frame-rate benchmark. Suspension travel is visual and does not add tire forces, wheel lift or rigid-body rollover behavior.

## Collision and sound update

The reported guardrail/tree failures were real gaps: those meshes previously had no collision bodies. The old road-hazard check only reduced speed and applied damage once. This update registers solid rail capsules, forest trunks, road rocks/limbs and rock outcrops, and resolves swept contact for both tractor and trailer footprints. Probes restore the same starting hitch state to avoid steering the trailer as a side effect. A spatial grid limits nearby candidate checks.

Head-on contacts stop at a safe pose. Shallow rail scrapes project remaining motion along the rail, with time-scaled drag. Smaller trees and limbs can yield; large trees block and shake. Impact damage uses closing speed and an object cooldown. Recovery searches for a clear full-rig position. Off-road surface grip, resistance, cross-slope lean and rear-axle surface classification are explicit. Highway presets and the established coupling solver remain intact.

Added a bounded 240-particle world-space pool for smoke from both exhaust stacks, off-road dust and impact debris. Tree instances animate about their bases and restore their original matrices on reset. Recorded truck-engine audio replaces the primary oscillator; separate pulse/noise layers cover engine braking, air release, impacts and scraping. The four-second engine recording is bundled and credited under CC0. No runtime audio fetch is required.

The collision, terrain, scenery reaction and recorded-audio behavior from 0.5.4 is retained. Its 240-particle pool remains bounded; the suspension update only changes where new exhaust particles originate.

## NES controller support

Both game entry points include the controller module, setup dialog, mapping legend, and status. Standard-mapped pads have a default layout. An eight-input wizard maps raw NES adapters, including button D-pads, separate X/Y axes, and a single directional axis. Mapping changes are committed only after all inputs have been assigned and released; cancelled setup retains the previous profile. Available local storage persists the mapping. Blocked storage permits a session-only profile.

D-pad Left/Right steers, A throttles, B brakes, Up applies the engine brake, Down holds reverse from rest, Start starts/pauses/resumes/retries, and Select changes camera. D-pad menu navigation and B-to-menu on the result screen are included. Disconnect, focus loss, and opening setup release input and pause the run. Held controls must return to neutral before they can resume driving.

## Retained trailer fix and reproduction

Gentle turns caused the trailer tail to move sideways with the cab. The previous heading calculation repeatedly incorporated a lateral offset produced by body lean. With the truck stationary, 0.035 radians of tractor roll caused about 15.43 degrees of unintended trailer yaw over 120 coupling calls. The corrected model has no yaw drift under that same test.

## Passed automated checks

- 30 descent/scene checks: transformed hitch, forward/reverse behavior, stop/hold, brake heat, frame-rate independence, complete route following, scene geometry, camera projection, controls and restart lifecycle. DOM and renderer are stubs. Added complete scenery collider coverage, reacting/resetting tree transforms, stack emission/particle bounds/pause/reset, and a full descent with solid hazards enabled and deliberate avoidance.
- 12 handling checks: steering-rate cap, valid/invalid braking, heat-dependent stopping distance, downhill speed control, both bodies clearing the S-turn cones, reverse docking, invalid docking rejection, trailer-only cone contact, no stationary-start false passes, course geometry, and local dependencies.
- 10 handling UI/lifecycle checks: actual scene initialization with a stub renderer, scenario selectors, start/throttle/pause/resume/retry, keyboard-driven braking results, reverse camera and hitch behavior; plus controller menu/start/driving/braking, edge-triggered pause/camera, disconnect/reconnect, setup/focus/cancel, and controller reverse/engine braking.
- 6 coupling regressions: stationary banked trailer; repeated coupling calls during motion; gentle left/right downhill turns; tractor rear-wheel tracking; actual trailer axle tracking forward/reverse on flat, uphill, and downhill planes; and steady-circle offtracking checked against independent circle geometry.

- 10 controller-module checks: standard actions and deadzone, raw mapping and saved-profile restore, single-axis diagonals, dual button/axis D-pads, release/duplicate handling, cancelling remaps, disconnect/device replacement, focus/pause gating, unavailable/denied APIs, and corrupt profiles/blocked storage.

- 8 audio checks: unavailable/denied API handling, lazy creation and retryable resume, graph reuse over repeated starts, pitch/load and engine-brake layers, air-release timing, immediate silence/disposal, saved settings and blocked storage, finite bounded parameter values, and impact/scrape buses that silence on pause.

- 7 collision/terrain checks: cab head-on blocking and reverse escape; a 50 m proposed step across a thin wall; trailer-only reverse contact; shallow rail sliding; mature versus small trees and reset; unchanged contact-free steering; and surface/terrain-bank behavior.

- 9 suspension/load checks: stationary settling on flat/uphill/downhill surfaces; braking nose dip and release; mirrored outward cargo movement and slower trailer lean; sequential axle response to a 6 cm bump; 2,400 steps of identical driving state with secondary motion enabled/disabled; pause and moving-start reset; actual coupling, wheel and strap transforms; bounded cargo under extreme inputs and complete reset; and stack-attached emission with world-space smoke.

Total: **92 passing CPU/DOM/audio-stub checks**. These are not browser playtests.

## Model measurements

- In a one-second, 20%-steering downhill correction starting at 8 m/s, the cab turns about 4.30 degrees and the trailer about 1.15 degrees. The left/right cases mirror one another. The rear trailer axle moves roughly 4 cm sideways over that second as it follows its turning heading; the tail remains within 1 cm of its original lateral position.
- The forward/reverse plane tests constrain sideways axle displacement per step and ground-height error below 1e-9 metres. This measures numerical model consistency, not real tire behavior.
- Independent circle test: a 30 m tractor rear-axle radius, 0.70 m rearward hitch offset, and 7.75 m trailer reach give an expected trailer axle radius of about 28.99 m. Both turn directions agree within 2 mm after settling.
- Controlled braking exercise: approximately 20.02 mph entry speed and an 8.52 m stop distance from the front-bumper line crossing. Exact-20-mph stops remain 8.49 m with cool brakes versus 18.21 m with fully heated brakes.
- A controller completes reverse docking in about 24.59 seconds with approximately 0.066 m lateral offset, 0.73 degrees of trailer heading error, no cone contact, and all five logs. The test controller was retuned to correct the approach earlier; scenario pass criteria were not relaxed.
- Fifth-wheel/kingpin gap remains below 1e-9 metres in the trajectory checks and all four controller-driven exercises.
- The new visible sprung-frame coupling gap also remains below 1e-9 metres through 1,200 simulated driving steps. Wheel center height error is below 3.5 cm on the sampled descent path; this is a bounded visual approximation, not an exact tire-contact constraint on arbitrary terrain.
- At 8 m/s over the test's 6 cm bump, the front axle peaks at 2.10 seconds and the first trailer axle at 3.63 seconds. The cab pitch response stays within its 0.018-radian limit and settles after the bump.

These are measurements of this simplified game model, not measured behavior of Hard Truck or a real truck. Controllers are test fixtures, not player assistance.

## Browser verification and remaining playtest

The 0.5.5 entry menu was opened in cloud Chrome and displayed the correct build label. WebGL initialization failed with “Error creating WebGL context”; the visible startup error correctly disables Start and explains the need for a WebGL-capable browser. Rendered suspension movement and GPU frame rate could not be checked in this environment.

The unchanged audio.js module was previously rendered by Chrome's OfflineAudioContext for eight seconds through tests/browser-audio.html in 0.5.4. That check was not repeated in 0.5.5. It passed with these normalized PCM measurements:

| Measurement | Result |
| --- | --- |
| Peak absolute sample | 0.3664574 (below clipping at 1.0) |
| Idle RMS | 0.0647945 |
| Acceleration RMS | 0.1100996 |
| Engine-brake RMS | 0.0437449 |
| Air-release section RMS | 0.0673217 |
| Paused peak | 0 |
| Reverse RMS | 0.0921536 |
| Muted peak | 0 |

This uses the real Web Audio renderer with a scheduled clock and the actual sound module. It is a signal/lifecycle check, not listening to speakers or proving real-time device latency. Runtime AudioContext availability and resume rejection are also covered with stubs.

No physical NES controller or adapter was attached here. The user approved the preceding handling; its implementation is retained. Actual graphics, audio character, controller device compatibility and frame rate still require desktop testing. Use handling.html for braking nose dip, settling, restrained cargo motion in the S bends, and pause/retry. Use index.html for pavement/gravel/grass response, moving exhaust tips and recovery. Compare Chase, Hood and Inspect. The README includes a short test sequence and the retained collision/audio checks.

## Remaining simulation limits

Contacts use yaw-oriented footprints and conservative height ranges, not full 3D collision meshes. Chassis crush, tire/suspension dynamics, wheel lift, physical rollovers, broken restraints and independently falling cargo are not simulated. Rails remain rigid. Small fallen trees and moved limbs are no longer blocking objects. Signs, reflector markers and mill structures remain non-solid scenery; lab cones remain scoring markers. The automated route test uses a deliberate obstacle-avoidance controller and proves a feasible path, not player difficulty.

## Delivery scope

Downloadable handling build and source branch. No production deployment, wallet/payment change, TREE transaction, backend modification, or third-party game asset redistribution.
