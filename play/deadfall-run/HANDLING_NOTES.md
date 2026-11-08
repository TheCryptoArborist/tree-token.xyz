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

## Controller implementation — 0.5.2

Controller polling uses the current navigator.getGamepads() snapshot once per animation frame before reading driving input. Null device slots are ignored. The active device is matched by index plus identity and layout; replacing a device at the same index cannot inherit held buttons. Start, Select, and menu movement use rising edges. Driving actions are held states merged with keyboard/touch input, with service-brake priority. A neutral gate follows start/pause/focus/setup/reconnect transitions.

The standard layout uses W3C button positions 0/1 for the default throttle/brake pair, 8/9 for Select/Start, and 12–15 for the D-pad. Printed Nintendo-style A/B labels can differ, so the calibration wizard assigns the actual buttons the player presses. Nonstandard controllers receive no guessed bindings. Setup samples a centered baseline, captures eight distinct controls, requires release between prompts, and handles button, X/Y-axis, and evenly spaced POV-axis layouts. Profiles are validated against device button/axis counts and saved under a Deadfall-specific local-storage key. Missing or blocked APIs and storage do not prevent keyboard play.

API references checked: the W3C Gamepad specification (sections 12, 14, and 15) and MDN's Using the Gamepad API guide. No Sui SDK, wallet, backend, or payment code is involved. The current MystenLabs/skills README was checked; none of its Sui skills applies to this controller change.

## Reverse control correction — 0.5.7

The engagement check used absolute speed. After reverse was released for 0.1 seconds at -1.87 m/s, a renewed request left reverse=false and the rig slowed to -1.66 m/s over the next second instead of accelerating. The gate now rejects forward travel at or above 0.25 m/s, allowing power to resume during backward motion; service braking clears reverse drive.

The loaded preset's 1.1 m/s² reverse thrust was also below the combined 7% downhill gravity (0.6867 m/s²), base rolling resistance (0.12) and grass resistance (0.55). It could remain at zero speed while reverse was active. Reverse thrust is now 1.8 m/s², with the same 2 m/s speed cap. This is game tuning, not a measured truck powertrain.

The control hint reads the requested reverse control before brake priority suppresses it, so a held service brake, engine brake or forward motion has an explanation. Keyboard V, NES D-pad Down and touch reverse retain their held-control semantics. The R key still retries/recovers. No coupling, road, scoring, collision or controller-mapping changes are included.
