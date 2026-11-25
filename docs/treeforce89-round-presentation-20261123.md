# Task 7: pacing, transitions and reward explanation

Local review on `dev/treeforce89-feedback-20261123`, following task 6 commit `9fb9c2b`. The user approved the prior visual previews and task 5 music direction. Nothing published; no wallet/SDK/backend changes, real payment, pricing/access changes or tournament activation.

## Already present

The integrated game already has a visual mobile tutorial, slower first-wave entry, bonus instructions with READY/GO, clear/result cards, challenge accuracy, and Windfall reward banners. These were preserved. First-wave enemy timing and all challenge/Windfall combat schedules remain unchanged. No new reward or score rule is introduced.

## Focused changes

- First wave-clear card remains 2400ms; later non-final clear cards use 1800ms. Final victory remains 3600ms.
- The first introduction of each bonus kind remains 4100ms. Repeats within the same mounted game use 2200ms by shortening the title portion only: READY remains 650ms and GO remains 450ms. Challenge and Windfall familiarity are tracked separately; recreating the game resets familiarity. Pause still freezes introduction progression.
- Wave-clear cards show points gained since this wave entry, labeled “POINTS THIS ATTEMPT.” A paid continue re-enters the same wave while retaining its existing score; the label avoids implying that earlier-attempt points were discarded or earned again. This is a read-only score difference.
- Challenge results list target points already earned separately from the completion bonus. For 40 targets, the card now shows +4,000 earned and +10,000 completion bonus; an imperfect result shows its earned target points and +0 completion bonus. The panel grows slightly to fit the extra line. Reward arithmetic is unchanged.

`round-presentation.mjs` handles only presentation timing and text. The r12 overlay preserves previous modules and their fixes. The original award functions, target scoring, individual-run score, three lives, paid continue, thirteen achievements and wallet leaderboard/receipt workflows are unchanged.

## Verification

Actual scene-method/browser checks passed at 320, 390 and 1000px:

- First/repeat phase boundaries for both bonus types, paused intro behavior, and clear-card timer values.
- A perfect result stays at 14,000 total after a repeated finish call; an imperfect 39-target result stays at 3,900. The new text accurately distinguishes earned and newly awarded points.
- Wave-attempt attribution displays +1,234 without changing the synthetic 6,234 run score.
- Result text remains inside its panel at all three viewport sizes. Small-phone result screenshots inspected.
- Ten existing mocked-wallet browser regressions passed, including expiry recovery, wallet switching, fresh score/lives, save retry and receipt sharing. No page errors.

Evidence: `treeforce89-round-presentation-checks.json`, `treeforce89-round-wallet-browser-390.json`, and the `treeforce89-challenge-r12-*` / `treeforce89-wave-clear-r12-*` PNGs. These are forced unranked states, not a complete campaign or a real payment test.

Remaining device review: whether repeat introductions and result cards allow comfortable reading during real phone play. Task 8 covers integrated real-device testing and remaining wallet/audio interruptions.

## Local review

```sh
node scripts/treeforce-local/prepare-round-presentation.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-round-presentation
node scripts/treeforce-local/serve.mjs release/treeforce-round-presentation 4186
node tests/treeforce-local/round-presentation-browser.cjs
```

Practice: `http://127.0.0.1:4186/__local/practice?lab=1&revision=r12&scene=title` (local, unranked, no payments or saves). This frontend overlay is not a complete production release package. Preserve all current backend functions and schedules in any separately authorized release.
