# STI TREE widget review — 2026-09-22 UTC

Decision: reasonable for this external informational card with the reviewed loader pinned by Subresource Integrity (SRI). This is a point-in-time code and browser review, not a guarantee about future iframe content. No production promotion was performed.

## Reviewed code and behavior

- `https://sti.boombots.fun/embed.js`: 2,327 bytes; exact reviewed bytes in `embed.js.txt`. SHA-384 SRI: `sha384-9BaWPHPi50ws2eIyK33Am3ijob9N5GQKNcml/uQdVxkCcfeBG/+Z0LbDMlBmknSY`. The server supplies `Access-Control-Allow-Origin: *`, allowing anonymous CORS/SRI loading.
- Executes an IIFE in the embedding TREE page. Reads `document.currentScript` and its dataset; fallback scans matching script tags. Sets `window.__stiBadges`, `window.__stiBadgeListener`, and `tag.__stiDone`. Creates one lazy iframe immediately before the script, with an accessible title, 100% width, default maximum width 420px, and initial height 240px. It does not fetch APIs, access storage/cookies, invoke wallets, or inject another parent-page script.
- Iframe URL for this integration: `https://sti.boombots.fun/embed/?coin=TREE&id=sti-badge-1`. The inline script builds the card with DOM creation and `textContent`, not untrusted HTML insertion. It sizes text, samples logo pixels in a 32×32 canvas to select an accent color, and sends `{sti:'badge-size', id, height}` to its parent on render/resize/font readiness. There is one initial feed fetch per load, not a polling loop. It renders membership, campaign, or generic index content based on returned data.
- The iframe reads/writes `localStorage['sti-badge']` on STI's origin for its last successful feed. Storage failure is caught. No TREE-origin storage, wallet provider, account request, signing, Sui RPC, or transaction operation was found in any reviewed widget script. Cross-origin isolation prevents direct iframe reads of TREE's DOM/storage. The parent loader itself has normal page-script privileges; its comment claiming isolation applies to the iframe, not the loader.
- The live feed contains TREE's expected coin type, with `retiring:false`. Copy deliberately does not hardcode membership or a basket percentage, because the upstream state can change. The actual product name in the code and rendered card is **Sui Trenches Index**, so the section uses that name instead of the proposed “Sui Token Index.”

## Network destinations and additional code

| Destination | Purpose / conditions |
| --- | --- |
| `sti.boombots.fun/embed.js` | Parent loader, pinned with SRI. |
| `sti.boombots.fun/embed/` | Cross-origin iframe HTML and its inline JavaScript. |
| `sti-keeper-production.up.railway.app/badge` | GET index feed, once per iframe load. |
| `sti-keeper-production.up.railway.app/icon/TREE` | Current TREE logo; anonymous image request. |
| `sti.boombots.fun/icon.svg` | STI logo image. |
| `fonts.googleapis.com` | Google Fonts CSS for Anybody, Instrument Sans, Spline Sans Mono. |
| `fonts.gstatic.com` | Font files referenced by that CSS. |
| `sti-campaigns-production.up.railway.app/campaigns` | Conditional GET if TREE is not a current member; campaign logo from `/icon/<encoded key>`. This branch was statically inspected, not reached by the live member test. |
| `static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495` | **Additional browser-injected module script in the iframe**, absent from the initial curl HTML. Captured and reviewed in `cloudflare-beacon.js.txt`; supplied with its own SHA-512 integrity attribute. |
| `sti.boombots.fun/cdn-cgi/rum?` | Cloudflare analytics POST, observed in Chromium. |
| `a.nel.cloudflare.com/report/v4?...` | Network error reporting endpoint advertised in HTTP NEL/Report-To headers; not observed in this test. |

The Cloudflare beacon collects iframe navigation/performance timings, web vitals, element selectors/geometry for performance attribution, browser engine/version and OS version, JS heap statistics when available, referrer and cleaned iframe URL, a generated page-load ID, and its public site token. It observes visibility, navigation and interaction timing; it does not collect entered text or access a wallet in the reviewed code. It may patch iframe `history.pushState` for SPA measurement, registers performance observers, and provides Array method polyfills. It adds no further scripts. No cookie/localStorage access was found in that beacon. Its generic code supports configured forwarding and `https://cloudflareinsights.com/cdn-cgi/rum` fallback, but the delivered configuration uses the same-origin `/cdn-cgi/rum` route with no forwarding. The observed payload included the preview origin as referrer (the loader's no-referrer attribute does not propagate to its generated iframe). Like all remote resources, these destinations receive ordinary connection metadata such as IP address.

The feed can also specify a string `coin.icon` URL, which the iframe loads as an image without a hostname allowlist. Current TREE data uses the fixed keeper icon endpoint. Thus future image destinations are data-dependent and cannot be permanently enumerated. Clicking the badge opens the fixed STI origin with `?from=TREE`, or a campaign anchor if applicable, in a new tab with `noopener`. The TREE-owned fallback link uses the verified STI homepage with `noopener noreferrer`.

## Residual risks and protection

- The parent message listener verifies `e.origin === 'https://sti.boombots.fun'` and a height greater than 0 and less than 1000. It does **not** validate `e.source` or restrict the supplied ID to its iframe. An STI-origin window with a reference to this page could alter the height of another element with a known ID. This is a bounded layout weakness, not observed wallet/storage access. The original loader remains unmodified to preserve the requested embed.
- The iframe is cross-origin but unsandboxed. Its future HTML, scripts, data and links remain controlled by STI/Cloudflare. SRI pins only the parent loader; it does not pin that iframe. Normal third-party content, analytics, availability and navigation risks remain.
- An upstream loader edit fails closed under SRI. Browser tests confirmed changed code does not execute and the fallback stays available. Review the new code and its dependencies before updating the integrity hash.
- The section labels STI as externally operated, uses no TREE wallet integration, preserves existing market/chart/burn/supply content, and remains within Stats. A fallback link remains available with blocked scripts.

## Preview and checks

Preview: https://6ab205ad636c382b6a3abee1--tree-token.netlify.app/dapp/#stats

Baseline: `main` commit `dc557de`. Feature branch: `feature/sti-tree-stats`.

The safe draft workflow reused the published 166-file inventory and replaced only `/dapp/index.html` and `/dapp/styles.css`; one preview-only `_redirects` file forwards six existing GET-only Stats endpoints. No functions were built or deployed. The preview contains 167 files. Published deployment `6aad931f45a27f392303e229` remains locked and all 35 function identities were verified unchanged. Other server-dependent preview features are unavailable; this is a Stats review preview, not a complete backend test environment.

Passed: three new source regression tests (placement/identity, source/data-coin/SRI, external fallback), existing Stats supply and NFTree tests, and the 166-file feature preview build. Browser checks and screenshot inspection passed at 1440×1000, 390×844 and 320×740: loaded TREE card; after market metrics/before burn; no page overflow or iframe clipping; Stats→Swap→Stats routing; no duplicate widget; blocked-loader fallback; SRI mismatch rejection. No page JavaScript exceptions occurred. At 320px the upstream badge intentionally truncates its subtitle and hides its third statistic; TREE's surrounding title/disclosure remain readable.

The legacy `panel-router-source.test.mjs` also ran and failed on its pre-existing nine-tab width assertion. Both that test and `panel-router.css` are unchanged from main; current production has ten navigation tabs. This failure was recorded, not treated as an STI regression or silently repaired. The production snapshot verification/build is intentionally not a feature build: its baseline digests remain unchanged pending an authorized release. Use `build:preview` for this branch.

Re-run source checks with `node --test tests/stats-sti-source.test.mjs tests/stats-live-supply-source.test.mjs tests/stats-nftree-source.test.mjs`. Run `tests/stats-sti-browser.mjs` with `STI_PREVIEW_URL` and optionally `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `STI_QA_OUTPUT`. Browser QA evidence and the deployment report are alongside this review.
