# What came from Arkannoyed

The uploaded ZIP contains Arkannoyed.exe, Arkannoyed.gam, its readme and five
legacy runtime DLLs. The original is by Lee David Ash (2002), built with The
Games Factory. The `.gam` has the **unprotected GAPP** header and format version
0x0207. It is a legacy editable project, not JavaScript. No Windows executable
or DLL was run.

Its container has 34 frames. Three opening frames and frame 32's ending are
excluded; gameplay frames 3–31 plus the additional gameplay frame 33 supply
30 layouts. This is archive order for the new campaign; it is not a verified
reconstruction of every original event-driven frame transition. The final
Hollow Harvester encounter and five forest assignments are new design choices.

The bounded placement-table reader extracts 1,540 concrete brick instances from
object definitions 14–20 (Active object 12 through Active object 18). Positions
are scaled consistently to the browser field. Original object and event blocks
were inspected; their counts, frame numbers and event payload hashes are
recorded alongside the game-data SHA256 in source-inspection.json. No legacy
sprite artwork, blood/clown imagery or runtime binaries are redistributed.

The original readme and in-project object names document eight pickup roles:
Extend, Follow, Hotball, Laser, Multiball, Fastball, Slowdown and Whacked. These
became Branch Reach, Root Tether, Wildfire Seed, Thorn Volley, Seedburst, Gale
Force, Root Snare and Wild Wind. Multiball retains the primary-ball life rule.
New timers, difficulty tuning, collision/aim physics, hazard spawning, sound,
pause, responsive controls, boss behavior and scoring are new implementations.
The original readme explicitly says that game had no sound or pause.

The original event bytecode has not been automatically translated or certified
behavior-identical. This release reuses actual source placement data and the
documented mechanics while replacing the runtime with inspectable browser code.

Format verification used the primary-source reader in
https://github.com/just-addwater/KlikBack at inspection time. Its parser was used
only for independent format checks; none of its code is bundled in this game.
The in-repository extraction script is a small independent bounded reader.
