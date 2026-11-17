# Draft support request — Canary verification pending on Sui → BNB

Status: prepared for review; not submitted to Canary or LayerZero.

Hello Canary team,

We are running an isolated, single disposable-NFT mainnet pilot for NFTree / Tree Arcade. We need help diagnosing Canary's missing verification for an existing Sui → BNB LayerZero V2 message. Please investigate the existing packet without requiring a resend or reducing the verifier quorum.

## Existing message

- Source transaction: `5Uztr6gLvf9fSMNfFRSi2fTVTAHXC1rCSKSRwn4h8JQP`
- GUID: `0x6a21b3ef6075b49ae3bdb1b839554326695df0d71c949db5aa8898ffc7967f8f`
- Route: Sui EID 30378 → BNB EID 30102; nonce 1.
- Sui application package: `0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900`
- BNB receiver: `0xb4c471c1fb8e31ddcbb518277e97a4575fc74779`
- BNB receive library: `0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1`
- Header hash: `0xc61ff6a0009c2319a702dd7716af56988001695778a8d15b4f0348afeaab2176`
- Payload hash: `0x082e0932f09b5bfeae11aaa39fcdd02e24cc3a430d004667fcc6c5f006538992`
- Payload: a 130-byte reserve announcement, not an OFT token transfer. Delivery options: 200,000 destination gas, zero native drop.

## Verified chain state

The Sui transaction succeeded at checkpoint 346242879 (2026-11-17 14:49:40 UTC). It emitted the reviewed packet and paid all four DVN fees. Canary's fee was 961,660,676 MIST. The disposable backing NFT remains nested in the Sui bridge; both admin capabilities remain with the designated dev wallet. No pass purchase has occurred.

Both directions require Twinstake, LayerZero Labs, Canary and Horizen, with no optional DVNs. The Sui → BNB route uses five confirmations on both sides.

Direct `hashLookup(headerHash, payloadHash, dvn)` reads on the BNB receive library show:

| Required DVN | BNB address | Submitted | Confirmations |
|---|---|---|---|
| Horizen | `0x247624e2143504730aec22912ed41f092498bef2` | Yes | 5 |
| Twinstake | `0x31f748a368a893bdb5abb67ec95f232507601a73` | Yes | 5 |
| Canary | `0xfa9ba83c102283958b997adc8b44ed3a3cdb5dda` | No | 0 |
| LayerZero Labs | `0xfd6865c841c2d64565562fcc7e05e619a30615f0` | Yes | 5 |

`verifiable` returns false for the configured four-required-DVN set. The BNB pass remains Unconfirmed and the adapter's delivered hash is zero. LayerZero Scan labels the source successful and the overall message BLOCKED / Config error, with outbound Canary shown as unknown.

## Sui identity discrepancy

LayerZero's live published deployment metadata identifies Canary on Sui as:

`0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0`

This is the shared DVN worker object. Its onchain `worker.worker_cap.cap_type` is Package:

`0x5ddd0e7338d03f52e98831b52ca28e09a145a0495eea80fe46c4a4b88a69278a`

The ULN worker PTB registry and worker-info registry have entries for the package identity, but neither has an entry for the worker-object address. The package-key PTBs reference that same published worker object for get_fee / assign_job. With the worker-object address configured, generic quote discovery aborted with missing worker PTBs. Using the registered package identity allowed the complete checked quote/send to succeed. The source DVNFeePaidEvent therefore identifies Canary by `0x5ddd…9278a`.

The live worker/registry check was repeated at Sui checkpoint 346244750, 2026-11-17 14:56:49 UTC. This is evidence of an identity discrepancy, not proof of the offchain refusal reason.

## Requested investigation and recovery

1. Confirm the correct current Sui Canary ULN identity and its mapping to BNB Canary `0xfa9b…b5dda`.
2. Inspect the worker's job/refusal logs for this GUID and source transaction. Did it receive the job, and is it waiting for a confirmation floor, an identity mapping, an unsupported route, or another condition?
3. If the mapping or job processing needs correction, advise how to verify and resume this existing packet with all four required DVNs retained. Please coordinate any LayerZero metadata / Scan re-indexing correction if needed.
4. If an application-side change is required, provide the exact supported onchain configuration and explain how it affects the already-paid packet before we approve another transaction.

Please do not treat this request as authorization to remove a verifier, lower confirmations, or bypass validation. We are seeking a supported recovery of the existing message.

Project: https://tree-token.xyz/play/multichaintest/

## Public evidence and references

- Scan API: https://scan.layerzero-api.com/v1/messages/guid/0x6a21b3ef6075b49ae3bdb1b839554326695df0d71c949db5aa8898ffc7967f8f
- Published metadata: https://metadata.layerzero-api.com/v1/metadata/deployments
- Canary refusal transparency: https://canary-1.gitbook.io/canary/trust-and-transparency/refusal-transparency
- Canary confirmation floors: https://canary-1.gitbook.io/canary/how-it-works/confirmation-floors

This draft shares public project and blockchain evidence only. It contains no private keys, seed phrases, credentials, or original-collection NFT custody change.
