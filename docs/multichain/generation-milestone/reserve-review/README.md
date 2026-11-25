# Atomic first reserve review — November 22, 2026

## Review result and proposed authorization

The next concrete transaction is **one atomic Sui PTB** that funds the new vault
with original NFTree #2720 and sends its generation-1 reserve announcement to the
new BNB adapter. Checked source simulation and a separate local BNB receiver fork
passed. No live deposit, message or USDT purchase was submitted. This is an
unsigned proposal; previous configuration approvals do not include it.

Proposed first-step ceilings: **0.25 SUI message fee + 0.1 SUI gas = 0.35 SUI
maximum**. Reject any quote above those limits. Request explicit approval for
that exact deposit+reserve scope before building a canonical signing handoff.
No BNB purchase unpause, USDT allowance/payment, public sale, redemption or game
activation is included in this proposed first-step authorization.

If the source send aborts, the same transaction's deposit rolls back. After a
successful send, a delayed destination delivery can leave the NFT held in custody.
There is no direct admin withdrawal. Normal return requires the already documented
private 25-USDT purchase/redemption lifecycle in `../delivery-review/README.md`.
The purchase pays the unchanged treasury, is not refunded by redemption and needs
separate approval; it is not charged by the first reserve. Contract canPlay becomes
true during that private purchase, while live Arcade access remains disabled.

## Current observed costs

| Item | Read/simulation result | Scope / qualification |
| --- | ---: | --- |
| First Sui→BNB message | 0.102798531 SUI | Native executor + three required verifier fees; zero LZ token fee |
| Atomic fund+send net gas | 0.003004754 SUI | Gross gas 0.0185452 SUI before storage rebate; simulation only |
| First-step estimated total | **0.105803285 SUI** | Refresh before signature; proposed ceiling 0.35 SUI |
| BNB→Sui redemption message | 0.004577084124304116 BNB | Direct Endpoint quote for a hypothetical future locked-generation payload; excludes BNB transaction gas |
| BNB→Sui completion message | 0.004577084124304116 BNB | Hypothetical retired-generation payload; excludes BNB transaction gas |
| Later Sui→BNB burn acknowledgement | Not yet a state-valid application quote | Same payload length/options as reserve suggest comparable cost if pricing is unchanged, but this is not a fee quote or approval |
| Private purchase | Exactly 25 USDT | Real payment to existing treasury; separate authorization and chain gas |

The two hypothetical BNB native fees sum to 0.009154168248608232 BNB, excluding
transaction gas. Do not reuse earlier configuration fee caps or present this as a
full-trip ceiling. Later gas, acknowledgement fees and retries remain separately
quoted/reviewed at the correct state. No exchange-rate estimate is assumed.

Sui simulated fee recipients:
- Executor: `0xf99b445ae678d3f28fe7acb91e5d7ee8ab538d7e231a837b12c593fb624ad630`,
  89621992 MIST.
- Required DVNs: `0x9004e1e4c6dcc42d1b73269db48d510192665677fcad2079a3c7d1e9e971d34e`,
  4358299 + 4409120 + 4409120 MIST, matched to the exact configured verifier list.

All non-gas balance changes match these fees exactly. There is no treasury or
USDT transfer in the atomic reserve simulation.

## Exact source and destination proof

`initial/` contains current pre/post live state, unsigned quote/send transactions,
checked simulations, native quote, simulation-scoped custody/channel state and
independent effects verification. Original #2720 type/ID/ownership is refreshed.
The original is wrapped intact in the vault, phase 1, generation 1, announced;
OApp/channel data remain intact except exact outbound nonce 1. Only original,
vault, OApp, channel path/channel and sender gas inputs mutate. Capabilities,
security settings and other original NFTs do not mutate. All created persistent
objects are SUI coins to the sender or reviewed protocol payees.

Wire payload is v3, kind 1, new route, exact original, generation 1, zero request
and recipient. Expected first GUID:
`0xecfb51b3c1866ca41d2698129f8247504c83b759812a84df0bd30990c41f03f8`.
The verifier checks the exact PacketSent encoding, options, library, fee events,
commands, input references, balances, owner preservation and custody post-state.
Before/after real vault and NFT objects remain unchanged.

`receiver-fork.json` runs the actual deployed BNB receiver/pass only on a local
mainnet fork, impersonating the Endpoint **locally** to test execution budget.
Estimate 95520 gas; actual 90551 gas within 200000 enforced. State becomes Ready,
generation 1, purchases paused, no token owner, canPlay false. Unauthorized caller
and changed payload reject; identical reserve retry does not unlock. This does
not prove required-verifier attestations or executor delivery on mainnet.

`hypothetical-return-quotes.json` calls the public Endpoint quote directly using
new-route receiver options and deterministic future request/recipient. The actual
inactive adapter cannot send kind 2 or 4 now. These estimates are not successful
redemption simulations and must never be used to bypass the application state gate.

## Provenance and reproduction

The static protocol call graphs were extracted from the repository's previously
reviewed protocol flow, with all application package, vault, OApp and channel
references replaced with the new generation identities before simulation. The
new standalone templates have no runtime dependency on retired trial helpers or
routes. No old vault, pass or route was reopened or mutated. Protocol package and
worker identities are exercised by the checked quote/send against current state.
Mysten skills README was refreshed at `a384d9a158c4639f075ad3f6644d925108ddfc78`;
PTB construction/commands and GraphQL references informed this read-only work.

Node 24 with root and `contracts/bnb-generation` locked dependencies:

```
node --use-env-proxy contracts/nftree-generation/scripts/prepare-reserve-review.mjs /tmp/new-reserve-review
node --use-env-proxy contracts/bnb-generation/scripts/review-reserve-receiver.mjs /tmp/new-receiver-fork.json
node --use-env-proxy contracts/nftree-generation/scripts/quote-return-review.mjs /tmp/new-return-quotes.json
node --test contracts/nftree-generation/scripts/reserve-review.test.mjs
```

12 focused negative/positive effects tests and all 140 Sui review regressions
passed. Tests reject changed payees, fees, packet, commands, sender, custody,
generation, admin mutations and unaccounted payments. The maintained 16 EVM
lifecycle tests passed in the preceding delivery review. No website was changed.

## Execution and recovery gates after separate approval

1. Prepare/test a signing page only under tree-token.xyz/play/, keeping existing
   production files/backends intact. Fresh quote, identities and complete effects
   verification must pass before every signature. Persist digest before submission.
2. Reconcile the actual source receipt, GUID, packet and custody state. An uncertain
   wallet response must never trigger a second deposit or blind resend.
3. Observe verifier/executor progress. Only matching destination MessageApplied /
   ReserveConfirmed events plus Ready/gen1/paused/no-token state prove delivery.
4. If delayed, stop purchases. Inspect the precise packet status and execution
   error. A supported executor retry or new source resend needs a fresh fee review;
   source resends have distinct GUIDs/nonces and are not free. Never weaken the
   security quorum, change the peer, skip messages or upgrade as an automatic fix.
5. Separately review/authorize the exact 25-USDT allowance, private purchase,
   redemption lock and each return/acknowledgement/completion fee. Preserve the
   deterministic recipient 45c4; lock the pass before release. Keep public Arcade
   gameplay disabled throughout. See the full state/recovery table in the delivery
   review. No second-generation funding until final authenticated completion.
