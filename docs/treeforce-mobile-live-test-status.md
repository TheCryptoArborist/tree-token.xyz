# Tree Force ’89 mobile test: preserve the live integration

Prepared November 9, 2026. Not published on the production domain.

The live entry module is `index-C7sLq93z.js`; gameplay is `arcade-CdwOWItr.js`.
Unlike the earlier feature branch, this live version already uses
`/play/treeforce89/api/tree-challenge`, `tree-session`, `tree-run` and `tree-logout`.
Retain these existing routes and all original backend packages.

`scripts/prepare-treeforce-mobile-live-test.mjs` retrieves the pinned public
assets if needed, checks source SHA256 fingerprints, and produces a derived
static test copy. It refuses unexpected entry or gameplay source drift.
The output preserves authentication endpoint strings and requires zero new
functions. Only files beneath `/play/treeforce89/test/` belong in a release.
Do not deploy the development harness or `preparation.json`.

Changes: mobile viewport sizing from PR #112; touch Pause/Resume overlay;
first-play tutorial; Auto Fire enabled on touch; taller action buttons;
prevent dragging while paused; disabled test checkout and score submission;
separate pending-payment and pilot-name browser-storage keys.

## Observed checks

An unpublished offline gameplay harness at a 390-pixel canvas width confirmed:
- tutorial opens and Start Mission resumes;
- automatic shooting and Auto Fire toggling;
- manual Fire increments shots;
- a charged Shield activates and consumes its charge;
- touch Pause/Resume works;
- a fresh run starts after a simulated loss;
- loss and victory scenes render after forced state transitions.

The harness used the live-derived game, with touch capability forced only in
its own QA copy. It did not authenticate an NFTree holder, perform payments,
submit scores, or complete a natural ten-wave run. It did not establish full
390px mobile-browser viewport compatibility. Browser DevTools emulation was
unavailable. Tutorial text overlap and paused dragging found during inspection
were subsequently corrected in the prepared patch; those final adjustments
still need a visual retest.

## Publication gate

Production was last confirmed locked to `6af1c0e464d4cdc85c4e9c34` with 46
functions and five scheduled jobs. Automatic approval review rejected creating
a non-draft production-context candidate, including the static-only attempt,
because it might affect the live service before post-creation verification.
No production publication was performed.

Before any publication, obtain a fresh baseline, preserve every existing
static SHA and all 46 function records/configurations and five schedules,
and reject backend upload requests or concurrent baseline drift. Complete
real mobile and NFTree sign-in checks on the requested production-domain test
path before distributing its URL. Do not use a standard repository build as a
substitute for the protected live snapshot.
