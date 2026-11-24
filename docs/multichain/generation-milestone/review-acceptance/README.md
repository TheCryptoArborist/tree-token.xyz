# Generation-1 negative acceptance completed

The user supplied a screenshot on November 24, 2026 showing the selected BNB
wallet ending **8789**, **BNB sign-in verified**, and **Review denied**, with
no access granted and gameplay disabled. This closes the visible real-wallet
sign-in/negative-review acceptance step for the retired generation. The earlier
wallet choice was MetaMask with Ledger; the screenshot does not independently
show the hardware signing prompt. Its visible messages are transcribed in
`user-observation.json`; no signature or session secret is retained.

This is deliberately a negative test. The generic denial does not reveal whether
session validation or backing validation caused that particular response. It is
not a positive gameplay test or evidence of current NFT ownership.

Independent read-only checks after the screenshot found:

- The private review table has zero rows and zero consumed records. No database
  write or cleanup was performed (`database-observation.json`).
- The existing mainnet reader observed BNB generation 1 in state 4 (Retired), no
  owner and `canPlay: false`, with Sui phase 3/generation 1 and no eligibility.
  Full raw reads and observation time are in `backing-observation.json`.
- The reader returned `generation-not-active-backed`, rather than merely failing
  closed on an RPC error. This is separate evidence from the user's screenshot.

The published page/endpoint remain unchanged. No deployment, custody operation,
payment, message resend or gameplay activation accompanied acceptance recording.
Generation 1 is complete; do not repeat its financial or cross-chain lifecycle.

## Next source milestone

Implement and test the **isolated run lifecycle and score-admission boundary**
before considering any positive live gameplay trial. Use the existing generation
reader and durable review-ticket coordinator as inputs, never a client-provided
wallet/backing claim or a cached browser access flag.

The next change must first map the currently published Tree Force run and score
interfaces and document which server inputs are authoritative. Prepare isolated
BNB code and tests; keep the existing Sui handlers, games, scores and tournaments
unchanged. A review ticket is not a game session and cannot itself submit a score.

Required design and tests:

1. Atomically consume a review ticket and create at most one server-owned run,
   binding its wallet/session, chain, generation, expiry and rules version.
   Concurrent starts, retries and old-generation tickets must not allocate a
   second run. Specify durable RPC locking and explicit failure recovery before
   deploying any new table/function.
2. Recheck session and fresh backing at run creation and score admission. Define
   a bounded in-run revalidation interval and what happens during unavailable
   reads. Losing ownership, entering redemption, revocation or expiry must stop
   new authorized actions and disallow an authoritative score from that run.
   A client continuing to animate cannot grant server-side access or rewards.
3. Keep score integrity separate from entitlement. Define server-verifiable run
   completion/score evidence, one-time finalization and replay/concurrency guards.
   An owned NFT alone does not make a client-supplied score trustworthy. Do not
   route BNB results into existing leaderboards or tournament qualification yet.
4. Test positive active/held cases only with clearly labelled fixtures. Retired
   generation 1, stale/unavailable reads, ownership transfer/redemption during a
   run, logout, wallet mismatch, expired leases, duplicate finalization and forged
   scores must fail closed. No fixture is proof of live entitlement.
5. Produce reviewable source, meaningful contract/integration tests, a durable
   data/RPC design and a private acceptance procedure in PR #280. Any proposed
   migration or site release needs a fresh full production capture and exact
   preservation of all unrelated packages and routes.

Only after that source review can a separate live milestone consider generation
2. That needs freshly checked NFTree #2720 identity/ownership, explicit deposit,
reserve and purchase reviews, exact recipients and fee limits, and a separate
private gameplay activation decision. The completed 25-USDT purchase is not an
automatic credit for a new generation. Do not request another payment now.
Public sales, inventory expansion, USDT in-game actions and tournaments remain
separate milestones. No new financial approval is implied by this acceptance.
