# Tree Force ’89: session return candidate

Prepared from the current MOBILE R1 live entry and Phaser bundle. Reproduction:
`node scripts/treeforce-session/prepare.mjs`, then
`node --test tests/treeforce-session-return.test.mjs`. Exact SHA-256 source
fingerprints reject unexplained production drift. Outputs are in
`release/session-return`; do not deploy the historical root build.

## Behavior

- Game Over explains that 20,000 TREE keeps the score and current wave, restores
  three lives, and replays the wave. SUI gas remains separate.
- Page departure no longer revokes the bearer credential. Browser back/forward
  cache preserves the same mounted Phaser flight, paused for explicit Resume.
- Temporary loss of wallet connection hides and makes the canvas inert while
  retaining the run in memory. Connecting the same account resumes access to
  that paused run without another sign-in signature while the session is valid.
- A different account revokes the old session. Explicit Disconnect still signs
  out. Expiry remains unchanged and is checked on pageshow/foreground return,
  including when the browser suspended the expiry timer.
- No authentication tokens are added to persistent browser storage. No extra
  lives, paid continue, payment authorization, score accumulation, new backend
  function, SDK upgrade, or session extension is introduced.

## Recovery boundary

This candidate preserves a live document, including browser back-forward cache.
Hard reload, tab closure, browser crash, and mobile OS tab eviction still lose
in-memory flight state. Do not describe this as durable autosave. A safe durable
resume needs a server-authenticated restore endpoint and versioned checkpoints
bound to wallet, run, original expiry and continuation number. A restored
checkpoint must preserve remaining lives and used payments, and must not revive
an exhausted/completed run or re-submit a recorded result. Local JSON alone is
not authorization to continue or to submit a ranked score.

## Validation and release status

Nine behavior/contract checks pass, covering temporary disconnect/reconnect,
account change, navigation, expired bfcache restoration, visible-tab expiry,
effect cleanup, source drift and retained auth/payment contracts. Both emitted
JS modules pass `node --check`. These are automated fixture checks, not a real
holder-wallet or paid-continue browser test.

Published as `6af34e39760c3d568bd12519` at 11:04 AM America/Chicago on November 10, 2026. Production remains locked. Before broader holder-wallet validation, test on
`tree-token.xyz/play/treeforce89/test/` with payments disabled and verify
wallet-switch/expiry behavior and mobile back-button handling. Publishing needs
fresh full current static/function/schedule/config inventory preservation and
terminal queued builds. Keep all current backend packages and five schedules.

## Retro ending presentation

The candidate now draws a Phaser-native inset arcade frame, gold/coral pixel
rails, corner blocks and wing motifs around the existing hero. GAME OVER uses
larger coral-red type with a hard offset shadow; victory uses gold. The framed
mission record and raised Continue/New Game/title plates retain their original
hit targets and payment handlers. No flashing title, timed continue countdown,
external images or additional fonts are introduced. Generated syntax and the
nine session/payment contract checks pass; final authenticated mobile play-through remains a user validation step.


## Published release verification

- Main page loads `/play/treeforce89/assets/index-session-r2.js`.
- New Phaser bundle is `arcade-session-r2.js`; existing game assets remain.
- Current baseline was `6af30caebef27d13b6da7c6f`.
- 387 existing static paths are unchanged; only the game HTML entry changes,
  with two new versioned JavaScript assets (390 total static paths).
- All 46 exact backend records, five schedules, runtime and environment
  fingerprints match the freshly captured baseline.
- Candidate HTTP checks and published inventory checks pass. Live browser boots
  at the NFTree gateway and its DOM confirms the new entry module.
- No live holder login, score write or paid continue was executed during release.

Continue now uses the classic CONTINUE? invitation, three pixel hearts, a raised
purple button and the visible 20,000 TREE / restore-three-lives price. The mission
record is separate. Hard refresh/tab closure autosave is not included.
