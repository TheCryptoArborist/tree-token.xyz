# TREE Arcade integration — build 0.4.1

October 31, 2026. `node tests/run.cjs`: all 27 CPU/DOM-stub checks passed after integration.

The hosted arcade cabinet, canonical game link, local assets, game menu, explicit unsupported-WebGL error, and Back to Arcade navigation were inspected in the cloud Chrome browser. This browser reports `GL_VENDOR = Disabled` and `GL_RENDERER = Disabled`, so GPU rendering and actual driving controls could not be playtested. A full desktop playtest remains required. No FPS claim is made.

Only one cabinet changes relative to the pinned live arcade HTML. All other existing static files, 40 exact backend package/provider/configuration records (including rate limits), and five schedules must match before publication. The release script enforces those comparisons. The older report below describes the recovered game engine tests.

---

# Build 0.4 test report

September 22, 2026. Command: `node tests/run.cjs`.

27 automated checks passed. Tests use the bundled Three.js r160 geometry/matrix implementation, the shipped physics and route code, and a DOM/renderer stub for run controls. No external test packages are needed.

## Covered

- Kingpin/fifth-wheel coincidence across 1,600 changing yaw, pitch and roll poses; error below 0.000001 mm.
- Trailer initially behind the tractor at six positions along the road.
- Stop/hold braking, sustained reverse, reverse engagement restrictions, engine braking, service-brake heat and cooling.
- Steering direction and limits in all three presets; stationary steering does not turn the rig.
- Smooth road heights, plus a terrain/road ray-intersection check at 93 sample positions.
- Identical fixed-step simulation results at 30, 60 and 144 simulated render frames per second.
- Detailed vehicle construction, front steering pivots, ten tractor and eight trailer wheels, and restoration of five visible logs.
- Start button activation, throttle motion, pause/resume, focus-loss pause, three cameras, inspection drag and zoom, recovery, input cancellation, quality selection and diagnostics.
- Finite scene vertex/normal/UV/instance data, upward-facing road surfaces and existing shader includes.
- A simple automated steering controller follows the full route with all three handling presets and all five logs. This is a physics/route test without hazard collisions, not a successful human playthrough.
- Full-rig chase-camera projection at the 1440 × 900 test aspect ratio.
- Failure, Drive Again and fresh-run reset; local script references exist and use no CDN or ES modules.

## Not verified here

The available browser rejected local-file navigation. No browser playtest, screenshot review, GPU shader compilation test, measured frame-rate benchmark or mobile-device test was completed. Simulated render rates in the fixed-step test are NOT measured performance.

Manual testing is still required for appearance, shadows, texture quality, camera feel, keyboard/touch behavior, lower-end performance, route difficulty and approximate collision behavior. Use the README playtest checklist. Geometry checks do not replace visual inspection.
