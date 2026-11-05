# Compact Arcade quest cards

The Campaigns and Community tabs now show illustrated quest cards instead of expanded instructions and forms. Each card shows its theme, reward and explicit opening action; native disclosure controls reveal the selected task. On desktop, three cards fit side by side. Two columns are used at medium widths and one column on phones. Only the opened quest expands to full width. The attendance badge sidebar stays on Daily and collection tabs and is hidden on the two quest tabs.

Existing artwork is reused from the published Arcade inventory. All form IDs, session checks, submission handlers, quiz grading, enrollment and claim behavior are retained. Only play/index.html and styles/tree-arcade-suite.css change publicly; no wallet script, backend, dependency or database modification is included.

Join Team TREE lists the exact requested X accounts: https://x.com/thickquidity, https://x.com/suidexHQ, and https://x.com/kelpiedotsui, followed by Telegram. All follow steps remain explicitly unverified; visiting a profile grants no stamp or badge. Follow verification is still pending configuration.

57 existing campaign, social, daily-growth and wallet UI checks passed. HTML IDs are unique, and every referenced image exists in the canonical production inventory. The historical Canopy image is hosted in production and is not duplicated in this local source checkout. git diff --check passed.

The baseline for this presentation update is 6aebe195dff096f7428fe1b0: 290 files, 43 complete function/provider records, five schedules and 50 site environment entries. scripts/release-arcade-quest-cards.py reuses original archives by exact digest and refuses any runtime, provider, schedule or environment change. An ordinary root/dashboard build must not be used.

MystenLabs/skills README and frontend-apps/SKILL.md were checked live. This presentation change requires no SDK or wallet integration changes, and no Sui API guidance changes the implementation.

## Hosted visual verification

At the same desktop browser size and signed-out state, the Community panel fell from 1,209 px tall to 343 px (71.6% less); Campaigns fell from 1,851 px to 318 px (82.8% less). These measurements cover the selected tab content before opening a card, not the entire page. Both new card shelves had no horizontal page overflow. Card expansion, retained signed-out form gates, First Round → quiz navigation, and the return of the attendance badge sidebar on Daily were checked in the hosted candidate.

The exact SuiDex and Kelpie URLs were verified in rendered Join Team TREE steps. No X follow was made and no completion was simulated. A canonical phone visual check and authenticated campaign walkthrough are outside the performed verification; responsive CSS breakpoints and existing controller tests are included.

Published and locked deploy: `6aebe7578c57bc8e8c7e1b53` at `2026-11-05T02:20:24.435Z`; application source `afc8661e89728b64004325e0c8a0213a6adbd892`. Canonical verification matched candidate results. All 43 complete backend/provider records, five schedules, 50 environment entries, and 288 unrelated static files remained exact.
