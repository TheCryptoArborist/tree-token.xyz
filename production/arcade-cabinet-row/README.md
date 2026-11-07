# Canopy Breaker cabinet row

Adds a second row of four standalone-game cabinets: Canopy Breaker, then three noninteractive Coming Soon cabinets. The original four standalone games and Garden Battles remain intact.

The Canopy Breaker cabinet links to `/play/canopy-breaker/preview/`, a static artwork and access-requirements page. It does not publish or unlock gameplay. The page states NFTree access, three lives, and a 20,000 TREE restart after all three lives are lost.

## Source and release boundary

These four public overlay files are based on the exact currently published lobby, deployment `6aee6e292c39ae987fa35641`, whose `/play/index.html` SHA1 is `166ca5928f1d7896e5c52ef723b593286c3c431e`. The historical main-branch lobby differs from production; do not run a normal root build to deploy this row. Apply the overlay paths to a complete current deployment inventory while reusing all existing static files, complete function records, runtime settings and five schedules. No environment variable, function package, payment verification or access implementation belongs to this UI change.

Artwork is rendered with the approved Canopy Breaker background, illustrated block and power-up renderer. It is a static game-art preview, not an executable game bundle.

## Validation

- Removing the inserted row and stylesheet link reproduces the exact baseline lobby.
- Four cards in the new row: Canopy Breaker first, three Coming Soon.
- Reserved cabinets contain no links or play controls.
- Existing scripts and links are preserved.
- Uses the lobby's existing responsive four/two/one-column grid.
- Cabinet link opens the preview under `/play/`; its back link returns to the lobby.
- Desktop visual review completed; final hosting preservation and responsive review recorded separately.
