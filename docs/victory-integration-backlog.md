# Deferred VICTORY integration workstream

Status: Active. Phases 1–5 are implemented and deployed to production. Complete Reinvest and Sustainable Reinvest passed automated checks, Mainnet simulations, and a user-approved Sustainable Reinvest transaction rehearsal.

## Production verification · August 21, 2026

- Sustainable Reinvest processed 50,000 VICTORY from wallet `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6` with a 65% reinvest / 35% lock split.
- Transaction `73UgN6VERgrppQUdgRof5NaACD1VqKADt7gSv8MWjYZ2` locked 17,500 VICTORY for 7 days and reinvested 32,500 VICTORY through the verified SUI routes into SUI/TREE V2 liquidity.
- Transaction `J4WCxmN4RjyxFmxs112osphPK7Q6Jbo2673zmTPHBv8i` staked only the newly created LP and claimed the VICTORY emitted by the existing farm position during that stake.
- The production release was deployed to `tree-token.xyz` as Netlify deploy `6a889c877618135848b8a84b` after 215 automated checks passed.
- All transaction confirmation screens now use the branded TREE review window with the wordless TREE DApp emblem.

## Verified Mainnet foundation · August 21, 2026

- VICTORY is the published 6-decimal coin `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN`.
- xVICTORY is the product name for a VICTORY locker position. The published package does not define a separate transferable xVICTORY coin.
- The live locker accepts exactly four lock terms expressed in days: 7, 90, 365, and 1,095.
- Verified shared objects:
  - Token locker: `0xb604843d501173f9ea0762fbaa7cadaea3454c942deb527cb8905861ce39798b`
  - Locked-token vault: `0x3632b8acce355fc8237998d44f1a68e58baac95f199714cdef5736d580dc6bf1`
  - VICTORY reward vault: `0xb70212065c2af0107a799517517e9170fcd38211aaa66f0ebc5a764d0506e2cc`
  - SUI reward vault: `0xd781268befec0270299d5089f182d8c1f1caed15f8b7db3fa1a267b73e89ce9f`
  - Global emission config: `0xfbd4d5f644cc82e7486ceb048b8951a6efffe39254a6646d99f0ea6b81b5c5f4`
- Successful Mainnet `victory_token_locker::lock_tokens` transactions confirm the argument order and day values used by the local builder.
- The deepest verified native SuiDex V2 conversion venue is SUI/VICTORY pool `0xd5fb3cde57c8e792276c30580721599f9f8162f9136416bb4b2312cf79e6d6ae`.
- The direct TREE/VICTORY V2 pool is extremely shallow and must not be used for reinvest routing.
- V2 farm reward claiming transfers VICTORY directly to the wallet and returns no composable coin. Claim-and-reinvest therefore requires two explicit wallet approvals: claim first, then reinvest the wallet's VICTORY.

## Phase 1 implemented locally

- A third Earn subtab named VICTORY contains the embedded VICTORY Center.
- It loads the connected wallet's VICTORY balance and live locker, active-lock, VICTORY-vault, and SUI-vault totals.
- It constructs only the allowlisted `victory_token_locker::lock_tokens` call.
- It merges/splits VICTORY coin objects locally, simulates the exact transaction twice on Mainnet, requires explicit confirmation and wallet approval, waits for finality, and verifies the exact negative VICTORY balance change.
- Desktop and 390-pixel mobile visual checks pass without horizontal overflow.

## Phase 2 implemented locally

- All four lock choices display a live current VICTORY-emissions APR.
- APR is calculated as `current VICTORY per second × seconds per year × term allocation ÷ term total locked`; weekly SUI revenue is deliberately excluded because it is variable.
- The embedded VICTORY Center now has Lock VICTORY and My Locks & Claims views.
- My Locks reads the four published address-keyed lock tables and decodes each lock's ID, principal, term, exact unlock timestamp, VICTORY claimed to date, and claimed SUI epochs.
- A read-only simulation previews accrued VICTORY for every current lock. Claim VICTORY Rewards batches the current locks into one guarded wallet transaction.
- Read-only calls to `get_claimable_epochs_for_lock` identify completed SUI epochs and exact amounts per lock. Claim Weekly SUI batches the verified epoch lists through `batch_claim_epochs_for_lock`.
- Both claim actions pass two Mainnet simulations before wallet approval, wait for finality, and reconcile the published claim events against the simulated amount.
- A live read-only rehearsal against a public wallet successfully loaded two real locks, 2.101402 claimable VICTORY, and zero currently claimable SUI epochs.

## Phase 3 implemented locally

- An Unlock VICTORY control appears on each lock only after its exact published unlock timestamp has passed.
- The builder allowlists only `victory_token_locker::unlock_tokens` with the verified argument order: lock ID, then lock term.
- The exact transaction is simulated twice before confirmation and wallet approval. Finality is reconciled against the published `TokensUnlocked` event and the wallet's returned VICTORY balance.
- The published unlock function returns principal and automatically pays any final VICTORY emission reward. It currently reports zero automatic weekly-SUI rewards, so the interface composes `batch_claim_epochs_for_lock` immediately before `unlock_tokens` whenever that lock has weekly SUI available. Both actions complete through one wallet approval.
- Successful Mainnet unlock transactions confirm the same object and argument layout used by the local builder.

## Phase 4 implemented locally

- A Reinvest view is available inside Earn → VICTORY and accepts VICTORY already held in the connected wallet.
- The protected route is fixed to the verified deep SUI/VICTORY V2 pool, then the verified SUI/TREE V2 pool. It never uses the shallow direct TREE/VICTORY pool.
- The interface shows the minimum SUI output, minimum TREE output, combined quoted price impact, and selectable 0.5%, 1%, or 2% slippage protection.
- The first wallet approval converts VICTORY to SUI, converts half of the protected SUI output to TREE, and creates SUI/TREE V2 LP. The result must simulate twice, spend the exact requested VICTORY amount, and produce a positive LP balance change.
- Only the newly created LP is offered to the verified V2 farm. Staking uses a separate wallet approval so a rejected or failed stake leaves the LP safely in the wallet.
- Farm and locker claims remain explicit actions. A user claims rewards first when the VICTORY is not already in the wallet, then chooses how much wallet VICTORY to reinvest.
- A read-only Mainnet rehearsal with 100 VICTORY completed successfully, returned positive SUI/TREE LP, and did not sign or submit a transaction.

## Phase 5 implemented locally

- The Reinvest view now offers Complete and Sustainable modes without adding another oversized panel.
- Sustainable Reinvest accepts an adjustable 10%–90% liquidity allocation, includes 25/50/75% presets, and sends the remaining VICTORY into one of the four published xVICTORY lock terms.
- The first wallet approval is atomic: it splits the selected VICTORY, creates the verified xVICTORY lock, converts only the reinvest portion through SUI, and creates SUI/TREE V2 LP. If any part fails, none of that first transaction is committed.
- The interface shows both VICTORY allocations, the estimated unlock date, minimum SUI and TREE outputs, combined quoted impact, slippage protection, and the two-approval sequence before wallet confirmation.
- Simulation and finality checks require the exact total VICTORY spend, a matching `TokensLocked` event for the selected amount and term, and a positive SUI/TREE LP balance change.
- As with Complete Reinvest, the second approval stakes only the newly created LP. Rejecting it leaves the lock intact and the LP safely in the wallet.
- A repeatable read-only Mainnet rehearsal with 100 VICTORY at a 50/50 split verified a simulated 50 VICTORY 90-day lock and 33,500,262 positive raw LP units. No transaction was signed or submitted.

## Product goal

Make VICTORY rewards earned from TREE liquidity useful inside the TREE Command Center while supporting the long-term sustainability of the VICTORY ecosystem.

## Requested features

### 1. Embedded xVICTORY experience

- Review the features currently offered through SuiDex's xVICTORY area.
- Select the functions that are relevant to TREE liquidity providers.
- Surface those functions directly inside the TREE Command Center instead of requiring a redirect to SuiDex.
- Preserve clear transaction previews, contract verification, and wallet confirmation for every action.

### 2. Reinvest VICTORY into SUI/TREE liquidity

- Support both SuiDex V2 and SuiDex V3 TREE positions.
- Let a user claim earned VICTORY and choose a destination position.
- Convert the claimed VICTORY into the balanced assets required by the selected SUI/TREE pool.
- Add the resulting liquidity and, for V2, stake the LP when the selected destination requires it.
- Show the route, expected output, price impact, slippage, fees, and final position change before wallet approval.

### 3. Sustainable split reinvest-and-lock flow

- Reproduce the useful behavior of SuiDex's sustainable function inside the TREE Command Center after the underlying contracts and transaction route are verified.
- Allow the user to choose what percentage of claimed VICTORY is converted toward TREE/liquidity reinvestment.
- Send the remaining percentage into the verified VICTORY token-locker flow.
- Show the exact split, lock duration, received locker asset or position, unlock terms, and reinvestment result before wallet approval.

## Remaining discovery and implementation

- Verify the exact V3 add-liquidity composition for an existing position or a new selected range before exposing V3 reinvest.
- Add transaction analytics for the deployed V2 Complete and Sustainable Reinvest flows.
- Complete a deliberately small user-approved Mainnet rehearsal after V3 reinvest passes both simulations.

## Acceptance outcome

A TREE liquidity provider can manage VICTORY/xVICTORY without leaving the TREE Command Center, reinvest rewards into a chosen V2 or V3 SUI/TREE position, or select a transparent split that reinvests one portion and locks the other through the verified VICTORY locker.
