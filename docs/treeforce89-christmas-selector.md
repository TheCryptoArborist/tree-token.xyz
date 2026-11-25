# Local Christmas selector and calendar

Normal / Christmas selection now appears above the game. It is editable on the title screen and locked during play. Normal is the default. New Game retains the selected preference when the game instance is recreated in the same mount; the previous selector is removed on destruction.

Owner-requested opening date: November 27, 2026 at midnight America/Chicago through December 31, ending January 1, 2027 at 00:00 Central (06:00 UTC). Normal remains available year-round. This is cosmetic client-time gating, not authoritative reward/access eligibility. No reward or access rule depends on it. Production activation has not occurred.

The run theme is captured at scene creation, so reaching the cutoff does not strip an active run's visuals or music. Same-instance resume retains that theme. Same-mount reconstruction with resume data also carries the captured theme; a full browser reload or replacement mount does not persist it. Real paid-continue reconstruction still needs integration verification before release, with no real payment required for that verification.

The approved holiday music remains unchanged. It now follows the active run's theme instead of a query parameter. A `theme=christmas` URL alone no longer enables Christmas mode.

The local practice page explicitly simulates December 15 and starts on the title screen. Its preview clock is accepted only on localhost/127.0.0.1 at `/__local/christmas.html`. This local override is not an event activation mechanism.

## Review

![Phone selector](treeforce89-christmas-selector/selector-390.png)

Local server: port 4197, `/__local/christmas.html?lab=1&revision=r15`.

Source: `treeforce89/frontend/game/holiday-mode.mjs`; incremental assembly: `scripts/treeforce-local/prepare-christmas.mjs`. Generated experiment: `release/treeforce-christmas-selector` (not a production package).

## Checks

Unit checks cover opening/closing milliseconds, invalid clocks, Central-time conversion, same-instance resume across cutoff and expiration for a new run. Browser checks cover selection, run locking, restoration of Normal, cutoff UI and selector cleanup on game recreation at 390 and 1000 pixels. Evidence is in the adjacent `treeforce89-christmas-selector/checks.json`.

No deployment, payment, backend, badge, scoring or access change. Next: combined holiday regression and integration review, including reconstruction/continue and phone layout before preparing any hosted candidate.

The pre-season notice reads “Christmas mode unlocks November 27 · midnight Central.” It stays outside the canvas alongside the selector, on the title screen before opening. The closed-season notice describes the season as ended rather than promising a past unlock. Browser checks include the millisecond before opening, opening itself, notice/canvas separation and no horizontal page overflow.

## Automatic countdowns

Before November 27 at midnight Central, the notice includes days/hours/minutes/seconds until opening. At opening, the same wall-clock policy enables the Christmas option without a click or reload and switches to “Christmas mode is available for…” with a countdown to January 1 at midnight Central. At the closing boundary, the timer disappears and new runs return to Normal availability; active runs retain their theme.

The display rounds remaining seconds up, never shows a negative duration, and uses the existing game update loop rather than adding another interval. Focus/visibility return also refreshes it from wall time. Timer digits use tabular spacing and do not announce every second to screen readers; the status message announces the season transition. Time is still the device clock for this cosmetic-only mode, not a server-authoritative eligibility gate.

Browser verification crosses the opening boundary using an advancing clock and no refresh, checks that the timer changes to the closing countdown, then verifies the January cutoff. The preview remains local; no Netlify deployment was performed.

Combined regression correction: the selector/countdown panel is hidden during active gameplay and returns on the title screen. This preserves the existing combat viewport and touch coordinates on phones. Availability still updates while playing, and the run theme remains fixed.
