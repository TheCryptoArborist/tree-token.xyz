# TREE FORCE pickup and hazard readability

The feedback is reproducible in the tracked 0.6.0 renderer: all three hostile projectiles use circular silhouettes, including an orange coin-like drill and a green/yellow spore. Growth seeds and the circular VICTORY/BOOM pickup logos share those cues. The gameplay roles differ, but their visual categories were ambiguous.

## Original files inspected

The original TREE FORCE renderer and the supplied Deluxe Galaga manual were inspected. The manual's mission section describes falling bonuses and weapon upgrades; its Meteor Storm section describes rocks and collectible containers. It does not specify the exact sprite drawing or collision implementation. The disk contains a compiled Amiga HUNK executable, not editable source. No Galaga assets or executable code are copied into TREE FORCE.

The newly supplied `Deluxe_Galaga_v2.6-AGA-.exe` is a Windows RAR self-extracting package (SHA256 `ac2f5f5ce1639d9b576da2bf5a61e19915ac3dbca41a1e058d09e2e9807b16ce`). It was inspected as an archive; neither the installer nor its bundled programs were run. Eight entries contain a 901,120-byte ADF, WinUAE, a Kickstart ROM, emulator settings, a launcher, a 194-byte controls readme, and two directories. The ADF is byte-for-byte identical to the earlier ZIP's disk: SHA256 `0228ede23cff2daece3ed21905db6dd69f52a114f4c51888d4b267303dad4606`. No additional editable source, separate sprite sheets, or gameplay documentation are present. The wrapper makes a Windows emulator setup available but adds no evidence about exact projectile rendering.

## Changes

- All three hostile shots now have pointed, red silhouettes with bright internal markings, aligned to their actual direction of movement. No hostile projectile uses a green/gold coin outline.
- Growth seeds, violet weapon cores and bonus seeds use upright mint-framed square capsules with white + corner marks. Leaf/core/gold interiors identify their rewards.
- VICTORY and BOOM keep the existing ecosystem logos inside the same square/+ pickup frame. Their frames follow and clean up with their sprites.
- A persistent collect/avoid key sits below the game, outside the HUD/playfield. The field guide shows the actual collectible and hostile textures side by side. It pauses gameplay while open.
- The review fixture adds a guide button, a sample drop practice control and item collision checks using the actual engine.

Existing damage and reward rules, projectile velocities and collision sizes are preserved. Growth/core bodies are explicitly kept at 15×19 and 19×19 despite their larger artwork. Hostile bodies remain 8×8, 9×9 and 10×10; VICTORY/BOOM keep their original scaled circle bodies. Random draws for pickup spin are retained to avoid changing seeded drop/attack sequences, while the displayed pickup frames stay upright. No wallet, payment, contract, dependency or backend changes are included.

## Validation

The complete isolated Deploy Preview build and all 36 focused local tests pass. Ready hosted preview `6aea8a95c513a5126ba85790` was built from source `b40426c9642cccccb4cf879870b632b0e8dbf88d`. Twelve browser item assertions pass: growth/core collision dimensions and contact rewards; VICTORY/BOOM collision radii, effects and frame cleanup; all three hostile hitboxes; and enemy dart contact removing a life. Existing engine integration assertions also pass, including the bonus return to wave five. The new item guide, close/resume action, sample drops, upright frames, directed red projectiles and separate legend row were visually reviewed at about 60fps. Production has not been changed. The current MystenLabs README was checked live; this visual/gameplay task requires no Sui SDK or Move implementation changes.
