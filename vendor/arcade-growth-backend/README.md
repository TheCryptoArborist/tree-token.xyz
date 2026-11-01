# Daily Growth participation backend dependencies

This isolated dependency snapshot comes from TREE FORCE integration commit
`4cd2119a3fefc3b6078befd01ad4f63fb74a695a` in `TheCryptoArborist/tree-token.xyz`.
It adds the already-pinned database dependency (`@netlify/database` 2.0.1,
including `pg` 8.23.1) to the Daily Growth build environment.

All 597 dependency entries in the Arcade root lock are unchanged. The root
`package.json` and lock remain byte-identical. The reporting handler imports
only the pinned PostgreSQL driver for bounded, parameterized, read-only game
session lookups. Game state and payment tables are never written here.

Install this snapshot into an isolated directory with `npm ci --ignore-scripts`.
The participation packager verifies the installed versions and records both
this snapshot and the original root locks as build inputs.
