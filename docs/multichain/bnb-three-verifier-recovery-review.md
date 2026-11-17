# Review: recover the disposable Sui → BNB pilot with three required verifiers

**Status: tested locally; not applied to mainnet. Explicit approval of the security change is required.**

## Decision

Change this isolated pilot from four required verifiers to three by removing Canary. Horizen, Twinstake and LayerZero Labs all remain required; confirmations stay at the reviewed values and optional verifiers remain explicitly disabled. This reduces the number of independent verifier approvals required from four to three. It is a change to the pilot's security model, not an equivalent replacement for Canary's approval.

This proposal covers the disposable pilot only. It does not change the original 5,000 NFTrees or the live arcade. Production collection custody and verifier selection require a separate review.

## What was proved

The BNB receive library currently has three valid proofs, each at five confirmations. Canary's proof is absent. With the live four-required-verifier configuration, `verifiable` returns false and a read-only manual commit simulation reverts with `LZ_ULN_Verifying`. Passing the same three proven verifiers as a three-required configuration returns true.

A local fork of the actual BNB mainnet contracts then executed the complete recovery successfully:

| Local-only transaction | Result | Local gas used |
|---|---|---:|
| Set pilot BNB send security to three required DVNs | Passed | 71,644 |
| Set pilot BNB receive security to three required DVNs | Passed | 71,398 |
| Commit the existing nonce-1 packet | Passed | 82,050 |
| Deliver it through the actual LayerZero endpoint | Passed | 114,160 |

The pass moved from Unconfirmed (0) to Ready (1), and the adapter recorded the expected hash of the reserve payload. The simulation did not purchase a pass. Local gas use is evidence for testing, not a live fee quote.

The fork used verified deployed bytecode and the existing delegate relationship. It used a locally unlocked copy of the designated BNB address and artificial local gas funds. Its remote RPC transport allowed reads only and made zero remote write requests. The locally generated transaction hashes in the simulation record are not mainnet receipts.

## Exact message recovered

- Sui source transaction: `5Uztr6gLvf9fSMNfFRSi2fTVTAHXC1rCSKSRwn4h8JQP`
- GUID: `0x6a21b3ef6075b49ae3bdb1b839554326695df0d71c949db5aa8898ffc7967f8f`
- Nonce: 1; Sui EID 30378 → BNB EID 30102.
- BNB adapter: `0xb4c471c1fb8e31ddcbb518277e97a4575fc74779`
- BNB pass: `0xe98fa205106028822572d2549ea41748f8bfd879`
- Expected delivered reserve-payload hash: `0x04ae162f6779923f134e350271f927fdbebd6dddaa9246cb0bf62e322942dd87`

The already-paid packet is reused. No second source-message send fee is required by this recovery; live configuration and delivery transactions still spend network gas. This does not refund fees already paid to Canary.

## Work after approval

1. Prepare the wallet review pages with the four-to-three change clearly disclosed.
2. Recheck current custody, code, delegate, verifiers, nonce and delivery state. Stop if the existing packet has delivered or the route has changed.
3. Align this pilot's Sui send/receive and BNB send/receive settings with the same three required operators before further cross-chain sends. The BNB-only local fork does not simulate Sui configuration writes; these must be built and checked separately before requesting a signature.
4. Request the user's own wallet approvals for the configuration and existing-packet recovery, then independently verify actual source/destination state.
5. Prepare the separate 25-USDT purchase only after the live BNB reserve is Ready and bidirectional route checks pass.

No live signing page for this security change has been published and no mainnet setting was modified by this investigation. The accompanying unsigned BNB requests are a review artifact, not instructions to broadcast without fresh checks. Keeping four required verifiers remains an alternative, but it requires Canary's valid proof before this packet can be committed.

## Evidence

- `bnb-three-verifier-recovery-simulation.json`: complete local fork results and expected effects.
- `bnb-three-verifier-recovery-unsigned.json`: exact unsigned BNB calls used in the local test.
- `bnb-three-verifier-quorum-proof.json`: direct four-verifier and three-verifier checks against the BNB receive library.

Sui guidance checked live: MystenLabs/skills README, accessing-data/SKILL.md and graphql.md, move-security/SKILL.md and best-practices.md. LayerZero ReceiveUln302 and ReceiveUlnBase source were reviewed for commit and proof-validation behavior.
