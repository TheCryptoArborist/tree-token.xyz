# Tree Army hero stride — Prototype 0.8

The hero's two old walk illustrations held the same leg forward. Auto-fire also
selected a stationary attack picture while the hero was moving. The approved
Seedling, Archer and Guardian gaits are unchanged.

The hero now uses six illustrated cutout parts and a continuous two-leg rig.
Each leg spends half a distance-driven cycle planted and half swinging, with the
other leg half a cycle apart. Planted feet move back 40 local pixels per 40 world
pixels; the swing lifts 13 pixels, and two-bone positioning keeps knee articulation
and bone lengths consistent. An 80-pixel stride retains movement speed. A small
body rise and a short movement/idle blend soften transitions. Recoil affects
only the torso; shooting never replaces or resets the legs. Reduced-motion mode
uses the neutral stance without walking/bobbing. Pausing freezes the simulation.

Artwork: image generation referenced the user's original Tree Hero atlas, keeping
the purple/green suit, gold armor/cape, leafy cannon and saw. Three attempted pose
sheets were rejected because they repeated the leading leg. The accepted cutout
source was `exec-1f77b0d6-214f-4d9d-a79e-0b095a769e35.png`. Its six alpha-connected
parts were isolated with a two-pixel edge margin, packed into a 1920×1024 atlas,
and encoded as WebP quality 92. This uses the user's existing approval for local
sprite cleanup. The browser rotates the illustrated thigh and shin and positions
the boot; it does not mirror a whole walking pose to fake the other leg.

Validation: gameplay tests cover all eight movement directions, travel-driven
phase, opposite foot contact, planted-foot cancellation of world travel, constant
bone lengths, idle blending, and identical leg rendering while firing. Browser
checks cover desktop, 390px and 320px phones, and landscape, with eight-direction
keyboard/joystick input, multitouch summoning, release, pause, abilities and missing
rig artwork. Screenshots include eight sampled gait phases and in-game mobile.
These are browser emulations, not a physical-phone playtest.

Release replaces only the current 0.7 gameplay HTML (SHA1
`a91f8af6e4c0b7c1640a498a414d0a56b6aa238c`) and adds
`/play/tree-army/test/assets/tree-hero-rig.webp`. It preserves the complete freshly
captured site, including all 58 backend/provider records and five schedules
inspected from locked live deploy `6b03d785177d7651c28d69aa` (newer than the
countdown record, with generation registration/configuration/binding/reserve). No wallet/backend/dependency
changes. Latest MystenLabs/skills README consulted; this is not a Sui change.
Publication evidence will be recorded after canonical verification.

Atlas SHA256: `0a5d6b63543068a7f1708ec5f08af9adcb100e2998aba7e69fe7f95a60cf0bea`.
