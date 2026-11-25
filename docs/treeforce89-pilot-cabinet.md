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

## Approved forest finish and desktop sizing — November 25

The real HTML leaderboard now carries the approved forest-and-gold direction: original decorative forest backdrop, TREE FORCE ’89 masthead, gold title and framing, brighter champion row, silver/bronze podium rows, and emerald crests. Names, scores, badges and rank order remain real server-backed content; no mockup text is baked into the artwork. Local screenshots use fixture entries only.

The forest background is encoded as WebP (204,934 bytes), and the original badge atlas is retained while its delivery version is WebP (395,134 bytes). Together these are 600,068 bytes, down from the original 2,422,202-byte badge PNG alone. Resolution is preserved (forest 1536×1024; medals 1254×1254). The prepare script emits an explicit hash/size manifest; only those paths belong in the future release, not stale files from older local preparations.

The desktop-only stylesheet removes the old 530px cap and reduces framing overhead at widths of 1000px and above. It keeps the original 2:3 playfield and 480×720 internal canvas. At 1280×720, 1440×900, 1920×1080 and 2560×1440, measured canvas widths increased 12%, 9%, 20% and 63% respectively. The title/gateway canvas remained fully within the viewport. The 390×844 phone comparison was byte-for-byte equal in the measured geometry. Desktop screenshots are actual rendered app screenshots, not concept images. The existing authenticated gameplay/wallet fixture also passed all ten regressions at 1440px, without page errors.

Files: `styles/treeforce-desktop.css`, `tests/treeforce-desktop-browser.cjs`. Evidence: `desktop-checks.json`, `desktop-1440.png`, `desktop-1920.png`, `wallet-regressions-desktop.json`, and `overlay-manifest.json` alongside the cabinet evidence. Physical monitors/phones and slow-network timing are not measured by these browser checks.

Release status: local implementation and explicit frontend overlay prepared; no production deployment has been made. Next release operation must capture and compare the current live baseline and merge only the manifest-listed changes through the existing full-inventory preservation workflow. The historical deploy ID recorded above is not permission to overwrite newer Arcade/multichain work.

## Final branding and fresh release baseline

Added the existing official Tree Hero / Tree Force ’89 logo in the leaderboard header and a canonical Arcade address link in its footer. Existing receipt-based saved-run sharing is untouched. The logo is reused from production, so it is not a new upload.

Read-only audit run 45702450542 captured current locked deploy `6b07390bd4c3075b43e2c541`: **804 static paths, 62 full backend records, five schedules**. The additional `grove-chess` backend was independently confirmed through the Netlify connector before changing the old exact-count guard. The first read-only audit stopped at that guard; it made no deployment. The fresh baseline retains the current Profile Studio release and all other Arcade work.

Frozen release payload: `production/treeforce-pilot-r19`. Fourteen payload files change only the main Tree Force HTML and add thirteen paths, producing 817 total paths. All five deployed r18 source module hashes match the source used for the visual patch. The HTML patch is applied to the newly captured current entry, preserving its other bytes. All 38 release/backend preservation guards pass. Workflow `.github/workflows/treeforce-pilot-cabinet.yml` rechecks the current inventory before creating a deploy, blocks backend uploads and unknown paths, checks exact served bytes and browser rendering before publication, waits for queued builds, and verifies the complete inventory afterward.
