# Deadfall Run 0.5.2 verification

Date: November 5, 2026 (UTC)

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

Total: **65 passing CPU/DOM-stub checks**. These are not browser playtests.

## Model measurements

- In a one-second, 20%-steering downhill correction starting at 8 m/s, the cab turns about 4.30 degrees and the trailer about 1.15 degrees. The left/right cases mirror one another. The rear trailer axle moves roughly 4 cm sideways over that second as it follows its turning heading; the tail remains within 1 cm of its original lateral position.
- The forward/reverse plane tests constrain sideways axle displacement per step and ground-height error below 1e-9 metres. This measures numerical model consistency, not real tire behavior.
- Independent circle test: a 30 m tractor rear-axle radius, 0.70 m rearward hitch offset, and 7.75 m trailer reach give an expected trailer axle radius of about 28.99 m. Both turn directions agree within 2 mm after settling.
- Controlled braking exercise: approximately 20.02 mph entry speed and an 8.52 m stop distance from the front-bumper line crossing. Exact-20-mph stops remain 8.49 m with cool brakes versus 18.21 m with fully heated brakes.
- A controller completes reverse docking in about 24.59 seconds with approximately 0.066 m lateral offset, 0.73 degrees of trailer heading error, no cone contact, and all five logs. The test controller was retuned to correct the approach earlier; scenario pass criteria were not relaxed.
- Fifth-wheel/kingpin gap remains below 1e-9 metres in the trajectory checks and all four controller-driven exercises.

These are measurements of this simplified game model, not measured behavior of Hard Truck or a real truck. Controllers are test fixtures, not player assistance.

## Rendering and playtesting limits

This patch adds controller input and setup; the 0.5.1 physics is unchanged. No physical NES controller or adapter was attached, and no GPU playtest was completed. Controller checks inject synthetic Gamepad API snapshots and verify the actual game loop with a stub renderer. In the preceding build, cloud Chrome reported GL_VENDOR=Disabled and GL_RENDERER=Disabled and could not create a WebGL context. The preceding menu/fallback inspection does not establish rendered gameplay quality for this patch.

Actual USB/Bluetooth compatibility, printed A/B labels, controller input feel, graphics, and device frame rate still require desktop testing. Run Controller setup with your device, then check steering, throttle, both brakes, reversing, pause/resume, camera switching, and unplugging while moving. Open handling.html, choose Control the grade, make small corrections in both directions around 15–18 mph, and compare Chase with Overhead (C three times). Then test the S bends and reverse docking. A small tail-overhang sweep is normal; continuous sideways sliding or yaw while stopped is not.

## Delivery scope

Downloadable handling build and source branch. No production deployment, wallet/payment change, TREE transaction, backend modification, or third-party game asset redistribution.
