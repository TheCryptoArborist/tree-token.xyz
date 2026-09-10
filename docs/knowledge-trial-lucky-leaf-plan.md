# TREE Knowledge Trial — Lucky Leaf wBTC Plan

Status: daily Knowledge Trial framework, security controls, resolution flow, and 50,000 TREE award settlement are implemented and deployed. Public activation and final operating review remain pending. Weekly Lucky Leaf wBTC settlement remains a separate future phase.

## Prize structure

- Daily Knowledge Trial: one performance-ranked winner receives 50,000 TREE.
- Weekly Lucky Leaf Championship: one performance-ranked winner receives approximately $25 of the configured Sui wBTC token.
- The interface must identify the asset as wrapped Bitcoin on Sui and show its complete coin type.

## Recommended weekly flow

1. A wallet qualifies for a daily Knowledge Trial through the published qualifying TREE purchase requirement.
2. Anyone who records at least one valid daily score during the Monday-through-Sunday competition week becomes eligible for the weekly final. No second purchase is required.
3. The weekly final uses a separate five-question TREE ecosystem challenge.
4. Correct answers rank first and verified completion time ranks equal scores.
5. Exact ties advance to private timed sudden-death questions until one winner remains.
6. The winner's configured wBTC prize is reserved in the on-chain prize pool and claimed by the winning wallet.

## Fairness and funding controls

- No random selection, drawing, ticket weighting, streak multiplier, wallet-balance weighting, or purchase-size weighting selects the Lucky Leaf winner.
- The exact wBTC raw amount and coin type are published and locked before the weekly final opens.
- The weekly prize cannot open unless the full wBTC amount is already deposited and available in the on-chain prize pool.
- If no eligible finalist completes the weekly challenge, the award is cancelled or rolled forward under a rule published before the week begins.
- If only one finalist participates, the published minimum performance threshold still applies; participation alone does not automatically win.
- Winner resolution, prize reservation, claim, and claim reconciliation use the same protected audit pattern as the 50,000 TREE daily award.

## Implementation notes

- Existing configured Sui wBTC coin type: `0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC`.
- Current TREE award settlement is intentionally restricted to the daily 50,000 TREE prize. Weekly wBTC support must be added as a separate prize class and tested before activation.
- The wBTC currently held in an admin wallet is not considered funded until an authorized deposit transaction places it in the on-chain prize pool.
- Final competition terms and jurisdiction rules require appropriate professional review before purchase-gated public activation.
