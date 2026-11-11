# Completed-run connection

The staged Arcade play/share flow now uses saved run receipts for Tree Force ’89, Canopy Breaker, Garden Bot and PvP. The completion endpoint is GET-only, uses the existing message-sign-in session, resolves the wallet server-side, and accepts no client score, wallet or run claim. No game wallet, entry, continue or payment handler is rebuilt.

Tree Force reads saved ranked pilot results from the existing explicitly isolated game database, with a server-issued run/session match. As with the existing leaderboard, these are client-simulated saved results, not server-authoritative anti-cheat or prize eligibility. Starting a wave and practice runs do not qualify. A player must finish and save the mission result.

Canopy Breaker reads its existing completed-runs feed, which selects only server-simulated won/gameover runs. Wallet matching uses the established SHA-256 `tree-arcade-weekly:` player identity. The feed is paginated, validates timestamps and scores, and never substitutes public usernames or a leaderboard best for a run.

Garden Bot and PvP import only existing `garden-battles` events with `completed-result` evidence for the authenticated wallet. Arborist Trials remains supported by its existing systems but is not a substitute in this four-game sequence.

A new private Supabase receipt table preserves the first completion date per stable source run key. Retries and later score saves do not move that run into another UTC day. Scores may increase on an existing receipt; its original date remains fixed. RLS is enabled; browser roles have neither table access nor RPC execution. The service-only RPC rechecks session expiry and wallet ownership inside its transaction. Existing attendance, monthly qualification, Passport rules, social stamp rules and all reward/payment records remain unchanged.

The frontend discards in-flight results on wallet changes, refreshes after gameplay progress checks and return to the page, and locks sharing when current results cannot be verified. The share builder selects a specific saved run and prints that run's actual score and wave/grove where supplied. Garden/PvP receipts have no score field in the existing ingestion data; their captions confirm completion without inventing a score. Social posts still enter the existing weekly review queue. Daily share-credit awards are separate outstanding work.

Source provenance: Canopy Breaker `fix/canopy-breaker-home` at `6b6b955a854102ed7e499d909b7a5c55c7f8bfe0`, including `games/canopy-breaker/server/completions.mjs`; Tree Force `feature/treeforce89-telegram` at `936210c610ef4e017bb74a01d629a9be893e0ac1`, including `netlify/preview-lib/treeforce89-completions.mjs` and the existing isolated database identity. Existing services retain their original packages.

Validation includes SQL service-role/browser-role isolation, duplicate run/foreign-wallet rejection, Garden/PvP imports, exclusion of first-wave events, midnight retry preservation, feed pagination/outage handling, identity-switch races, exact-score captions, and existing session/navigation/badge regressions. Only the new isolated function is packaged. Releases capture the current complete static and backend inventory and preserve all original packages, provider/runtime records, configuration, five schedules and environment fingerprints. The main Arcade page remains unchanged; the review stays at /play/quests/preview/.

An early diagnostic parser included a simulation-only signing key in its error log. That generated log was removed and the simulation-only key replaced before continuing. No production payment or wallet key was exposed. Temporary inspection workflows are removed from the final source.
