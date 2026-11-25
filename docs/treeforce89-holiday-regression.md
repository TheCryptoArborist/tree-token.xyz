# Combined holiday regression

Local candidate: `release/treeforce-christmas-selector`, port 4197. No payment, push, build service or deployment was used.

## Reproduced issue and fix

The selector above the canvas reduced the usable phone combat viewport and broke a drag/fire boundary check. It now hides during active gameplay and returns on the title screen. Countdown/availability continues to update; the selected run's theme remains fixed. This keeps the established combat viewport and touch coordinates unchanged. The countdown is a title-screen notice, not an overlay on combat.

## Passing verification

- Nine unit checks: holiday opening/closing, countdown formatting, same-instance resume across cutoff, seasonal orchestration and original score behavior.
- Controls/continue suite at 320, 390 and 1280 pixels: hero visibility at all five growth stages, touch release, keyboard/touch controls, and synthetic authorized-resume reconstruction. A Christmas run reconstructed on the same mount after the January cutoff retains its theme, 43,210 score, wave 4, run identity, seed and achievement progress, with three restored lives. A subsequent individual run has zero score, wave zero, three lives and Normal presentation after cutoff. One selector remains after reconstruction.
- Thirteen holiday audio lifecycle scenarios: start gesture, encounter transitions, zero-volume silence with SFX available, volume restoration, Pause/Resume, blur/focus, hidden/visible return, master mute, context recovery and destruction/recreation.
- Ten integrated app checks at 390 pixels, with simulated wallet/API responses: single mount, lazy GraphQL, fresh-run state, temporary disconnect, expiry recovery, save retry, receipt handoff/share proportions, explicit disconnect and separate second-wallet identity/profile. This app suite used default Normal presentation; seasonal selection/reconstruction is covered separately above.
- Selector browser checks at 390/1000: automatic opening with an advancing clock, switch to closing countdown, title selection, run locking, new-game recreation, return to Normal and January cutoff.

Evidence: `treeforce89-holiday-regression/` and `treeforce89-christmas-selector/checks.json`. All reported browser errors were empty on the final runs. `git diff --check` passed.

Two initial harness errors were resolved without changing game rules: the wallet suite needed `TREEFORCE_REVISION=r15` to avoid importing the historical r5 entry; synthetic seasonal injection must skip home-only instances that deliberately have no holiday selector. The controls test now simulates a cutoff before reconstruction rather than only testing a mid-season continue.

## Remaining release work

This is synthetic local validation, not real Slush/payment certification or a physical-phone holiday performance review. Full browser reload/replacement of the mount does not persist cosmetic theme state. The current integration and separate multichain branch must be reconciled before release, including their actual authorized-continue reconstruction contract. Prepare a reproducible versioned overlay and capture fresh complete site/backend inventory before any separately authorized hosted publication. Reuse the canonical domain for eventual phone review and batch deployment to avoid repeated Netlify usage.
