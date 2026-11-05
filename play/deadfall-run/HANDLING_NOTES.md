# Handling reference and implementation notes

## Reference inspected

User-provided hard-truck-18-wheels-of-steel.exe, SHA-256:
227b8999fd9d7aecfd9df54891eb39cad98777fe974c65874d566f14a42abc9e

Static inspection found a 7-Zip self-extracting archive, an ISO, an installer cabinet, compiled Prism3D binaries, and base.zipfs/data.zipfs asset archives. The main asset archive contains seven truck variants, sixteen trailer variants, editable definitions and UI/scene scripts. No engine source/build project was found. The installer and included DLL were not executed.

The truck definitions separate steering rate, steering limit, acceleration-related settings, brake settings, gearing, and weight. One variant declares a 20 degree/second steering rate. That separation informed the lab tune and tests. The steering-rate concept is implemented in our own controller; no source or assets were transplanted from the archive. Gear ratios and weight values are not sufficient to reproduce the proprietary engine's calculations, so we do not claim the lab simulates Hard Truck or reproduces its driving feel.

## Design choices

- Keep the exact transformed fifth-wheel/kingpin connection and original procedural rig; revise axle tracking in 0.5.1.
- Add an isolated 900 m proving ground, with a flat braking/reversing yard, smooth grade transitions and 7% slope, and a wide S bend with three narrower gates.
- Introduce a separate loaded tuning preset. Existing descent presets keep their values.
- Start braking measurement at the visible front bumper crossing the line.
- Count cone contacts on either body; scoring cones do not apply forces.
- Require every trailer corner inside the reversing bay, a centered/straight trailer, aligned tractor, near-zero speed, and a two-second service-brake hold.
- Show measurable results and identical retry setups; no persistence or economy.
- Keep classic local scripts so the extracted download can open without a server.

## Trailer tracking correction — 0.5.1

The old solver aimed the trailer from its previous world-space axle toward the current hitch. Roll moves the elevated kingpin sideways relative to the axle, so this recomputed heading treated a static lean as new steering on every call. A stationary rig with 0.035 radians of tractor roll acquired about 15.43 degrees of trailer yaw after 120 coupling calls. That feedback also drove the rear sideways during gentle turns.

The replacement uses signed hitch displacement and the change in lateral pin offset. With forward vector f, right vector n, horizontal kingpin-to-axle reach L, lateral pin offset b, and hitch travel dH, the midpoint no-slip constraint is:

    deltaYaw = 2 * atan2(dot(dH, n) + bPrevious - bCurrent,
                        dot(dH, f) + LPrevious + LCurrent)

This follows from projecting actual axle displacement onto the sideways axis at the midpoint heading and setting it to zero. A constant bank contributes no accumulated yaw. Reverse travel retains its sign. Pitch is solved against ground height at the trailer axle; the kingpin remains exactly coincident with the transformed tractor hitch, including body lean.

The tractor now moves its rear tandem midpoint (local z = 1.55 m) along its heading before reconstructing the cab origin. Previously, translating the cab origin directly also forced the non-steering rear wheels sideways during yaw. Existing steering response, limits, acceleration, and brake values are retained. This remains an arcade steering tune, not a calibrated real-truck steering or tire model.

The six new regression checks inspect actual rendered axle transforms, including left/right symmetry on a 7% grade, forward/reverse no-slip tracking, stationary and repeated-update invariance, and circular offtracking against an independent geometric calculation. The reverse-docking test fixture now corrects its lateral offset earlier; the scenario, cone positions, and pass criteria are unchanged.

## Next decision after desktop playtesting

Evaluate whether steering corrections, trailer response, and camera framing feel right. If full suspension, rollovers, and force-based collisions are required, compare a separate rigid-body implementation against these same tests before replacing the working vehicle model. No physics-engine migration is included in 0.5.1.
