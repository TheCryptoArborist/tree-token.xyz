# Cetus Challenge eligibility incident — August 26, 2026

## Outcome

Resolved. TREE purchases through the verified Cetus SUI/TREE pool are now monitored and accepted by the protected Challenge ledger. The reported purchase is eligible for the August 26 TREE Knowledge Trial.

## Reported purchase

- Wallet: `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`
- Transaction: `7WEnStuPH2bRqgSMMzjzovbKyvKddB1fiREorVEzukE`
- Finalized: `2026-08-26T14:56:42.869Z`
- Route: Cetus V3, verified pool `0x2ebaff75b8745896404085babb9ef3a77ccbb6c7d3f4db31626cefff04f7f355`
- Input: 7 SUI
- Output: 246,565.547097 TREE
- Challenge qualifying value: $5.16

## Root cause

The transaction verifier already recognized Cetus, but the always-on purchase keeper and its Supabase cursor/route allowlists only included SuiDex V2, SuiDex V3, and Turbos. The Cetus transaction therefore never reached the verified purchase ledger.

## Remediation

- Added the exact Cetus swap event type and pool ID to the keeper.
- Extended the server-side cursor parser and Supabase allowlists to Cetus.
- Kept the ledger idempotent so one digest cannot be credited twice.
- Added a protected reconciliation utility for verified missed digests.
- Reconciled the reported transaction.
- Clarified swap copy from “Best route” to “Best direct venue”; split routing is not active.

## Verification

- Focused keeper, verifier, ingestion, migration, and swap-copy tests passed.
- Keeper health returned `ok` with SuiDex V2, SuiDex V3, Turbos, and Cetus initialized.
- Public Challenge eligibility returned `eligible: true`, `qualifyingUsdCents: 516`, and `passIssued: false`.
