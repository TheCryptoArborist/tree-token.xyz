# Isolated free pilot sign-in release

## Published outcome

PR229 source `6c8622c64186e7b08c475cf2ae79758149f1545e` is published as
`6afe4d06ab2e466f455605db`. Publication run `44435573744` and the bounded
canonical run `44435875741` passed. The live check issued one isolated session
and one attempt, committed three distinct legal moves, recovered the identical
retry and reload, made zero Growth API calls and revoked its own session.
The current `production/README.md` and dated `arcade-challenge-auth-*` records
contain the exact inventory, source, package and artifact bindings. The initial
failed fresh-wallet test remains recorded separately.

## Problem and correction

The initial Arborist Trials release reused Arcade authentication. The bounded
canonical check signed the exact server message with a fresh, unfunded Sui
keypair, verified that signature locally, and received HTTP 403 with
`nftree-required` from the existing Arcade session endpoint. No session, attempt
or move was created. That established a concrete conflict with the pilot's
free, no-NFTree entry terms.

This correction gives the pilot its own personal-message challenge and session
inside the existing isolated `arcade-challenge-pilot` function. It preserves
the original Arcade authentication, NFTree eligibility and check-in behavior.
The published wallet bridge and pinned `@mysten/sui` 2.26.1 remain in use.

New tokens have the `pilot_` prefix and scope `challenge-pilot`; their entire
token is hashed before storage. They live only in private pilot tables and the
browser's `tree-arcade:challenge-pilot:session:v1` storage key. The controller
does not write or erase either shared Arcade session storage location. A valid
existing Arcade session remains usable for pilot play. New pilot sessions
cannot authorize original Arcade actions, and pilot logout cannot revoke an
Arcade session. Each saved match remains bound to its original session token.

The signed message names the pilot audience, canonical origin, wallet, nonce,
expiry and restricted purpose. Challenges last at most five minutes; sessions
last at most one hour. SQL rechecks expiry and single use after acquiring the
challenge lock, including when signature verification took time. Sign-in
submits no transaction and grants no prizes, check-ins, badges or event access.

## Reviewable delivery scope

The fresh expected baseline is the initial pilot deployment
`6afe412cc313992199456506`. Capture its complete current inventory before
preparing a new candidate. Do not restore an older deployment.

Exactly three existing static paths may change:

- `/scripts/arcade-challenge.mjs`
- `/scripts/arcade-challenge-client.mjs`
- `/scripts/arcade-challenge-view.mjs`

Only the existing `arcade-challenge-pilot` backend package may be replaced.
The release guard compares every complete unrelated backend record, including
unknown provider fields, plus runtime settings, all schedules and protected
configuration. With the captured initial inventory, this means 625 static
paths total, 622 byte-identical static paths, 50 backend records total,
49 unchanged complete backend records and five unchanged schedules.

The function ZIP binds the exact 13 source files, existing events packaging
lock and existing monthly SDK lock. The exact ZIP is imported in an empty
directory before release and carried unchanged from candidate to publication.
The candidate serves its UI for review, while its API continues to reject
preview origins.

## Hosted schema gate

Apply `supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql`
separately from deployment, after inspecting the existing hosted schema.
Its additive tables hold wallet challenges, pilot sessions and session
bindings. Bindings preserve existing pilot attempts and their original Arcade
sessions while accepting separately authenticated pilot sessions.

Record actual hosted migration identity and exact live definitions in
`production/arcade-challenge-auth-db-readiness.json`. The release rejects a
proof older than 24 hours, a mismatched SQL hash, missing private tables or
public RPCs, browser access, changed original Arcade function definitions or
grants, overlapping session hashes, or missing legacy attempt bindings.
The pilot configuration, objective, game engine and no-prize flags remain
unchanged. No global Arcade session is inserted or modified by this migration.

## Candidate, publication and canonical verification

1. Commit the complete correction and hosted proof to a feature branch with
   `[skip netlify]`. Run the source, SQL, independent PostgreSQL worker,
   controller, browser and preservation checks through the pull request.
2. Put that exact source commit on `release/arcade-challenge-auth-prepare` with
   `[prepare arcade challenge auth] [skip netlify]` in the commit message. The
   dedicated workflow captures production, packages the function, creates a
   new candidate and compares complete inventories without publishing it.
3. Inspect the candidate screenshots at desktop, 390-pixel and 320-pixel
   widths. Check labels, keyboard focus, Campaigns entry, missing assets and
   preview API denial. Bind the browser report to its exact source, tree,
   candidate ID and plan hash.
4. Merge the reviewed source only after its required checks pass. The complete
   main tree must match the reviewed candidate tree. A separate control commit
   directly on that main commit changes only
   `production/arcade-challenge-auth-publish.json` and
   `production/arcade-challenge-auth-browser-review.json`.
5. Use `release/arcade-challenge-auth-publish` with
   `[publish arcade challenge auth] [skip netlify]`. The workflow verifies the
   original successful prepare run, artifact identity, archive digest and
   package. It waits for all queued Git deploys before switching the production
   lock to this newly reviewed candidate, then verifies public bytes, complete
   inventories and the production lock again.
6. Run the bounded canonical browser check with one ephemeral operator wallet.
   Require the actual pilot personal-message signature, pilot-only session,
   one attempt, legal moves, an identical retry after a lost response, reload
   recovery and explicit pilot session revocation. Any request to the Arcade
   Growth API fails this check. Never log private keys, signatures or tokens.

If publication returns an uncertain result, inspect the observed candidate
and use the candidate-bound read-only audit branch. Do not retry a lock switch
blindly or restore an older deployment.

The operator keypair check exercises real signed messages and hosted protocol
behavior. It does not claim an installed Slush extension review or fund a
campaign. A weekly prize campaign still needs its budget, asset, reward
network, UTC dates, target and approved identity/review rules.

## Guidance

The live MystenLabs skills README and relevant frontend and backend guidance
were reviewed for this work: `frontend-apps/SKILL.md`, `limitations.md`,
`non-react.md`, `transactions.md`, `sui-ts-sdk-backend/SKILL.md` and
`bootstrap.md`. The change preserves the working wallet integration and
dependency versions. Netlify deployment/function and Supabase function/RLS
guidance informed the scoped package and private service-only schema.
