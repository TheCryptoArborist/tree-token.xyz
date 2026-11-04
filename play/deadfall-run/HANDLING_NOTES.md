# Handling reference and implementation notes

## Reference inspected

User-provided hard-truck-18-wheels-of-steel.exe, SHA-256:
227b8999fd9d7aecfd9df54891eb39cad98777fe974c65874d566f14a42abc9e

Static inspection found a 7-Zip self-extracting archive, an ISO, an installer cabinet, compiled Prism3D binaries, and base.zipfs/data.zipfs asset archives. The main asset archive contains seven truck variants, sixteen trailer variants, editable definitions and UI/scene scripts. No engine source/build project was found. The installer and included DLL were not executed.

The truck definitions separate steering rate, steering limit, acceleration-related settings, brake settings, gearing, and weight. One variant declares a 20 degree/second steering rate. That separation informed the lab tune and tests. The steering-rate concept is implemented in our own controller; no source or assets were transplanted from the archive. Gear ratios and weight values are not sufficient to reproduce the proprietary engine's calculations, so we do not claim the lab simulates Hard Truck or reproduces its driving feel.

## Design choices

- Keep the working 0.4.1 articulated hitch and original procedural rig.
- Add an isolated 900 m proving ground, with a flat braking/reversing yard, smooth grade transitions and 7% slope, and a wide S bend with three narrower gates.
- Introduce a separate loaded tuning preset. Existing descent presets keep their values.
- Start braking measurement at the visible front bumper crossing the line.
- Count cone contacts on either body; scoring cones do not apply forces.
- Require every trailer corner inside the reversing bay, a centered/straight trailer, aligned tractor, near-zero speed, and a two-second service-brake hold.
- Show measurable results and identical retry setups; no persistence or economy.
- Keep classic local scripts so the extracted download can open without a server.

## Next decision after desktop playtesting

Evaluate whether steering corrections, trailer response, and camera framing feel right. If full suspension, rollovers, and force-based collisions are required, compare a separate rigid-body implementation against these same tests before replacing the working vehicle model. No physics-engine migration is included in 0.5.0.
