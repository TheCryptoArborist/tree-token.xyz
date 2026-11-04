# Deadfall Run 0.5.0 verification

Date: November 3, 2026 (America/Chicago)

## Passed automated checks

- 27 existing descent checks: transformed hitch, forward/reverse behavior, stop/hold, brake heat, frame-rate independence, full-route following, original scene geometry, camera projection, controls and restart lifecycle. DOM and renderer are stubs.
- 12 handling checks: steering-rate cap in both directions, valid/invalid braking attempts, heat-dependent stopping distance, downhill speed control, complete S-turn with both bodies clearing cones, reverse docking from an offset/angled start, rejection of invalid docking, trailer-only cone contact, no stationary-start false passes, smooth course geometry, and local asset completeness.
- 5 handling UI/lifecycle checks: real scene initialization with a stub renderer, all four scenario selectors, start/throttle/pause/resume/retry, a keyboard-driven braking attempt reaching its result screen, and reverse/overhead-camera/hitch behavior.

Total: **44 passing CPU/DOM-stub checks**. These are not 44 browser playtests.

## Model measurements

- Controlled braking exercise: approximately 20.02 mph entry speed; 8.52 m stop distance from the front-bumper line crossing.
- Separate exact-20-mph stopping comparison: 8.49 m with cool brakes versus 18.21 m with fully heated brakes.
- A controller completed the reverse exercise from the offset/angled start in about 24.6 seconds without cone contact.
- All four controller-driven exercises retained five logs and passed the hitch-position tolerance of less than 1e-9 metres.

These are measurements of this simplified model, not measured behavior of the uploaded Hard Truck game or a real truck. The automated driving controllers are only test fixtures and are not exposed as player assistance.

## Browser observation

The local development menu, original descent-to-lab navigation, controls legend, four test cards, and unsupported-WebGL error presentation were inspected in cloud Chrome. Console errors report GL_VENDOR=Disabled and GL_RENDERER=Disabled. No WebGL context could be created.

GPU rendering, shader compilation, real input feel, device frame rate, and touch play remain unverified. The menu screenshot was inspected internally and is not a rendered gameplay proof.

## Delivery scope

A separate downloadable handling build and source branch. No production deployment, wallet/payment change, TREE transaction, backend modification, or third-party game asset redistribution.
