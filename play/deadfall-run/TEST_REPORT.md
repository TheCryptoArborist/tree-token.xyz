# Deadfall Run 0.5.3 verification

Date: November 4, 2026 (America/Chicago)

## Presentation update

Changed original procedural materials and texture data handling, added a shared sky/reflection environment, adjusted sun/ambient lighting and shadows, added asphalt repairs, and refined visible rig details. All meshes, normals, UVs and instances remain finite in the actual Three.js scene construction checks. Geometry count is 430 meshes and 202,647 stored vertices before instancing; this count is not a performance benchmark. The truck still has 10 tractor wheels and 8 trailer wheels, with the same pivots, body origins and hitch points.

Added audio.js with lazy AudioContext initialization, a reusable oscillator/noise graph, speed/throttle-driven diesel sound, road noise, engine-brake chatter and a rate-limited service-brake air release. Both entry points have enable/mute and volume controls. The sound graph cannot write physics state. It silences on pause, focus loss, menu/result, controller setup, mute and zero volume. Missing/denied audio fails independently of driving. The sound settings tolerate unavailable local storage.

The physics, controller module, both routes and handling exercise logic are unchanged from 0.5.2. No handling tuning was performed in this update.

## NES controller support

Both game entry points include the controller module, setup dialog, mapping legend, and status. Standard-mapped pads have a default layout. An eight-input wizard maps raw NES adapters, including button D-pads, separate X/Y axes, and a single directional axis. Mapping changes are committed only after all inputs have been assigned and released; cancelled setup retains the previous profile. Available local storage persists the mapping. Blocked storage permits a session-only profile.

D-pad Left/Right steers, A throttles, B brakes, Up applies the engine brake, Down holds reverse from rest, Start starts/pauses/resumes/retries, and Select changes camera. D-pad menu navigation and B-to-menu on the result screen are included. Disconnect, focus loss, and opening setup release input and pause the run. Held controls must return to neutral before they can resume driving.

## Retained trailer fix and reproduction

Gentle turns caused the trailer tail to move sideways with the cab. The previous heading calculation repeatedly incorporated a lateral offset produced by body lean. With the truck stationary, 0.035 radians of tractor roll caused about 15.43 degrees of unintended trailer yaw over 120 coupling calls. The corrected model has no yaw drift under that same test.

## Passed automated checks

- 27 descent checks: transformed hitch, forward/reverse behavior, stop/hold, brake heat, frame-rate independence, complete route following, scene geometry, camera projection, controls and restart lifecycle. DOM and renderer are stubs.
- 12 handling checks: steering-rate cap, valid/invalid braking, heat-dependent stopping distance, downhill speed control, both bodies clearing the S-turn cones, reverse docking, invalid docking rejection, trailer-only cone contact, no stationary-start false passes, course geometry, and local dependencies.
- 10 handling UI/lifecycle checks: actual scene initialization with a stub renderer, scenario selectors, start/throttle/pause/resume/retry, keyboard-driven braking results, reverse camera and hitch behavior; plus controller menu/start/driving/braking, edge-triggered pause/camera, disconnect/reconnect, setup/focus/cancel, and controller reverse/engine braking.
- 6 coupling regressions: stationary banked trailer; repeated coupling calls during motion; gentle left/right downhill turns; tractor rear-wheel tracking; actual trailer axle tracking forward/reverse on flat, uphill, and downhill planes; and steady-circle offtracking checked against independent circle geometry.

- 10 controller-module checks: standard actions and deadzone, raw mapping and saved-profile restore, single-axis diagonals, dual button/axis D-pads, release/duplicate handling, cancelling remaps, disconnect/device replacement, focus/pause gating, unavailable/denied APIs, and corrupt profiles/blocked storage.

- 7 audio checks: unavailable/denied API handling, lazy creation and retryable resume, graph reuse over repeated starts, pitch/load and engine-brake layers, air-release timing, immediate silence/disposal, saved settings and blocked storage, and finite bounded parameter values.

Total: **72 passing CPU/DOM/audio-stub checks**. These are not browser playtests.

## Model measurements

- In a one-second, 20%-steering downhill correction starting at 8 m/s, the cab turns about 4.30 degrees and the trailer about 1.15 degrees. The left/right cases mirror one another. The rear trailer axle moves roughly 4 cm sideways over that second as it follows its turning heading; the tail remains within 1 cm of its original lateral position.
- The forward/reverse plane tests constrain sideways axle displacement per step and ground-height error below 1e-9 metres. This measures numerical model consistency, not real tire behavior.
- Independent circle test: a 30 m tractor rear-axle radius, 0.70 m rearward hitch offset, and 7.75 m trailer reach give an expected trailer axle radius of about 28.99 m. Both turn directions agree within 2 mm after settling.
- Controlled braking exercise: approximately 20.02 mph entry speed and an 8.52 m stop distance from the front-bumper line crossing. Exact-20-mph stops remain 8.49 m with cool brakes versus 18.21 m with fully heated brakes.
- A controller completes reverse docking in about 24.59 seconds with approximately 0.066 m lateral offset, 0.73 degrees of trailer heading error, no cone contact, and all five logs. The test controller was retuned to correct the approach earlier; scenario pass criteria were not relaxed.
- Fifth-wheel/kingpin gap remains below 1e-9 metres in the trajectory checks and all four controller-driven exercises.

These are measurements of this simplified game model, not measured behavior of Hard Truck or a real truck. Controllers are test fixtures, not player assistance.

## Browser verification and remaining playtest

The 0.5.3 entry menu was opened in cloud Chrome. WebGL initialization failed with the explicit diagnostic GL_VENDOR=Disabled and GL_RENDERER=Disabled; the visible startup error correctly disables Start. No GPU gameplay or frame-rate claim is made. A separate canvas gallery displayed the actual generated asphalt, gravel, terrain, rubber, metal, bark, endgrain and sky maps. This establishes canvas texture generation, not lighting/shader appearance on a GPU.

The actual audio.js module was rendered by Chrome's OfflineAudioContext for eight seconds through tests/browser-audio.html. It passed with these normalized PCM measurements:

| Measurement | Result |
| --- | --- |
| Peak absolute sample | 0.1199264 (below clipping at 1.0) |
| Idle RMS | 0.0171452 |
| Acceleration RMS | 0.0310268 |
| Engine-brake RMS | 0.0275495 |
| Air-release section RMS | 0.0252476 |
| Paused peak | 0 |
| Reverse RMS | 0.0252792 |
| Muted peak | 0 |

This uses the real Web Audio renderer with a scheduled clock and the unchanged sound module. It is a signal/lifecycle check, not listening to speakers or proving real-time device latency. Runtime AudioContext availability and resume rejection are also covered with stubs.

No physical NES controller or adapter was attached here. The user reported that the preceding test run was much better; the implementation it exercised is retained. Actual graphics, audio character, controller device compatibility and frame rate still require desktop testing. Open index.html, complete the full descent, and compare Chase, Hood and Inspect. Try throttle, engine braking, service-brake release, pause/resume, mute and volume. Use handling.html for the repeatable braking, grade, S-bend and reverse checks.

## Delivery scope

Downloadable handling build and source branch. No production deployment, wallet/payment change, TREE transaction, backend modification, or third-party game asset redistribution.
