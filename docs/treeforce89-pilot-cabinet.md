# Tree Force ’89: illustrated achievement cabinet and top ten pilots

Local review branch `dev/treeforce-pilot-cabinet`, based on festive emoji source `ade51f37`. Not published. The source baseline is the verified r18 main-game payload in `production/treeforce-main-r18`, with the latest shared festive text from `production/treeforce-festive-emojis`. The last recorded published baseline is `6b06687527d719b675652622`; a fresh inventory is required before any release because other Arcade work may publish concurrently.

The existing board already received server-ranked entries and advertised up to 50 pilots. This change displays the first ten in the existing server order. First place has the largest gold treatment and Canopy Champion title, second silver, third bronze. Numeric ranks remain visible and accessible. Best-score-per-wallet behavior is unchanged.

The cabinet's previous pixel artwork was supplied by `retro-achievements.css` over the older text-symbol markup. The new stylesheet replaces that presentation with thirteen original illustrated forest medals: emerald leaves, wood, gold rims and purple gems. The 1254 × 1254 PNG atlas contains roughly 313 pixels per medal cell, displayed at 96–104 CSS pixels, providing approximately 3× display resolution. It is one reusable 2.4 MiB asset; original generated art is retained. Locked medals remain recognizable, earned medals use full color, and earned versus unlocked-but-unsaved status text is preserved. No new achievement or seasonal eligibility rules were introduced.

## Visual review

[Achievement cabinet artwork](treeforce89-pilot-cabinet/achievement-art-preview.png) · [Phone leaderboard](treeforce89-pilot-cabinet/leaderboard-390.png) · [Phone earned badges](treeforce89-pilot-cabinet/badges-earned-390.png)

Screenshots contain synthetic pilots and achievement states, not real leaderboard records or account awards.

## Verification

- Chromium at 320, 390 and 1000 CSS pixels, 2× rendering: twelve supplied entries render exactly ten, long names wrap, markup-like names render as literal text, all thirteen medals load, no horizontal overflow, empty/error states work, and saved/newly unlocked badges retain their proper labels. No page errors.
- Existing ten wallet/session/save/sharing checks pass at 390px, including expiry recovery, explicit disconnect, wallet switching, failed-save retry, receipt handoff and one application mount after lazy GraphQL loading.
- Byte comparison confirms achievement definitions, save handlers, wallet/payment/application logic and all code outside the pilot component JSX are unchanged. Engine, GraphQL, holiday and sound modules differ only in versioned dependency references.
- JavaScript syntax check passed. No payment, production write, backend rebuild, dependency upgrade or Netlify deploy occurred.

Evidence: `treeforce89-pilot-cabinet/browser-checks.json`, `wallet-regressions.json`, `source-preservation.json`.

## Reproduce / release boundary

Run `node scripts/treeforce-local/prepare-pilot-cabinet.mjs [output-directory]` from the repository root. It applies unique asserted replacements to the captured r18 entry and emits a presentation overlay, stylesheet and atlas. The emitted module graph uses r19 references to avoid duplicate entry-module mounts. Existing game assets and shared services are reused.

The local assembled preview is `/workspace/treeforce-pilot-preview`, served on port 4205 using `scripts/treeforce-local/serve.mjs`. The browser checks run with `node tests/treeforce-pilot-cabinet-browser.cjs` and only localhost, synthetic API/profile responses and blocked external writes. The existing wallet suite ran with `TREEFORCE_URL=http://127.0.0.1:4205 TREEFORCE_REVISION=r19` in an isolated evidence directory.

The overlay is **not a complete deploy package**. A later bounded release must capture the fresh live inventory, preserve every other static path and the complete current backend/provider/runtime/schedule inventory, and use the established preservation release workflow. No whole-site build is needed. Physical-phone visual readability and loading on a slow mobile connection remain untested; browser viewport checks are not physical-phone testing.

## Competitive rank artwork refinement

Replaced plain rank circles with original scalable SVG insignia: a gold trophy for first, ribboned silver and bronze medals for second and third, and emerald leaf shield crests for fourth through tenth. The numeric rank remains real readable text, separate from decorative background art. First place retains the largest icon and strongest row treatment. Four reusable assets total less than 6 KB; no extra JavaScript or animation loop is required.

The three-width browser check now verifies all four assets load, the correct artwork is assigned to each rank, and numbers 1–10 remain present. All existing local cabinet states still pass with no page errors. The final 320px header adjustment was checked separately for overflow and screenshot readability. This refinement changes only CSS, static artwork and overlay assembly; no wallet or scoring logic changed. Not deployed.
