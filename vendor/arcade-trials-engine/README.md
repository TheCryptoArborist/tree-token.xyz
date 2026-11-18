# Pinned Arborist Trials pilot engine

This directory isolates the existing Arborist Trials card rules for a **nonpaying,
server-authoritative campaign pilot**. It does not modify or replace Garden Bot,
the daily Arborist Trials game, their access gates, wallets, ranked results or
payment flows. No package dependency or lockfile is added.

## Source and scope

The exact source is `TheCryptoArborist/gardenbattles` commit
`4a27b3ac73ec815c9e28c23a6b0d07f09ee73794`, from the recovered source branch
`codex/recovered-gardenbattles-20260624`. The relevant source lives below
`apps/garden-battles/`; that repository's ordinary `main` branch lacks these
recovered game modules. `source.json` records every original path, Git blob SHA-1
and SHA-256. All five files under `upstream/` retain the original bytes.

No separate LICENSE, LICENCE or COPYING file was found in that pinned source
tree. These are the project owner's existing game sources copied into the same
owner's project. No additional license grant or third-party license is asserted.

`provenance.json` binds the source files, transformation descriptions and runtime
hashes into `sourceHash`. The adapter identifies this isolated ruleset as
`campaign-pilot-4a27b3ac-v1` / `portable-v1-four-card`. **Exact equivalence to the
currently deployed game is not claimed.** Its source provenance and version are
explicit so future game changes cannot silently change a campaign.

## Reproduction

With Node 24:

```sh
node vendor/arcade-trials-engine/generate.mjs
node --test tests/arcade-trials-adapter.test.mjs
```

The generator verifies the pinned originals, erases TypeScript types with Node's
built-in type eraser, removes the resulting whitespace-only padding lines, and
redirects runtime imports to the local modules. It
extracts only the card catalog from `sui-config.ts`; chain settings and wallet
code are not imported into the runtime. The complete upstream configuration is
retained only as source evidence.

The generated game calculations remain unchanged. In particular, the original
log-entry code consumes seeded random values: removing those calls would change
future bot choices and chance effects. The adapter filters nondeterministic
`Date.now()` log metadata from its output without changing those calls.

## Adapter contract

`scripts/arcade-campaigns/trials-adapter.mjs` exports:

- `ADAPTER`: the fixed game, adapter, ruleset and source-hash descriptor.
- `createChallenge(seedHex, dateKey)`: an immutable private challenge, using
  exactly 32 bytes of server entropy and a real UTC date on or after September
  3, 2026. A domain-separated hash produces the original engine's uint32 seed.
- `inspectReplay(challenge, moves)`: recomputes a legal prefix from the initial
  state, including the bot's actions, random effects, scoring and trial-specific
  rules. It accepts zero through 100 moves and returns a sanitized player view.
- `replayChallenge(challenge, moves)`: the same calculation but requires a
  completed game. It rejects incomplete sequences and any action after victory
  or loss.
- `publicChallenge(challenge)`: public instructions and the initial player view.

The only accepted actions are integer IDs for cards actually dealt in the
standard four-card hand. The original repeat and Toolbelt rules apply. Fifth
cards are never unlocked. The adapter accepts no submitted score, final state,
paid-advantage flag or debug flag. A 100-move nonterminal prefix is visible as
`move-limit`, has no further legal actions, and cannot qualify as a completed run.

Public views contain card names/effects, current visible Growth/status effects,
legal actions, and the last round. The Diagnosis variant reveals only its
intended next-card type. Server entropy, RNG state and the hidden bot hand are
excluded. Dates and timestamps submitted by a player are not gameplay evidence.

The caller must authenticate the session and own the challenge, entropy, start
time and stored action list. It must compare and set the action version, enforce
idempotent retries, enforce its own expiry, and bind all records to this exact
private challenge. Calling this local adapter alone proves neither server origin
nor identity. A valid action sequence proves only an outcome allowed by these
rules; it does not prove a human played it or defeat automated strategies.

The game includes seeded chance effects and variable card hands. Before a real
reward launch, the organizer must settle the challenge difficulty and attempt
rules as well as identity review and funding. No cash eligibility or payout is
authorized by this pilot engine.

## Runnable fixture

`fixtures.json` contains synthetic complete wins/losses and expected results for
the base game and each special rule. The short end-to-end fixture is:

```js
const challenge = createChallenge(
  '0000000000000000000000000000000000000000000000000000000000000005',
  '2026-11-18',
);
replayChallenge(challenge, [19, 27, 19]);
// completed: true, won: true, score: 16375, rounds: 3,
// playerGrowth: 50, botGrowth: 19
```

Fixture seeds are deliberately public and must never be used as production
entropy or presented as a funded offer.
