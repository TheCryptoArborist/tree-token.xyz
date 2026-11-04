# TREE FORCE pickup and hazard readability

The feedback is reproducible in the tracked 0.6.0 renderer: all three hostile projectiles use circular silhouettes, including an orange coin-like drill and a green/yellow spore. Growth seeds and the circular VICTORY/BOOM pickup logos share those cues. The gameplay roles differ, but their visual categories were ambiguous.

## Original files inspected

The original TREE FORCE renderer and the supplied Deluxe Galaga manual were inspected. The manual's mission section describes falling bonuses and weapon upgrades; its Meteor Storm section describes rocks and collectible containers. It does not specify the exact sprite drawing or collision implementation. The disk contains a compiled Amiga HUNK executable, not editable source. No Galaga assets or executable code are copied into TREE FORCE.

The newly supplied `Deluxe_Galaga_v2.6-AGA-.exe` is a Windows RAR self-extracting package (SHA256 `ac2f5f5ce1639d9b576da2bf5a61e19915ac3dbca41a1e058d09e2e9807b16ce`). It was inspected as an archive; neither the installer nor its bundled programs were run. Eight entries contain a 901,120-byte ADF, WinUAE, a Kickstart ROM, emulator settings, a launcher, a 194-byte controls readme, and two directories. The ADF is byte-for-byte identical to the earlier ZIP's disk: SHA256 `0228ede23cff2daece3ed21905db6dd69f52a114f4c51888d4b267303dad4606`. No additional editable source, separate sprite sheets, or gameplay documentation are present. The wrapper makes a Windows emulator setup available but adds no evidence about exact projectile rendering.

## Changes

- All three hostile shots now have pointed, red silhouettes with bright internal markings, aligned to their actual direction of movement. No hostile projectile uses a green/gold coin outline.
- Growth seeds, violet weapon cores and bonus seeds keep distinct leaf/crystal artwork with a soft green aura and gentle pulse. The square frames and + corner marks were removed following user feedback.
- VICTORY and BOOM keep unobstructed ecosystem logos, sharing the same green glow. Auras follow and clean up with their sprites, including missed drops and bonus seeds.
- A persistent collect/avoid key sits below the game, outside the HUD/playfield. The field guide shows the actual collectible and hostile textures side by side. It pauses gameplay while open.
- The review fixture adds a guide button, a sample drop practice control and item collision checks using the actual engine.

Existing damage and reward rules, projectile velocities and collision sizes are preserved. Growth/core bodies are explicitly kept at 15×19 and 19×19 despite their larger artwork. Hostile bodies remain 8×8, 9×9 and 10×10; VICTORY/BOOM keep their original scaled circle bodies. Random draws for pickup spin are retained to avoid changing seeded drop/attack sequences, while the displayed pickups stay upright. No wallet, payment, contract, dependency or backend changes are included.

## Validation

The complete isolated build and all 36 focused local tests pass. Final hosted preview `6aea915ff4c923218595ce67` uses source `96b239af03df3112087ecdb1f944628374b7b52e`. All twelve browser item checks pass for contact rewards, collision dimensions/radii, VICTORY/BOOM effects, aura cleanup and enemy damage. Existing engine integration checks also pass, including the return from the bonus into wave five. Normal sample drops, the revised field guide, unobstructed logos, pulsing auras and Windfall seed spawning were checked in the foreground browser at about 60fps. The VICTORY/BOOM sprites use additive blending to remove rectangular black logo backgrounds without changing the assets or collision bodies. No enclosing box or corner + remains. Production was not changed.

The current MystenLabs README was checked live. This visual task changes no Sui SDK, Move, signing or payment behavior.

## Glow refinement

The user approved replacing the box/+ markers with a soft green glow and gentle pulse. The guide and permanent legend now teach glowing collectibles versus pointed red shots. Leaf and crystal textures have no enclosing frame or corner badge. Pulse changes only the decorative aura; item position, artwork scale, physics, rewards and drops remain unchanged. Existing pickup collision checks are reused for browser validation.
